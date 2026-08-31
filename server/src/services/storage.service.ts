import { config } from '../config';
import { logger } from '../lib/logger';
import fs from 'fs/promises';
import path from 'path';

export interface StoredImage {
  url: string;
  path: string;
}

/**
 * Local filesystem storage. Files live under config.storageLocalDir
 * and are served by nginx at /uploads in production.
 */
export class StorageService {
  constructor() {
    logger.info(`[Storage] Using local storage (dir: ${config.storageLocalDir})`);
  }

  async uploadImageFromUrl(projectId: string, imageUrl: string): Promise<string> {
    logger.info(`[Storage] Uploading image from URL for project ${projectId}`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const response = await fetch(imageUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = this.getExtensionFromUrl(imageUrl) || 'png';
      const filename = `${crypto.randomUUID()}.${ext}`;
      const result = await this.uploadToLocal(projectId, filename, buffer);
      return result.url;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`[Storage] Image fetch timeout after 60s`);
        throw new Error('Image download timeout');
      }
      logger.error(`[Storage] Failed to upload image from URL: ${error}`);
      throw error;
    }
  }

  async uploadBytes(projectId: string, buffer: Buffer, ext: string): Promise<StoredImage> {
    const safeExt = ext.replace(/^\./, '').replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const filename = `${crypto.randomUUID()}.${safeExt}`;
    return this.uploadToLocal(projectId, filename, buffer);
  }

  resolveLocalPath(publicUrl: string): string | null {
    const match = publicUrl.match(/\/(?:api\/files|uploads)\/projects\/([^/]+)\/([^/?#]+)/);
    if (!match) return null;
    const projectId = match[1];
    const filename = match[2];
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId) || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return null;
    }
    return path.resolve(config.storageLocalDir, 'projects', projectId, filename);
  }

  publicApiUrl(projectId: string, filename: string): string {
    return `/api/files/projects/${projectId}/${filename}`;
  }

  async uploadImageFromBase64(projectId: string, base64Data: string): Promise<StoredImage> {
    logger.info(`[Storage] Uploading image from base64 for project ${projectId}`);
    try {
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');
      const formatMatch = base64Data.match(/^data:image\/(\w+);base64,/);
      const ext = formatMatch ? formatMatch[1] : 'png';
      const filename = `${crypto.randomUUID()}.${ext}`;
      return this.uploadToLocal(projectId, filename, buffer);
    } catch (error) {
      logger.error(`[Storage] Failed to upload image from base64: ${error}`);
      throw error;
    }
  }

  private assertSafeProjectId(projectId: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
      throw new Error('Invalid projectId');
    }
  }

  private async uploadToLocal(projectId: string, filename: string, buffer: Buffer): Promise<StoredImage> {
    this.assertSafeProjectId(projectId);

    const root = path.resolve(config.storageLocalDir, 'projects');
    const projectDir = path.resolve(root, projectId);
    if (projectDir !== root && !projectDir.startsWith(root + path.sep)) {
      throw new Error('Invalid projectId');
    }

    await fs.mkdir(projectDir, { recursive: true });

    const filePath = path.join(projectDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `${config.storageBaseUrl}/projects/${projectId}/${filename}`;
    const storagePath = `projects/${projectId}/${filename}`;
    logger.info(`[Storage] Uploaded to local: ${publicUrl}`);
    return { url: publicUrl, path: storagePath };
  }

  private getExtensionFromUrl(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const ext = path.extname(pathname).slice(1);
      return ext || null;
    } catch {
      return null;
    }
  }
}
