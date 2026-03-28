import { logger } from '../lib/logger';
import { prisma } from '../lib/db';

export interface Dialogue {
  speaker?: string; // Speaker name or "旁白" for narration
  text: string;
  type?: 'dialogue' | 'narration'; // why: disambiguate narration vs spoken
}

export interface FramePrompts {
  textToImage?: string; // Text-to-image prompt (from AgentOS)
  imageGuided?: string; // Image-guided prompt (derived on frontend, persisted)
  textToVideo?: string; // Text-to-video prompt (from AgentOS)
}

export interface FrameData {
  id: string;
  order: number;
  title: string;
  sceneType?: 'INT.' | 'EXT.';
  timeOfDay?: '日' | '夜';
  description: string;
  bulletPoints: string[];
  image?: {
    id: string;
    url: string;
    source: string;
    createdAt: string;
  };
  shot_number?: string;
  shot_size?: string;
  duration_seconds?: number;
  scene_description?: string;
  director_notes?: string;
  audio_description?: string;
  camera_angle?: string;
  camera_movement?: string;
  focal_length?: string;
  style?: string;
  referenceImages?: string[];
  referencePaths?: string[];
  // New enrichment fields (why: enrich frame semantics without breaking old data)
  characters?: string[]; // Character names in this frame
  locations?: string[]; // Location names in this frame
  dialogues?: Dialogue[]; // Dialogues and narration
  prompts?: FramePrompts; // Generation prompts
}

/**
 * Storyboard Data Service - handles complete storyboard frames persistence
 */
export class StoryboardDataService {
  /**
   * Get storyboard frames for a project
   */
  async getStoryboard(projectId: string): Promise<FrameData[]> {
    logger.info(`[StoryboardDataService] Getting storyboard for project ${projectId}`);

    try {
      const storyboard = await prisma.storyboard.findUnique({
        where: { projectId },
      });

      if (!storyboard) {
        logger.info(`[StoryboardDataService] No storyboard found for project ${projectId}, returning empty`);
        return [];
      }

      const frames = storyboard.frames as unknown as FrameData[];
      logger.info(`[StoryboardDataService] Found ${frames.length} frames for project ${projectId}`);
      return frames;
    } catch (error) {
      logger.error(`[StoryboardDataService] Failed to get storyboard: ${error}`);
      throw error;
    }
  }

  /**
   * Save/update storyboard frames for a project
   */
  async saveStoryboard(projectId: string, frames: FrameData[]): Promise<void> {
    logger.info(`[StoryboardDataService] Saving ${frames.length} frames for project ${projectId}`);

    try {
      await prisma.storyboard.upsert({
        where: { projectId },
        create: {
          projectId,
          frames: frames as any,
        },
        update: {
          frames: frames as any,
          updatedAt: new Date(),
        },
      });

      logger.info(`[StoryboardDataService] Successfully saved storyboard for project ${projectId}`);
    } catch (error) {
      logger.error(`[StoryboardDataService] Failed to save storyboard: ${error}`);
      throw error;
    }
  }

  /**
   * Update a single frame in the storyboard
   */
  async updateFrame(projectId: string, frameId: string, updates: Partial<FrameData>): Promise<void> {
    logger.info(`[StoryboardDataService] Updating frame ${frameId} in project ${projectId}`);

    try {
      const storyboard = await prisma.storyboard.findUnique({
        where: { projectId },
      });

      if (!storyboard) {
        throw new Error(`Storyboard not found for project ${projectId}`);
      }

      const frames = storyboard.frames as unknown as FrameData[];
      const frameIndex = frames.findIndex((f) => f.id === frameId);

      if (frameIndex === -1) {
        throw new Error(`Frame ${frameId} not found in storyboard`);
      }

      frames[frameIndex] = { ...frames[frameIndex], ...updates };

      await prisma.storyboard.update({
        where: { projectId },
        data: {
          frames: frames as any,
          updatedAt: new Date(),
        },
      });

      logger.info(`[StoryboardDataService] Successfully updated frame ${frameId}`);
    } catch (error) {
      logger.error(`[StoryboardDataService] Failed to update frame: ${error}`);
      throw error;
    }
  }

  /**
   * Delete storyboard for a project
   */
  async deleteStoryboard(projectId: string): Promise<void> {
    logger.info(`[StoryboardDataService] Deleting storyboard for project ${projectId}`);

    try {
      await prisma.storyboard.delete({
        where: { projectId },
      });

      logger.info(`[StoryboardDataService] Successfully deleted storyboard for project ${projectId}`);
    } catch (error) {
      logger.error(`[StoryboardDataService] Failed to delete storyboard: ${error}`);
      throw error;
    }
  }
}

