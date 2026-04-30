import { runImageGeneration } from '../lib/agentos-client';
import { StorageService } from './storage.service';
import { logger } from '../lib/logger';
import { CharacterAssetService } from './character-asset.service';
import { LocationAssetService } from './location-asset.service';

// Re-export domain types for consumers that import from asset.service
export type { Character3ViewRequest, CharacterAssetData } from './character-asset.service';
export type { LocationImageRequest, LocationAssetData } from './location-asset.service';

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
 * Asset Service - thin coordinator for unified image generation.
 * Character-specific and location-specific operations are delegated to their
 * focused services; this class handles the cross-domain generateImageUnified
 * method and preserves backward compatibility for existing route consumers.
 */
export class AssetService {
  private storageService: StorageService;
  private characterService: CharacterAssetService;
  private locationService: LocationAssetService;

  // ── Character delegation ─────────────────────────────────────────────────
  generateCharacter3View: CharacterAssetService['generateCharacter3View'];
  listCharacterAssets: CharacterAssetService['listCharacterAssets'];
  createCharacterAsset: CharacterAssetService['createCharacterAsset'];
  updateCharacterAsset: CharacterAssetService['updateCharacterAsset'];
  deleteCharacterAsset: CharacterAssetService['deleteCharacterAsset'];
  getCharacterLibItems: CharacterAssetService['getCharacterLibItems'];

  // ── Location delegation ──────────────────────────────────────────────────
  generateLocationImage: LocationAssetService['generateLocationImage'];
  listLocationAssets: LocationAssetService['listLocationAssets'];
  createLocationAsset: LocationAssetService['createLocationAsset'];
  updateLocationAsset: LocationAssetService['updateLocationAsset'];
  deleteLocationAsset: LocationAssetService['deleteLocationAsset'];
  getLocationLibItems: LocationAssetService['getLocationLibItems'];

  constructor() {
    this.storageService = new StorageService();
    this.characterService = new CharacterAssetService();
    this.locationService = new LocationAssetService();

    this.generateCharacter3View = this.characterService.generateCharacter3View.bind(this.characterService);
    this.listCharacterAssets = this.characterService.listCharacterAssets.bind(this.characterService);
    this.createCharacterAsset = this.characterService.createCharacterAsset.bind(this.characterService);
    this.updateCharacterAsset = this.characterService.updateCharacterAsset.bind(this.characterService);
    this.deleteCharacterAsset = this.characterService.deleteCharacterAsset.bind(this.characterService);
    this.getCharacterLibItems = this.characterService.getCharacterLibItems.bind(this.characterService);

    this.generateLocationImage = this.locationService.generateLocationImage.bind(this.locationService);
    this.listLocationAssets = this.locationService.listLocationAssets.bind(this.locationService);
    this.createLocationAsset = this.locationService.createLocationAsset.bind(this.locationService);
    this.updateLocationAsset = this.locationService.updateLocationAsset.bind(this.locationService);
    this.deleteLocationAsset = this.locationService.deleteLocationAsset.bind(this.locationService);
    this.getLocationLibItems = this.locationService.getLocationLibItems.bind(this.locationService);
  }

  // ── Cross-domain ─────────────────────────────────────────────────────────

  /**
   * Unified image generation endpoint.
   * Supports single/sequence generation with optional reference images.
   * Auto-saves result to DB when assetType is provided.
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
      const prompt = this.buildPrompt(request.description, request.style);

      let referenceUrls: string[] = [];
      if (request.referenceImages && request.referenceImages.length > 0) {
        logger.info(`[AssetService] Using ${request.referenceImages.length} reference image URLs`);
        referenceUrls = request.referenceImages;
      } else {
        logger.info('[AssetService] No reference images provided');
      }

      const result = await runImageGeneration({
        prompt,
        referenceImages: referenceUrls,
        mode: request.mode || 'single',
        stream: false,
        style: request.style,
      }, { llmHeaders });

      logger.info(`[AssetService] Generated ${result.images.length} images`);

      const uploadedUrls = await Promise.all(
        result.images.map((img) => this.storageService.uploadImageFromUrl(projectId, img.url) as Promise<string>)
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
    } catch (error) {
      logger.error(`[AssetService] Unified image generation failed: ${error}`);
      throw error;
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
