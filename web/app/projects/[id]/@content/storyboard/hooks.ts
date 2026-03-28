/**
 * Storyboard custom hooks
 * 分镜页面自定义 hooks
 */

import { useState, useEffect, useCallback } from 'react';
import { readJSON } from '@/lib/storage/local';
import { api, getStoryboardData } from '@/lib/api/client';
import { getProjectAssets } from '@/lib/utils/exporter';
import type { Script, StoryboardResponse, ImageItem } from '@/lib/models';
import type { FrameData } from '@/lib/types/storyboard';
import { scriptToFrames, storyboardJsonToFrames, getPlaceholderFrames } from './utils';

/**
 * Hook for loading frames from various sources
 */
export function useStoryboardFrames(projectId: string) {
  const [loading, setLoading] = useState(true);
  const [frames, setFrames] = useState<FrameData[]>([]);

  const loadFrames = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Try to load from database first
      let framesLoaded = false;
      try {
        const result = await getStoryboardData(projectId);
        if (result.success && result.frames && result.frames.length > 0) {
          console.log('[Storyboard] Loaded from database:', result.frames.length, 'frames');
          setFrames(result.frames as FrameData[]);
          framesLoaded = true;
        }
      } catch (error) {
        console.warn('[Storyboard] Failed to load from database, falling back to localStorage:', error);
      }

      // 2. If not loaded from database, try other sources
      if (!framesLoaded) {
        // Check for imported storyboard data in localStorage
        const storyboardData = readJSON<StoryboardResponse | null>(
          `storyboard_${projectId}`,
          null
        );

        if (storyboardData && storyboardData.scenes && storyboardData.scenes.length > 0) {
          // Use imported storyboard data
          const convertedFrames = storyboardJsonToFrames(storyboardData);
          setFrames(convertedFrames);
        } else {
          // Try to load script
          const draft = readJSON<Script | null>(`script_draft_${projectId}`, null);
          let script: Script | null = draft;

          if (!script) {
            try {
              script = await api<Script>(`/api/projects/${projectId}/script`);
            } catch {
              // Script not available
            }
          }

          if (script && script.scenes.length > 0) {
            const convertedFrames = scriptToFrames(script);
            setFrames(convertedFrames);
          } else {
            // No script, use placeholders
            setFrames(getPlaceholderFrames());
          }
        }
      }
    } catch (error) {
      console.error('[Storyboard] Failed to load frames:', error);
      setFrames(getPlaceholderFrames());
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadFrames();
  }, [loadFrames]);

  return { frames, setFrames, loading, reload: loadFrames };
}

/**
 * Hook for loading frame images
 */
export function useFrameImages(projectId: string) {
  const [frameImages, setFrameImages] = useState<Map<string, ImageItem>>(new Map());

  const loadFrameImages = useCallback(async () => {
    try {
      // 后端返回的是 Record<string, ImageItem>，而不是数组
      const response = await api<{
        success: boolean;
        images: Record<string, ImageItem> | Array<{ frameId: string; image: ImageItem }>;
      }>(`/api/projects/${projectId}/storyboard/frames/images`);

      if (response.success && response.images) {
        const imageMap = new Map<string, ImageItem>();
        
        // 处理两种格式：对象（Record）或数组
        if (Array.isArray(response.images)) {
          // 如果是数组格式（向后兼容）
          response.images.forEach(({ frameId, image }) => {
            imageMap.set(frameId, image);
          });
        } else {
          // 如果是对象格式（后端实际返回的格式）
          Object.entries(response.images).forEach(([frameId, image]) => {
            imageMap.set(frameId, image);
          });
        }
        
        setFrameImages(imageMap);
        console.log('[Storyboard] Loaded frame images:', imageMap.size, 'frames');
      }
    } catch (err) {
      console.error('Failed to load frame images from backend, using localStorage only:', err);
      // Fallback to localStorage
      const localImages = readJSON<Record<string, ImageItem>>(
        `storyboard_images_${projectId}`,
        {}
      );
      setFrameImages(new Map(Object.entries(localImages)));
    }
  }, [projectId]);

  useEffect(() => {
    loadFrameImages();
  }, [loadFrameImages]);

  return { frameImages, setFrameImages, reload: loadFrameImages };
}

/**
 * Hook for loading assets
 */
export function useStoryboardAssets(projectId: string) {
  const [assets, setAssets] = useState<{
    characters: Array<{ id: string; name: string; description?: string; alias?: string; images: ImageItem[] }>;
    locations: Array<{ id: string; name: string; description?: string; alias?: string; images: ImageItem[] }>;
  }>({ characters: [], locations: [] });

  const loadAssets = useCallback(async () => {
    try {
      console.log('[Storyboard] Loading assets...');
      const assetsData = await getProjectAssets(projectId);
      setAssets(assetsData);
      console.log('[Storyboard] Assets loaded:', assetsData.characters.length, 'characters,', assetsData.locations.length, 'locations');
    } catch (error) {
      console.error('Failed to load assets:', error);
    }
  }, [projectId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  return { assets, reload: loadAssets };
}