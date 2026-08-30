import { StorageService } from './storage.service';
import { logger } from '../lib/logger';
import { prisma } from '../lib/db';
import type { AssetAdapter } from '../lib/asset-route-factory';

export interface LocationAssetData {
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
 * Location Asset Service - handles location image generation and location asset CRUD
 */
export class LocationAssetService implements AssetAdapter {
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
  }

  /**
   * List location assets with lazy base64→URL migration
   */
  async listLocationAssets(projectId: string, _userId: string) {
    logger.info(`[LocationAssetService] Listing location assets for project ${projectId}`);

    try {
      const assets = await prisma.locationAsset.findMany({
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
                logger.info(`[LocationAssetService] Converting legacy base64 image in location asset ${asset.id}`);
                try {
                  const { url, path } = await this.storageService.uploadImageFromBase64(
                    projectId,
                    img.url,
                  );
                  return { ...img, url, path };
                } catch (error) {
                  logger.error(`[LocationAssetService] Failed to convert base64 for location asset ${asset.id}: ${error}`);
                  return img;
                }
              }
              return img;
            })
          );

          if (needsUpdate) {
            try {
              await prisma.locationAsset.update({
                where: { id: asset.id },
                data: { images: processedImages as any },
              });
              logger.info(`[LocationAssetService] Updated location asset ${asset.id} with converted URLs`);
            } catch (error) {
              logger.error(`[LocationAssetService] Failed to update location asset ${asset.id}: ${error}`);
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

      return { success: true, dataV2: processedAssets };
    } catch (error) {
      logger.error(`[LocationAssetService] Failed to list location assets: ${error}`);
      return { success: false, dataV2: [] };
    }
  }

  /**
   * Create location asset in DB, handling base64 image upload
   */
  async createLocationAsset(projectId: string, data: LocationAssetData) {
    try {
      const images = data.images ?? [];
      const processedImages = await Promise.all(
        images.map(async (img) => {
          if (img.url.startsWith('data:image/')) {
            logger.info('[LocationAssetService] Converting base64 to storage URL for location asset');
            const { url, path } = await this.storageService.uploadImageFromBase64(
              projectId,
              img.url
            );
            return { ...img, url, path };
          }
          return img;
        })
      );

      const asset = await prisma.locationAsset.create({
        data: {
          projectId,
          name: data.name,
          description: data.description,
          alias: data.alias,
          images: processedImages as any,
        },
      });

      logger.info(`[LocationAssetService] Created location asset: ${asset.id}`);
      return asset;
    } catch (error) {
      logger.error(`[LocationAssetService] Failed to create location asset: ${error}`);
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
      const existing = await prisma.locationAsset.findUnique({ where: { id: assetId } });

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

      logger.info(`[LocationAssetService] Updated location asset: ${asset.id}`);
      return { success: true, asset };
    } catch (error) {
      logger.error(`[LocationAssetService] Failed to update location asset: ${error}`);
      throw error;
    }
  }

  /**
   * Delete location asset
   */
  async deleteLocationAsset(projectId: string, assetId: string) {
    try {
      const existing = await prisma.locationAsset.findUnique({ where: { id: assetId } });

      if (!existing) {
        logger.warn(`[LocationAssetService] Delete called for non-existent location asset: ${assetId}`);
        return { success: true };
      }

      if (existing.projectId !== projectId) {
        logger.warn(`[LocationAssetService] Delete forbidden - asset ${assetId} not in project ${projectId}`);
        return { success: true };
      }

      await prisma.locationAsset.delete({ where: { id: assetId } });

      logger.info(`[LocationAssetService] Deleted location asset: ${assetId}`);
      return { success: true };
    } catch (error) {
      logger.error(`[LocationAssetService] Failed to delete location asset: ${error}`);
      throw error;
    }
  }

  /**
   * Get slim location list for AgentOS context injection
   */
  async getLocationLibItems(projectId: string): Promise<Array<{ name: string; description?: string; alias?: string }>> {
    try {
      const assets = await prisma.locationAsset.findMany({
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
      logger.warn({ projectId, error }, 'Failed to fetch location lib items, continuing without context');
      return [];
    }
  }

  // ── AssetAdapter implementation for createAssetRouter factory ─────────────

  async listAssets(projectId: string, userId: string): Promise<unknown> {
    return this.listLocationAssets(projectId, userId);
  }

  async createAsset(projectId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.createLocationAsset(projectId, data as unknown as LocationAssetData);
  }

  async getAsset(projectId: string, assetId: string): Promise<unknown> {
    const asset = await prisma.locationAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.projectId !== projectId) {
      throw new Error('Location asset not found');
    }
    return asset;
  }

  async updateAsset(projectId: string, assetId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.updateLocationAsset(projectId, assetId, data);
  }

  async deleteAsset(projectId: string, assetId: string): Promise<unknown> {
    return this.deleteLocationAsset(projectId, assetId);
  }

  async persistExtracted(projectId: string, extractedData: Record<string, unknown>): Promise<void> {
    let rawLocs = Array.isArray((extractedData as { locations?: unknown[] }).locations)
      ? (extractedData as { locations: Record<string, unknown>[] }).locations
      : [];

    // Unwrap nested: [ { locations: [...] } ] → [...]
    if (rawLocs.length > 0 && !rawLocs[0].name && Array.isArray((rawLocs[0] as Record<string, unknown>).locations)) {
      rawLocs = rawLocs.flatMap((item: Record<string, unknown>) =>
        Array.isArray(item.locations) ? (item.locations as Record<string, unknown>[]) : [item]
      );
    }

    if (rawLocs.length === 0) {
      throw new Error('No locations extracted');
    }

    await prisma.$transaction(async (tx) => {
      await tx.locationAsset.deleteMany({ where: { projectId } });

      for (const loc of rawLocs) {
        await tx.locationAsset.create({
          data: {
            projectId,
            name: (loc.name as string) || '未命名场景',
            description:
              (loc.description as string | undefined) ||
              (loc.atmosphere as string | undefined) ||
              undefined,
            alias: (loc.alias as string | undefined) || undefined,
            images: [],
          },
        });
      }
    });
  }
}
