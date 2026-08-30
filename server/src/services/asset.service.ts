import { runImageGeneration } from '../lib/agentos-client';
import { StorageService } from './storage.service';
import { logger } from '../lib/logger';
import { CharacterAssetService } from './character-asset.service';
import { LocationAssetService } from './location-asset.service';

interface UnifiedImageRequest {
  name: string;
  description: string;
  style?: string;
  referenceImages?: string[];
  mode?: 'single' | 'sequence';
  assetType?: 'character' | 'location';
}

export class AssetService {
  private storageService = new StorageService();
  private characterService = new CharacterAssetService();
  private locationService = new LocationAssetService();

  async generateImageUnified(
    projectId: string,
    _userId: string,
    request: UnifiedImageRequest,
    llmHeaders?: Record<string, string>
  ) {
    logger.info(
      `[AssetService] Unified generation: mode=${request.mode}, refs=${request.referenceImages?.length || 0}, type=${request.assetType}`
    );

    const result = await runImageGeneration({
      prompt: this.buildPrompt(request.description, request.style),
      referenceImages: request.referenceImages ?? [],
      mode: request.mode || 'single',
      stream: false,
      style: request.style,
    }, { llmHeaders });

    const uploadedUrls = await Promise.all(
      result.images.map((img) => this.storageService.uploadImageFromUrl(projectId, img.url))
    );

    const images = uploadedUrls.map((url, idx) => ({
      id: `img_${Date.now()}_${idx}`,
      url,
      source: 'generated' as const,
      createdAt: new Date().toISOString(),
    }));

    if (request.assetType === 'character') {
      await this.characterService.createCharacterAsset(projectId, {
        name: request.name,
        description: request.description,
        images,
      });
    } else if (request.assetType === 'location') {
      await this.locationService.createLocationAsset(projectId, {
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
      prompt = `${prompt}. Style: ${styleMap[style] || style}`;
    }
    return prompt;
  }
}
