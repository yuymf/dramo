/**
 * Storyboard event handlers
 * 分镜页面事件处理函数
 */

import { useCallback } from 'react';
import { api } from '@/lib/api/client';
import { saveJSON, addProjectGeneratedAsset } from '@/lib/storage/local';
import { saveStoryboardData } from '@/lib/api/client';
import type { ImageItem } from '@/lib/models';
import type { FrameData } from '@/lib/types/storyboard';
import type { DragEndEvent } from '@dnd-kit/core';

export interface StoryboardHandlersOptions {
  projectId: string;
  frames: FrameData[];
  setFrames: (frames: FrameData[] | ((prev: FrameData[]) => FrameData[])) => void;
  frameImages: Map<string, ImageItem>;
  setFrameImages: (images: Map<string, ImageItem> | ((prev: Map<string, ImageItem>) => Map<string, ImageItem>)) => void;
  assets: {
    characters: Array<{ id: string; name: string; description?: string; alias?: string; images: ImageItem[] }>;
    locations: Array<{ id: string; name: string; description?: string; alias?: string; images: ImageItem[] }>;
  };
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Replace character/location names with descriptions
 */
export function replaceNamesWithDescriptions(
  basePrompt: string,
  frameCharacters: string[],
  frameLocations: string[],
  assets: StoryboardHandlersOptions['assets']
): string {
  let prompt = basePrompt;

  // Helper: escape regex special characters and use a CJK-compatible boundary
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const makeBoundaryRegex = (name: string) => {
    const escaped = escapeRegex(name);
    return new RegExp(`(?<![\\w\\u4e00-\\u9fff])${escaped}(?![\\w\\u4e00-\\u9fff])`, 'g');
  };

  // Replace character names
  frameCharacters.forEach((charName) => {
    const asset = assets.characters.find((c) => c.name === charName);
    if (asset && asset.description) {
      const regex = makeBoundaryRegex(charName);
      prompt = prompt.replace(regex, asset.description);
    }
  });

  // Replace location names
  frameLocations.forEach((locName) => {
    const asset = assets.locations.find((l) => l.name === locName);
    if (asset && asset.description) {
      const regex = makeBoundaryRegex(locName);
      prompt = prompt.replace(regex, asset.description);
    }
  });

  return prompt;
}

/**
 * Create handlers for storyboard operations
 */
export function useStoryboardHandlers(options: StoryboardHandlersOptions) {
  const {
    projectId,
    frames,
    setFrames,
    frameImages,
    setFrameImages,
    assets,
    showToast,
  } = options;

  const handleGenerated = useCallback(
    async (frameId: string, images: ImageItem[]) => {
      if (images.length === 0) return;

      const newImage = images[0];
      setFrameImages((prev) => new Map(prev).set(frameId, newImage));
      showToast('图片已生成', 'success');

      const targetFrame = frames.find((f) => f.id === frameId);

      // Save to local storage
      const generatedAsset = {
        id: `gen_${Date.now()}`,
        projectId,
        frameId,
        name: targetFrame?.title ?? `Frame ${frameId}`,
        description: targetFrame?.description,
        images: images.map((img) => ({
          id: img.id,
          url: img.url,
          source: 'generated' as const,
          createdAt: img.createdAt,
        })),
        createdAt: new Date().toISOString(),
      };
      addProjectGeneratedAsset(projectId, generatedAsset);

      // Persist to backend
      try {
        await api(`/api/projects/${projectId}/storyboard/frames/${frameId}/image`, {
          method: 'PUT',
          body: { image: newImage },
        });
      } catch (err) {
        console.error('Failed to persist frame image to backend:', err);
      }
    },
    [projectId, setFrameImages, showToast, frames]
  );

  const handleDuplicate = useCallback(
    (frameId: string) => {
      const frame = frames.find((f) => f.id === frameId);
      if (!frame) return;

      const newFrame: FrameData = {
        ...frame,
        id: `frame_${Date.now()}`,
        order: frame.order + 1,
        title: `${frame.title} (副本)`,
      };

      const index = frames.findIndex((f) => f.id === frameId);
      const newFrames = [...frames];
      newFrames.splice(index + 1, 0, newFrame);

      // Reorder immutably
      const reorderedFrames = newFrames.map((f, i) => ({ ...f, order: i + 1 }));

      setFrames(reorderedFrames);
      showToast('分镜已复制', 'success');
    },
    [frames, setFrames, showToast]
  );

  const handleDelete = useCallback(
    (frameId: string) => {
      if (frames.length <= 1) {
        showToast('至少需要保留一个分镜', 'error');
        return;
      }

      const newFrames = frames
        .filter((f) => f.id !== frameId)
        .map((f, i) => ({ ...f, order: i + 1 }));

      setFrames(newFrames);
      const newImages = new Map(frameImages);
      newImages.delete(frameId);
      setFrameImages(newImages);
      showToast('分镜已删除', 'success');
    },
    [frames, frameImages, setFrames, setFrameImages, showToast]
  );

  const handleImageDrop = useCallback(
    async (frameId: string, imageUrl: string) => {
      const newImage: ImageItem = {
        id: `img_${Date.now()}`,
        url: imageUrl,
        source: 'upload',
        createdAt: new Date().toISOString(),
      };

      setFrameImages((prev) => new Map(prev).set(frameId, newImage));
      showToast('图片已添加到分镜', 'success');

      // Persist to backend
      try {
        await api(`/api/projects/${projectId}/storyboard/frames/${frameId}/image`, {
          method: 'PUT',
          body: { image: newImage },
        });
      } catch (err) {
        console.error('Failed to persist frame image to backend:', err);
      }
    },
    [projectId, setFrameImages, showToast]
  );

  const handleFrameChange = useCallback(
    (frameId: string, updates: Partial<FrameData>) => {
      setFrames((prevFrames) =>
        prevFrames.map((frame) =>
          frame.id === frameId ? { ...frame, ...updates } : frame
        )
      );
    },
    [setFrames]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = frames.findIndex((f) => f.id === String(active.id));
      const newIndex = frames.findIndex((f) => f.id === String(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFrames = [...frames];
        const [moved] = newFrames.splice(oldIndex, 1);
        newFrames.splice(newIndex, 0, moved);

        // Reorder immutably
        const reorderedFrames = newFrames.map((f, i) => ({ ...f, order: i + 1 }));

        setFrames(reorderedFrames);
      }
    },
    [frames, setFrames]
  );

  const handleAutoSave = useCallback(async () => {
    if (frames.length === 0) return;

    try {
      console.log('[Storyboard] Auto-saving', frames.length, 'frames to database...');
      await saveStoryboardData(projectId, frames);
      console.log('[Storyboard] Auto-save successful');
    } catch (error) {
      console.error('[Storyboard] Auto-save failed:', error);
      // Fallback to localStorage
      saveJSON(`storyboard_frames_data_${projectId}`, frames);
    }
  }, [frames, projectId]);

  return {
    handleGenerated,
    handleDuplicate,
    handleDelete,
    handleImageDrop,
    handleFrameChange,
    handleDragEnd,
    handleAutoSave,
    replaceNamesWithDescriptions: (basePrompt: string, frameCharacters: string[], frameLocations: string[]) =>
      replaceNamesWithDescriptions(basePrompt, frameCharacters, frameLocations, assets),
  };
}

