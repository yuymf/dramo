import { logger } from '../lib/logger';
import { prisma } from '../lib/db';

interface ImageItem {
  id: string;
  url: string;
  width?: number;
  height?: number;
  source: 'upload' | 'generated' | 'reference';
  createdAt: string;
}

/**
 * Storyboard Service - handles storyboard frame image persistence
 */
export class StoryboardService {
  /**
   * Get all frame images for a project
   */
  async getFrameImages(projectId: string): Promise<Record<string, ImageItem>> {
    logger.info(`[StoryboardService] Getting frame images for project ${projectId}`);

    try {
      const frameImages = await prisma.storyboardFrameImage.findMany({
        where: { projectId },
      });

      const result: Record<string, ImageItem> = {};
      frameImages.forEach((item: { frameId: string; image: unknown }) => {
        result[item.frameId] = item.image as unknown as ImageItem;
      });

      return result;
    } catch (error) {
      logger.error(`[StoryboardService] Failed to get frame images: ${error}`);
      return {};
    }
  }

  /**
   * Set/update image for a specific frame
   */
  async setFrameImage(
    projectId: string,
    frameId: string,
    image: ImageItem
  ): Promise<void> {
    logger.info(`[StoryboardService] Setting image for frame ${frameId} in project ${projectId}`);

    try {
      await prisma.storyboardFrameImage.upsert({
        where: {
          projectId_frameId: {
            projectId,
            frameId,
          },
        },
        update: {
          image: image as any,
          updatedAt: new Date(),
        },
        create: {
          projectId,
          frameId,
          image: image as any,
          updatedAt: new Date(),
        },
      });

      logger.info(`[StoryboardService] Successfully set frame image`);
    } catch (error) {
      logger.error(`[StoryboardService] Failed to set frame image: ${error}`);
      throw error;
    }
  }

  /**
   * Delete image for a specific frame
   */
  async deleteFrameImage(projectId: string, frameId: string): Promise<void> {
    logger.info(`[StoryboardService] Deleting image for frame ${frameId} in project ${projectId}`);

    try {
      await prisma.storyboardFrameImage.deleteMany({
        where: {
          projectId,
          frameId,
        },
      });

      logger.info(`[StoryboardService] Successfully deleted frame image`);
    } catch (error) {
      logger.error(`[StoryboardService] Failed to delete frame image: ${error}`);
      throw error;
    }
  }
}

