import { StorageService } from './storage.service';
import { logger } from '../lib/logger';
import { prisma } from '../lib/db';
import type { AssetAdapter } from '../lib/asset-route-factory';

export type GraphPosition = { x: number; y: number };

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
  position?: GraphPosition;
}

function parsePosition(value: unknown): GraphPosition | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const p = value as { x?: unknown; y?: unknown };
  if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
  return undefined;
}

/**
 * Character Asset Service — character asset CRUD
 */
export class CharacterAssetService implements AssetAdapter {
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
  }

  async listCharacterAssets(projectId: string, _userId: string) {
    logger.info(`[CharacterAssetService] Listing character assets for project ${projectId}`);

    try {
      const assets = await prisma.characterAsset.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      return {
        data: assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          description: asset.description ?? undefined,
          alias: asset.alias ?? undefined,
          images: Array.isArray(asset.images) ? asset.images : [],
          position: parsePosition(asset.position),
          createdAt: asset.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      logger.error(`[CharacterAssetService] Failed to list character assets: ${error}`);
      return { data: [] };
    }
  }

  /**
   * Create character asset in DB, handling base64 image upload
   */
  async createCharacterAsset(projectId: string, data: CharacterAssetData) {
    try {
      const images = data.images ?? [];
      const processedImages = await Promise.all(
        images.map(async (img) => {
          if (img.url.startsWith('data:image/')) {
            logger.info('[CharacterAssetService] Converting base64 to storage URL for character asset');
            const { url, path } = await this.storageService.uploadImageFromBase64(
              projectId,
              img.url
            );
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
          alias: data.alias,
          images: processedImages as any,
          ...(data.position && { position: data.position }),
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
      position?: GraphPosition;
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
          ...(data.position && { position: data.position }),
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
      return assets.map((a: { name: string; description: string | null; alias: string | null }) => ({
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

  async updateAsset(projectId: string, assetId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.updateCharacterAsset(projectId, assetId, data);
  }

  async deleteAsset(projectId: string, assetId: string): Promise<unknown> {
    return this.deleteCharacterAsset(projectId, assetId);
  }

  async persistExtracted(projectId: string, extractedData: Record<string, unknown>): Promise<void> {
    const newChars = Array.isArray((extractedData as { new_characters?: unknown[] }).new_characters)
      ? (extractedData as { new_characters: Record<string, unknown>[] }).new_characters
      : [];

    if (newChars.length === 0) {
      throw new Error('No characters extracted');
    }

    await prisma.$transaction(async (tx) => {
      await tx.characterRelation.deleteMany({ where: { nodeA: { projectId } } });
      await tx.characterAsset.deleteMany({ where: { projectId } });

      for (const char of newChars) {
        await tx.characterAsset.create({
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
      }
    });
  }
}
