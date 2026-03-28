import { config } from '../config';
import { logger } from '../lib/logger';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
// Uses native fetch (Node 18+)

export type StorageDriver = 'local' | 'supabase';

/**
 * Storage service that supports multiple drivers (local filesystem, Supabase)
 */
export class StorageService {
  private driver: StorageDriver;
  private supabaseClient?: ReturnType<typeof createClient>;

  constructor() {
    this.driver = config.storageDriver as StorageDriver;

    if (this.driver === 'supabase') {
      if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
        logger.warn('[Storage] Supabase credentials missing, falling back to local storage');
        this.driver = 'local';
      } else {
        this.supabaseClient = createClient(
          config.supabaseUrl,
          config.supabaseServiceRoleKey
        );
        logger.info(`[Storage] Using Supabase storage (bucket: ${config.supabaseBucket})`);
      }
    }

    if (this.driver === 'local') {
      logger.info(`[Storage] Using local storage (dir: ${config.storageLocalDir})`);
    }
  }

  /**
   * Upload image from URL
   */
  async uploadImageFromUrl(projectId: string, imageUrl: string): Promise<string> {
    logger.info(`[Storage] Uploading image from URL for project ${projectId}`);

    try {
      // Fetch the image with timeout (60 seconds)
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

      if (this.driver === 'supabase') {
        const result = await this.uploadToSupabase(projectId, filename, buffer);
        return result.url;
      } else {
        const result = await this.uploadToLocal(projectId, filename, buffer);
        return result.url;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`[Storage] Image fetch timeout after 60s`);
        throw new Error('Image download timeout');
      }
      logger.error(`[Storage] Failed to upload image from URL: ${error}`);
      throw error;
    }
  }

  /**
   * Upload image from URL with detailed result (url + path)
   */
  async uploadImageFromUrlDetailed(projectId: string, imageUrl: string): Promise<{ url: string; path: string }> {
    logger.info(`[Storage] Uploading image from URL (detailed) for project ${projectId}`);

    try {
      // Fetch the image with timeout (60 seconds)
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

      if (this.driver === 'supabase') {
        return await this.uploadToSupabase(projectId, filename, buffer);
      } else {
        return await this.uploadToLocal(projectId, filename, buffer);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`[Storage] Image fetch timeout after 60s`);
        throw new Error('Image download timeout');
      }
      logger.error(`[Storage] Failed to upload image from URL (detailed): ${error}`);
      throw error;
    }
  }

  /**
   * Upload image from base64
   */
  async uploadImageFromBase64(projectId: string, base64Data: string): Promise<string> {
    logger.info(`[Storage] Uploading image from base64 for project ${projectId}`);

    try {
      // Remove data URI prefix if present
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      // Detect format from data URI or default to png
      const formatMatch = base64Data.match(/^data:image\/(\w+);base64,/);
      const ext = formatMatch ? formatMatch[1] : 'png';
      const filename = `${uuidv4()}.${ext}`;

      if (this.driver === 'supabase') {
        const result = await this.uploadToSupabase(projectId, filename, buffer);
        return result.url;
      } else {
        const result = await this.uploadToLocal(projectId, filename, buffer);
        return result.url;
      }
    } catch (error) {
      logger.error(`[Storage] Failed to upload image from base64: ${error}`);
      throw error;
    }
  }

  /**
   * Upload image from base64 with detailed result (url + path)
   */
  async uploadImageFromBase64Detailed(projectId: string, base64Data: string): Promise<{ url: string; path: string }> {
    logger.info(`[Storage] Uploading image from base64 (detailed) for project ${projectId}`);

    try {
      // Remove data URI prefix if present
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      // Detect format from data URI or default to png
      const formatMatch = base64Data.match(/^data:image\/(\w+);base64,/);
      const ext = formatMatch ? formatMatch[1] : 'png';
      const filename = `${uuidv4()}.${ext}`;

      if (this.driver === 'supabase') {
        return await this.uploadToSupabase(projectId, filename, buffer);
      } else {
        return await this.uploadToLocal(projectId, filename, buffer);
      }
    } catch (error) {
      logger.error(`[Storage] Failed to upload image from base64 (detailed): ${error}`);
      throw error;
    }
  }

  /**
   * Upload to Supabase Storage
   */
  private async uploadToSupabase(projectId: string, filename: string, buffer: Buffer): Promise<{ url: string; path: string }> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    const bucket = config.supabaseBucket!;
    const filePath = `projects/${projectId}/${filename}`;

    const { error } = await this.supabaseClient.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: this.getContentType(filename),
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabaseClient.storage
      .from(bucket)
      .getPublicUrl(filePath);

    logger.info(`[Storage] Uploaded to Supabase: ${urlData.publicUrl}`);
    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  }

  /**
   * Upload to local filesystem
   */
  private async uploadToLocal(projectId: string, filename: string, buffer: Buffer): Promise<{ url: string; path: string }> {
    const projectDir = path.join(config.storageLocalDir, 'projects', projectId);
    await fs.mkdir(projectDir, { recursive: true });

    const filePath = path.join(projectDir, filename);
    await fs.writeFile(filePath, buffer);

    // Build public URL
    const publicUrl = `${config.storageBaseUrl}/projects/${projectId}/${filename}`;
    const storagePath = `projects/${projectId}/${filename}`;
    logger.info(`[Storage] Uploaded to local: ${publicUrl}`);
    return {
      url: publicUrl,
      path: storagePath,
    };
  }

  /**
   * Get signed URL for a file path (for private buckets)
   * Returns the URL directly for local storage or public buckets
   */
  async getSignedUrl(filePath: string, expiresInSec?: number): Promise<string> {
    const ttl = expiresInSec || config.supabaseSignedUrlTtl;

    if (this.driver === 'supabase') {
      if (!this.supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      const bucket = config.supabaseBucket!;
      const { data, error } = await this.supabaseClient.storage
        .from(bucket)
        .createSignedUrl(filePath, ttl);

      if (error) {
        logger.error(`[Storage] Failed to create signed URL: ${error.message}`);
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      if (!data?.signedUrl) {
        throw new Error('Signed URL not returned from Supabase');
      }

      logger.info(`[Storage] Created signed URL for ${filePath} (TTL: ${ttl}s)`);
      return data.signedUrl;
    } else {
      // For local storage, just return the public URL
      const publicUrl = `${config.storageBaseUrl}/${filePath}`;
      logger.info(`[Storage] Returning local URL for ${filePath}`);
      return publicUrl;
    }
  }

  /**
   * Get signed URLs for multiple file paths
   */
  async getSignedUrls(filePaths: string[], expiresInSec?: number): Promise<string[]> {
    return Promise.all(filePaths.map(fp => this.getSignedUrl(fp, expiresInSec)));
  }

  /**
   * Get file extension from URL
   */
  private getExtensionFromUrl(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const ext = path.extname(pathname).slice(1);
      return ext || null;
    } catch {
      return null;
    }
  }

  /**
   * Get content type from filename
   */
  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const types: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return types[ext] || 'application/octet-stream';
  }
}

