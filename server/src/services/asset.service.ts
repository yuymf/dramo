import { runImageGeneration } from '../lib/agentos-client';
import { StorageService } from './storage.service';
import { logger } from '../lib/logger';
import { prisma } from '../lib/db';

interface Character3ViewRequest {
  characterId: string;
  name: string;
  description: string;
  style?: string;
}

interface LocationImageRequest {
  locationId: string;
  name: string;
  description: string;
  style?: string;
}

interface UnifiedImageRequest {
  name: string;
  description: string;
  style?: string;
  referenceImages?: string[]; // Legacy: direct URLs (deprecated)
  referencePaths?: string[]; // New: storage paths (will be signed before use)
  mode?: 'single' | 'sequence';
  assetType?: 'character' | 'location'; // For auto-saving to DB
}

/**
 * Asset Service - handles character 3-views, location images, and unified generation
 */
export class AssetService {
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
  }

  /**
   * Generate character 3-view
   */
  async generateCharacter3View(
    projectId: string,
    _userId: string,
    request: Character3ViewRequest,
    llmHeaders?: Record<string, string>
  ) {
    logger.info(`[AssetService] Generating 3-view for character ${request.characterId}`);

    try {
      const prompt = this.buildPrompt(request.description, request.style);

      const result = await runImageGeneration({
        prompt,
        mode: 'single',
        stream: false,
        style: request.style,
      }, { llmHeaders });

      // Upload to storage
      const uploadedUrls = await Promise.all(
        result.images.map((img) => this.storageService.uploadImageFromUrl(projectId, img.url))
      );

      return {
        success: true,
        characterId: request.characterId,
        images: uploadedUrls.map((url) => ({ url })),
      };
    } catch (error) {
      logger.error(`[AssetService] Character 3-view generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * List character assets
   */
  async listCharacterAssets(projectId: string, _userId: string) {
    logger.info(`[AssetService] Listing character assets for project ${projectId}`);
    
    try {
      const assets = await prisma.characterAsset.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      // Process and convert base64 to URLs (lazy migration)
      const processedAssets = await Promise.all(
        assets.map(async (asset: { id: string; name: string; description: string | null; images: unknown; createdAt: Date; alias?: unknown }) => {
          let needsUpdate = false;
          const images = (Array.isArray(asset.images) ? asset.images : JSON.parse(String(asset.images || '[]'))) as Array<{ url: string; [key: string]: unknown }>;
          
          const processedImages = await Promise.all(
            images.map(async (img) => {
              // Check if image URL is base64
              if (img.url && img.url.startsWith('data:image/')) {
                needsUpdate = true;
                logger.info(`[AssetService] Converting legacy base64 image in character asset ${asset.id}`);
                try {
                  // Upload to storage and get real URL
                  const { url, path } = await this.storageService.uploadImageFromBase64Detailed(
                    projectId,
                    img.url
                  );
                  return {
                    ...img,
                    url,
                    path,
                  };
                } catch (error) {
                  logger.error(`[AssetService] Failed to convert base64 for character asset ${asset.id}: ${error}`);
                  // Keep original if conversion fails
                  return img;
                }
              }
              return img;
            })
          );

          // Update database if any images were converted
          if (needsUpdate) {
            try {
              await prisma.characterAsset.update({
                where: { id: asset.id },
                data: { images: processedImages as any },
              });
              logger.info(`[AssetService] Updated character asset ${asset.id} with converted URLs`);
            } catch (error) {
              logger.error(`[AssetService] Failed to update character asset ${asset.id}: ${error}`);
            }
          }

          return {
            id: asset.id,
            characterName: asset.name,
            description: asset.description || undefined,
            alias: (asset as any).alias || undefined,
            images: processedImages,
            createdAt: asset.createdAt.toISOString(),
          };
        })
      );

      return {
        success: true,
        dataV2: processedAssets,
      };
    } catch (error) {
      logger.error(`[AssetService] Failed to list character assets: ${error}`);
      return {
        success: false,
        dataV2: [],
      };
    }
  }

  /**
   * Generate location image
   */
  async generateLocationImage(
    projectId: string,
    _userId: string,
    request: LocationImageRequest,
    llmHeaders?: Record<string, string>
  ) {
    logger.info(`[AssetService] Generating image for location ${request.locationId}`);

    try {
      const prompt = this.buildPrompt(request.description, request.style);

      const result = await runImageGeneration({
        prompt,
        mode: 'single',
        stream: false,
        style: request.style,
      }, { llmHeaders });

      // Upload to storage
      const uploadedUrls = await Promise.all(
        result.images.map((img) => this.storageService.uploadImageFromUrl(projectId, img.url))
      );

      return {
        success: true,
        locationId: request.locationId,
        images: uploadedUrls.map((url) => ({ url })),
      };
    } catch (error) {
      logger.error(`[AssetService] Location image generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * List location assets
   */
  async listLocationAssets(projectId: string, _userId: string) {
    logger.info(`[AssetService] Listing location assets for project ${projectId}`);
    
    try {
      const assets = await prisma.locationAsset.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      // Process and convert base64 to URLs (lazy migration)
      const processedAssets = await Promise.all(
        assets.map(async (asset: { id: string; name: string; description: string | null; images: unknown; createdAt: Date; alias?: unknown }) => {
          let needsUpdate = false;
          const images = (Array.isArray(asset.images) ? asset.images : JSON.parse(String(asset.images || '[]'))) as Array<{ url: string; [key: string]: unknown }>;
          
          const processedImages = await Promise.all(
            images.map(async (img) => {
              // Check if image URL is base64
              if (img.url && img.url.startsWith('data:image/')) {
                needsUpdate = true;
                logger.info(`[AssetService] Converting legacy base64 image in location asset ${asset.id}`);
                try {
                  // Upload to storage and get real URL
                  const { url, path } = await this.storageService.uploadImageFromBase64Detailed(
                    projectId,
                    img.url
                  );
                  return {
                    ...img,
                    url,
                    path,
                  };
                } catch (error) {
                  logger.error(`[AssetService] Failed to convert base64 for location asset ${asset.id}: ${error}`);
                  // Keep original if conversion fails
                  return img;
                }
              }
              return img;
            })
          );

          // Update database if any images were converted
          if (needsUpdate) {
            try {
              await prisma.locationAsset.update({
                where: { id: asset.id },
                data: { images: processedImages as any },
              });
              logger.info(`[AssetService] Updated location asset ${asset.id} with converted URLs`);
            } catch (error) {
              logger.error(`[AssetService] Failed to update location asset ${asset.id}: ${error}`);
            }
          }

          return {
            id: asset.id,
            locationName: asset.name,
            description: asset.description || undefined,
            images: processedImages,
            createdAt: asset.createdAt.toISOString(),
          };
        })
      );

      return {
        success: true,
        dataV2: processedAssets,
      };
    } catch (error) {
      logger.error(`[AssetService] Failed to list location assets: ${error}`);
      return {
        success: false,
        dataV2: [],
      };
    }
  }

  /**
   * Unified image generation endpoint
   * Supports single/sequence generation with optional reference images
   */
  async generateImageUnified(
    projectId: string,
    _userId: string,
    request: UnifiedImageRequest,
    llmHeaders?: Record<string, string>
  ) {
    const refCount = (request.referencePaths?.length || 0) + (request.referenceImages?.length || 0);
    logger.info(
      `[AssetService] Unified generation: mode=${request.mode}, refs=${refCount}, paths=${request.referencePaths?.length || 0}, type=${request.assetType}`
    );

    try {
      // Build the prompt combining description and style
      const prompt = this.buildPrompt(request.description, request.style);

      // Use reference images directly (URLs are already accessible)
      let referenceUrls: string[] = [];
      if (request.referenceImages && request.referenceImages.length > 0) {
        logger.info(`[AssetService] Using ${request.referenceImages.length} reference image URLs`);
        referenceUrls = request.referenceImages;
      } else {
        logger.info(`[AssetService] No reference images provided`);
      }

      // Call AgentOS image generation
      const result = await runImageGeneration({
        prompt,
        referenceImages: referenceUrls,
        mode: request.mode || 'single',
        stream: false,
        style: request.style,
      }, { llmHeaders });

      logger.info(`[AssetService] Generated ${result.images.length} images`);

      // Upload all images to storage
      const uploadedUrls = await Promise.all(
        result.images.map((img) => this.storageService.uploadImageFromUrl(projectId, img.url))
      );

      const images = uploadedUrls.map((url, idx) => ({
        id: `img_${Date.now()}_${idx}`,
        url,
        source: 'generated' as const,
        createdAt: new Date().toISOString(),
      }));

      // Save to DB if assetType is specified
      if (request.assetType === 'character') {
        await this.createCharacterAsset(projectId, {
          name: request.name,
          description: request.description,
          images,
        });
      } else if (request.assetType === 'location') {
        await this.createLocationAsset(projectId, {
          name: request.name,
          description: request.description,
          images,
        });
      }

      return {
        success: true,
        mode: result.mode,
        type: result.type,
        images,
      };
    } catch (error) {
      logger.error(`[AssetService] Unified image generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Create character asset in DB
   */
  async createCharacterAsset(
    projectId: string,
    data: {
      name: string;
      description?: string;
      alias?: string;
      images: Array<{
        id: string;
        url: string;
        source: 'upload' | 'generated' | 'reference';
        createdAt: string;
      }>;
    }
  ) {
    try {
      // 处理 images：将 base64 转换为实际 URL
      const processedImages = await Promise.all(
        data.images.map(async (img) => {
          // 检测是否是 base64
          if (img.url.startsWith('data:image/')) {
            logger.info('[AssetService] Converting base64 to storage URL for character asset');
            // 上传到存储并获取 URL 和 path
            const { url, path } = await this.storageService.uploadImageFromBase64Detailed(
              projectId,
              img.url
            );
            return {
              ...img,
              url,
              path, // 新增：存储路径，用于后续生成签名 URL
            };
          }
          // 已经是 URL，直接返回
          return img;
        })
      );

      const asset = await prisma.characterAsset.create({
        data: {
          projectId,
          name: data.name,
          description: data.description,
          images: processedImages as any,
        },
      });

      logger.info(`[AssetService] Created character asset: ${asset.id}`);
      return asset;
    } catch (error) {
      logger.error(`[AssetService] Failed to create character asset: ${error}`);
      throw error;
    }
  }

  /**
   * Create location asset in DB
   */
  async createLocationAsset(
    projectId: string,
    data: {
      name: string;
      description?: string;
      alias?: string;
      images: Array<{
        id: string;
        url: string;
        source: 'upload' | 'generated' | 'reference';
        createdAt: string;
      }>;
    }
  ) {
    try {
      // 处理 images：将 base64 转换为实际 URL
      const processedImages = await Promise.all(
        data.images.map(async (img) => {
          // 检测是否是 base64
          if (img.url.startsWith('data:image/')) {
            logger.info('[AssetService] Converting base64 to storage URL for location asset');
            // 上传到存储并获取 URL 和 path
            const { url, path } = await this.storageService.uploadImageFromBase64Detailed(
              projectId,
              img.url
            );
            return {
              ...img,
              url,
              path, // 新增：存储路径，用于后续生成签名 URL
            };
          }
          // 已经是 URL，直接返回
          return img;
        })
      );

      const asset = await prisma.locationAsset.create({
        data: {
          projectId,
          name: data.name,
          description: data.description,
          images: processedImages as any,
        },
      });

      logger.info(`[AssetService] Created location asset: ${asset.id}`);
      return asset;
    } catch (error) {
      logger.error(`[AssetService] Failed to create location asset: ${error}`);
      throw error;
    }
  }

  /**
   * Update character asset
   */
  async updateCharacterAsset(
    projectId: string,
    assetId: string,
    data: {
      name?: string;
      description?: string;
      alias?: string;
      images?: Array<{
        id: string;
        url: string;
        source: 'upload' | 'generated' | 'reference';
        createdAt: string;
      }>;
    }
  ) {
    try {
      // First verify the asset belongs to the project
      const existing = await prisma.characterAsset.findUnique({
        where: { id: assetId },
      });

      if (!existing || existing.projectId !== projectId) {
        throw new Error('Asset not found or does not belong to this project');
      }

      const asset = await prisma.characterAsset.update({
        where: { id: assetId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.alias !== undefined && { alias: data.alias }),
          ...(data.images && { images: data.images as any }),
        },
      });

      logger.info(`[AssetService] Updated character asset: ${asset.id}`);
      return { success: true, asset };
    } catch (error) {
      logger.error(`[AssetService] Failed to update character asset: ${error}`);
      throw error;
    }
  }

  /**
   * Delete character asset
   */
  async deleteCharacterAsset(projectId: string, assetId: string) {
    try {
      // First verify the asset belongs to the project
      const existing = await prisma.characterAsset.findUnique({
        where: { id: assetId },
      });

      if (!existing) {
        logger.warn(`[AssetService] Delete called for non-existent character asset: ${assetId}`);
        return { success: true };
      }

      if (existing.projectId !== projectId) {
        logger.warn(`[AssetService] Delete forbidden - asset ${assetId} not in project ${projectId}`);
        return { success: true };
      }

      // Delete all relations involving this character first
      const deletedRelations = await prisma.characterRelation.deleteMany({
        where: {
          OR: [
            { nodeAId: assetId },
            { nodeBId: assetId },
          ],
        },
      });
      logger.info(`[AssetService] Deleted ${deletedRelations.count} relations for character asset: ${assetId}`);

      // Now delete the character asset
      await prisma.characterAsset.delete({
        where: { id: assetId },
      });

      logger.info(`[AssetService] Deleted character asset: ${assetId}`);
      return { success: true };
    } catch (error) {
      logger.error(`[AssetService] Failed to delete character asset: ${error}`);
      throw error;
    }
  }

  /**
   * Update location asset
   */
  async updateLocationAsset(
    projectId: string,
    assetId: string,
    data: {
      name?: string;
      description?: string;
      alias?: string;
      images?: Array<{
        id: string;
        url: string;
        source: 'upload' | 'generated' | 'reference';
        createdAt: string;
      }>;
    }
  ) {
    try {
      // First verify the asset belongs to the project
      const existing = await prisma.locationAsset.findUnique({
        where: { id: assetId },
      });

      if (!existing || existing.projectId !== projectId) {
        throw new Error('Asset not found or does not belong to this project');
      }

      const asset = await prisma.locationAsset.update({
        where: { id: assetId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.alias !== undefined && { alias: data.alias }),
          ...(data.images && { images: data.images as any }),
        },
      });

      logger.info(`[AssetService] Updated location asset: ${asset.id}`);
      return { success: true, asset };
    } catch (error) {
      logger.error(`[AssetService] Failed to update location asset: ${error}`);
      throw error;
    }
  }

  /**
   * Delete location asset
   */
  async deleteLocationAsset(projectId: string, assetId: string) {
    try {
      // First verify the asset belongs to the project
      const existing = await prisma.locationAsset.findUnique({
        where: { id: assetId },
      });

      if (!existing) {
        logger.warn(`[AssetService] Delete called for non-existent location asset: ${assetId}`);
        return { success: true };
      }

      if (existing.projectId !== projectId) {
        logger.warn(`[AssetService] Delete forbidden - asset ${assetId} not in project ${projectId}`);
        return { success: true };
      }

      await prisma.locationAsset.delete({
        where: { id: assetId },
      });

      logger.info(`[AssetService] Deleted location asset: ${assetId}`);
      return { success: true };
    } catch (error) {
      logger.error(`[AssetService] Failed to delete location asset: ${error}`);
      throw error;
    }
  }

  /**
   * Get character assets as a slim lib for AgentOS injection
   */
  async getCharacterLibItems(projectId: string): Promise<Array<{ name: string; description?: string; alias?: string }>> {
    try {
      const assets = await prisma.characterAsset.findMany({
        where: { projectId },
        select: { name: true, description: true, alias: true },
        orderBy: { createdAt: 'asc' },
      });
      return assets.map(a => ({
        name: a.name,
        description: a.description ?? undefined,
        alias: a.alias ?? undefined,
      }));
    } catch (error: unknown) {
      logger.warn({ projectId, error }, 'Failed to fetch character lib items, continuing without context');
      return [];
    }
  }
  async getLocationLibItems(projectId: string): Promise<Array<{ name: string; description?: string; alias?: string }>> {
    try {
      const assets = await prisma.locationAsset.findMany({
        where: { projectId },
        select: { name: true, description: true, alias: true },
        orderBy: { createdAt: 'asc' },
      });
      return assets.map(a => ({
        name: a.name,
        description: a.description ?? undefined,
        alias: a.alias ?? undefined,
      }));
    } catch (error: unknown) {
      logger.warn({ projectId, error }, 'Failed to fetch location lib items, continuing without context');
      return [];
    }
  }

  /**
   * Build prompt from description and style
   */
  private buildPrompt(description: string, style?: string): string {
    let prompt = description.trim();

    if (style) {
      const styleMap: Record<string, string> = {
        realistic: '写实风格, photorealistic, high detail',
        sketch: '线稿风格, sketch, line art, black and white',
        comic: '漫画风格, comic style, manga, illustration',
        doodle: '涂鸦风格, doodle, hand-drawn, artistic',
      };

      const styleTag = styleMap[style] || style;
      prompt = `${prompt}. Style: ${styleTag}`;
    }

    return prompt;
  }
}

