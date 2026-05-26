import { config } from '../config';
import { logger } from '../lib/logger';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Local filesystem storage service.
 * All images stored in config.storageLocalDir, served via static route.
 */
export class StorageService {
  constructor() {
    logger.info(`[Storage] Using local storage (dir: ${config.storageLocalDir})`);
  }

  async uploadImageFromUrl(
    projectId: string,
    imageUrl: string,
    opts?: { detailed?: boolean }
  ): Promise<string | { url: string; path: string }> {
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
      const filename = `${uuidv4()}.${ext}`;
      const result = await this.uploadToLocal(projectId, filename, buffer);
      return opts?.detailed ? result : result.url;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`[Storage] Image fetch timeout after 60s`);
        throw new Error('Image download timeout');
      }
      logger.error(`[Storage] Failed to upload image from URL: ${error}`);
      throw error;
    }
  }

  async uploadImageFromBase64(
    projectId: string,
    base64Data: string,
    opts?: { detailed?: boolean }
  ): Promise<string | { url: string; path: string }> {
    logger.info(`[Storage] Uploading image from base64 for project ${projectId}`);
    try {
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');
      const formatMatch = base64Data.match(/^data:image\/(\w+);base64,/);
      const ext = formatMatch ? formatMatch[1] : 'png';
      const filename = `${uuidv4()}.${ext}`;
      const result = await this.uploadToLocal(projectId, filename, buffer);
      return opts?.detailed ? result : result.url;
    } catch (error) {
      logger.error(`[Storage] Failed to upload image from base64: ${error}`);
      throw error;
    }
  }

  async getSignedUrl(filePath: string, _expiresInSec?: number): Promise<string> {
    const publicUrl = `${config.storageBaseUrl}/${filePath}`;
    return publicUrl;
  }

  async getSignedUrls(filePaths: string[], expiresInSec?: number): Promise<string[]> {
    return Promise.all(filePaths.map(fp => this.getSignedUrl(fp, expiresInSec)));
  }

  private async uploadToLocal(projectId: string, filename: string, buffer: Buffer): Promise<{ url: string; path: string }> {
    const projectDir = path.join(config.storageLocalDir, 'projects', projectId);
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
