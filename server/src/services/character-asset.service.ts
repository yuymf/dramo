import { runImageGeneration } from '../lib/agentos-client';
import { StorageService } from './storage.service';
import { logger } from '../lib/logger';
import { prisma } from '../lib/db';
import type { AssetAdapter } from '../lib/asset-route-factory';

export interface Character3ViewRequest {
  characterId: string;
  name: string;
  description: string;
  style?: string;
}

export interface CharacterAssetData {
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

/**
 * Character Asset Service - handles character 3-views and character asset CRUD
 */
export class CharacterAssetService implements AssetAdapter {
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
    logger.info(`[CharacterAssetService] Generating 3-view for character ${request.characterId}`);

    try {
      const prompt = this.buildPrompt(request.description, request.style);

      const result = await runImageGeneration({
        prompt,
        mode: 'single',
        stream: false,
        style: request.style,
      }, { llmHeaders });

      const uploadedUrls = await Promise.all(
        result.images.map((img) => this.storageService.uploadImageFromUrl(projectId, img.url))
      );

      return {
        success: true,
        characterId: request.characterId,
        images: uploadedUrls.map((url) => ({ url })),
      };
    } catch (error) {
      logger.error(`[CharacterAssetService] Character 3-view generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * List character assets with lazy base64→URL migration
   */
  async listCharacterAssets(projectId: string, _userId: string) {
    logger.info(`[CharacterAssetService] Listing character assets for project ${projectId}`);

    try {
      const assets = await prisma.characterAsset.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      const processedAssets = await Promise.all(
        assets.map(async (asset: { id: string; name: string; description: string | null; images: unknown; createdAt: Date; alias?: unknown }) => {
          let needsUpdate = false;
          const images = (Array.isArray(asset.images) ? asset.images : JSON.parse(String(asset.images || '[]'))) as Array<{ url: string; [key: string]: unknown }>;

          const processedImages = await Promise.all(
            images.map(async (img) => {
              if (img.url && img.url.startsWith('data:image/')) {
                needsUpdate = true;
                logger.info(`[CharacterAssetService] Converting legacy base64 image in character asset ${asset.id}`);
                try {
                  const { url, path } = await this.storageService.uploadImageFromBase64(
                    projectId,
                    img.url,
                    { detailed: true }
                  ) as { url: string; path: string };
                  return { ...img, url, path };
                } catch (error) {
                  logger.error(`[CharacterAssetService] Failed to convert base64 for character asset ${asset.id}: ${error}`);
                  return img;
                }
              }
              return img;
            })
          );

          if (needsUpdate) {
            try {
              await prisma.characterAsset.update({
                where: { id: asset.id },
                data: { images: processedImages as any },
              });
              logger.info(`[CharacterAssetService] Updated character asset ${asset.id} with converted URLs`);
            } catch (error) {
              logger.error(`[CharacterAssetService] Failed to update character asset ${asset.id}: ${error}`);
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

      return { success: true, dataV2: processedAssets };
    } catch (error) {
      logger.error(`[CharacterAssetService] Failed to list character assets: ${error}`);
      return { success: false, dataV2: [] };
    }
  }

  /**
   * Create character asset in DB, handling base64 image upload
   */
  async createCharacterAsset(projectId: string, data: CharacterAssetData) {
    try {
      const processedImages = await Promise.all(
        data.images.map(async (img) => {
          if (img.url.startsWith('data:image/')) {
            logger.info('[CharacterAssetService] Converting base64 to storage URL for character asset');
            const { url, path } = await this.storageService.uploadImageFromBase64(
              projectId,
              img.url,
              { detailed: true }
            ) as { url: string; path: string };
            return { ...img, url, path };
          }
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

      logger.info(`[CharacterAssetService] Created character asset: ${asset.id}`);
      return asset;
    } catch (error) {
      logger.error(`[CharacterAssetService] Failed to create character asset: ${error}`);
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
      const existing = await prisma.characterAsset.findUnique({ where: { id: assetId } });

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

      logger.info(`[CharacterAssetService] Updated character asset: ${asset.id}`);
      return { success: true, asset };
    } catch (error) {
      logger.error(`[CharacterAssetService] Failed to update character asset: ${error}`);
      throw error;
    }
  }

  /**
   * Delete character asset and its relations
   */
  async deleteCharacterAsset(projectId: string, assetId: string) {
    try {
      const existing = await prisma.characterAsset.findUnique({ where: { id: assetId } });

      if (!existing) {
        logger.warn(`[CharacterAssetService] Delete called for non-existent character asset: ${assetId}`);
        return { success: true };
      }

      if (existing.projectId !== projectId) {
        logger.warn(`[CharacterAssetService] Delete forbidden - asset ${assetId} not in project ${projectId}`);
        return { success: true };
      }

      const deletedRelations = await prisma.characterRelation.deleteMany({
        where: {
          OR: [{ nodeAId: assetId }, { nodeBId: assetId }],
        },
      });
      logger.info(`[CharacterAssetService] Deleted ${deletedRelations.count} relations for character asset: ${assetId}`);

      await prisma.characterAsset.delete({ where: { id: assetId } });

      logger.info(`[CharacterAssetService] Deleted character asset: ${assetId}`);
      return { success: true };
    } catch (error) {
      logger.error(`[CharacterAssetService] Failed to delete character asset: ${error}`);
      throw error;
    }
  }

  /**
   * Get slim character list for AgentOS context injection
   */
  async getCharacterLibItems(projectId: string): Promise<Array<{ name: string; description?: string; alias?: string }>> {
    try {
      const assets = await prisma.characterAsset.findMany({
        where: { projectId },
        select: { name: true, description: true, alias: true },
        orderBy: { createdAt: 'asc' },
      });
      return assets.map((a) => ({
        name: a.name,
        description: a.description ?? undefined,
        alias: a.alias ?? undefined,
      }));
    } catch (error: unknown) {
      logger.warn({ projectId, error }, 'Failed to fetch character lib items, continuing without context');
      return [];
    }
  }

  // ── AssetAdapter implementation for createAssetRouter factory ─────────────

  async listAssets(projectId: string, userId: string): Promise<unknown> {
    return this.listCharacterAssets(projectId, userId);
  }

  async createAsset(projectId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.createCharacterAsset(projectId, data as unknown as CharacterAssetData);
  }

  async getAsset(projectId: string, assetId: string): Promise<unknown> {
    const asset = await prisma.characterAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.projectId !== projectId) {
      throw new Error('Character asset not found');
    }
    return asset;
  }

  async updateAsset(projectId: string, assetId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.updateCharacterAsset(projectId, assetId, data);
  }

  async deleteAsset(projectId: string, assetId: string): Promise<unknown> {
    return this.deleteCharacterAsset(projectId, assetId);
  }

  async persistExtracted(projectId: string, extractedData: Record<string, unknown>): Promise<void> {
    // Clear existing and save newly extracted characters
    await prisma.characterRelation.deleteMany({ where: { nodeA: { projectId } } });
    await prisma.characterAsset.deleteMany({ where: { projectId } });

    const newChars = Array.isArray((extractedData as { new_characters?: unknown[] }).new_characters)
      ? (extractedData as { new_characters: Record<string, unknown>[] }).new_characters
      : [];

    for (const char of newChars) {
      try {
        await prisma.characterAsset.create({
          data: {
            projectId,
            name: (char.name as string) || '未命名角色',
            description:
              (char.description as string | undefined) ||
              (char.personality as string | undefined) ||
              undefined,
            alias: (char.alias as string | undefined) || undefined,
            images: [],
          },
        });
      } catch (saveErr) {
        logger.warn({ saveErr, projectId, charName: char.name }, 'Failed to save extracted character');
      }
    }
  }

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
