/**
 * Storyboard Page - Visual frame-by-frame storyboard with generation
 */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Loader2, Download, Monitor, Share2, Plus, RefreshCw, Trash2, Minus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { FrameCard } from "@/components/storyboard/FrameCard";
import type { FrameData } from "@/lib/types/storyboard";
import { SavedAssetsPanel } from "@/components/storyboard/SavedAssetsPanel";
import { GeneratorModal } from "@/components/storyboard/GeneratorModal";
import { useToast } from "@/components/ui/Toast";
import { readJSON, saveJSON, addProjectGeneratedAsset, type GeneratedAssetLocal } from "@/lib/storage/local";
import { api, getStoryboardData, saveStoryboardData } from "@/lib/api/client";
import { getProjectAssets } from "@/lib/utils/exporter";
import { cn } from "@/lib/utils";
import type { ImageItem, StoryboardResponse } from "@/lib/models";
import { useGenerationJobs } from "@/lib/hooks/useGenerationJobs";
import { useAIChat } from "@/app/ai-chat-provider";
import { extractStoryboardJson } from "@/lib/utils/json-context-extractor";

// Convert Storyboard JSON to Frame data
function storyboardJsonToFrames(data: StoryboardResponse): FrameData[] {
  const frames: FrameData[] = [];
  let order = 1;
  
  data.scenes.forEach(scene => {
    scene.shots.forEach(shot => {
      // Parse scene title to extract type and time
      const isEXT = scene.title.toUpperCase().includes('EXT');
      const isNight = scene.title.includes('夜') || scene.title.toUpperCase().includes('NIGHT');
      
      frames.push({
        id: `${scene.id}-${shot.shot_number}`,
        order: order++,
        title: scene.title,
        sceneType: isEXT ? 'EXT.' : 'INT.',
        timeOfDay: isNight ? '夜' : '日',
        description: scene.summary,
        bulletPoints: [],
        
        // Shot-specific fields
        shot_number: shot.shot_number,
        shot_size: shot.shot_size,
        duration_seconds: shot.duration_seconds,
        scene_description: shot.scene_description,
        director_notes: shot.director_notes,
        audio_description: shot.audio_description,
        camera_angle: shot.camera_angle,
        camera_movement: shot.camera_movement,
        focal_length: shot.focal_length,
        
        // New enrichment fields (why: map AgentOS output to frontend)
        characters: shot.characters || [],
        locations: shot.locations || [],
        dialogues: shot.dialogues || [],
        prompts: shot.prompts || {},
      });
    });
  });
  
  return frames;
}

// Default placeholder frames
function getPlaceholderFrames(): FrameData[] {
  return [
    {
      id: "placeholder_1",
      order: 1,
      title: "开场镜头",
      sceneType: "EXT.",
      timeOfDay: "日",
      description: "城市全景，阳光明媚",
      bulletPoints: ["镜头从天空缓缓降下", "展现城市的繁华", "配乐轻快愉悦"],
      characters: [],
      locations: ["城市"],
    },
    {
      id: "placeholder_2",
      order: 2,
      title: "主角登场",
      sceneType: "INT.",
      timeOfDay: "日",
      description: "咖啡馆内，温馨舒适",
      bulletPoints: ["主角坐在窗边", "手捧咖啡若有所思", "阳光洒在脸上"],
      characters: ["七海"],
      locations: ["咖啡厅"],
    },
    {
      id: "placeholder_3",
      order: 3,
      title: "转折时刻",
      sceneType: "EXT.",
      timeOfDay: "日",
      description: "街道上，人来人往",
      bulletPoints: ["突然接到电话", "表情变得严肃", "匆忙离开咖啡馆"],
      characters: ["七海"],
      locations: ["街道"],
    },
    {
      id: "placeholder_4",
      order: 4,
      title: "关键对话",
      sceneType: "INT.",
      timeOfDay: "夜",
      description: "办公室内，灯光昏暗",
      bulletPoints: ["两人激烈争论", "气氛紧张压抑", "矛盾逐渐升级"],
      characters: ["七海", "雄摩"],
      locations: ["办公室"],
    },
    {
      id: "placeholder_5",
      order: 5,
      title: "情感爆发",
      sceneType: "EXT.",
      timeOfDay: "夜",
      description: "雨夜街头，霓虹闪烁",
      bulletPoints: ["主角在雨中奔跑", "泪水与雨水交织", "背景音乐高潮"],
      characters: ["七海"],
      locations: ["街道"],
    },
    {
      id: "placeholder_6",
      order: 6,
      title: "和解桥段",
      sceneType: "INT.",
      timeOfDay: "日",
      description: "温馨的家中客厅",
      bulletPoints: ["两人相视而笑", "矛盾得到化解", "阳光透过窗帘"],
      characters: ["七海", "雄摩"],
      locations: ["家"],
    },
    {
      id: "placeholder_7",
      order: 7,
      title: "高潮场景",
      sceneType: "EXT.",
      timeOfDay: "日",
      description: "海边悬崖，波涛汹涌",
      bulletPoints: ["最终决战时刻", "紧张刺激的动作", "命运的抉择"],
      characters: ["七海"],
      locations: ["海边"],
    },
    {
      id: "placeholder_8",
      order: 8,
      title: "结局画面",
      sceneType: "EXT.",
      timeOfDay: "日",
      description: "日落海滩，宁静祥和",
      bulletPoints: ["主角眺望远方", "露出释然的笑容", "画面渐渐淡出"],
      characters: ["七海"],
      locations: ["海滩"],
    },
  ];
}

export default function StoryboardPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [frameImages, setFrameImages] = useState<Map<string, ImageItem>>(new Map());
  const [zoom, setZoom] = useState(100);
  const [assetsPanelCollapsed, setAssetsPanelCollapsed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatorModal, setGeneratorModal] = useState<{
    frameId: string;
    frameTitle: string;
    frameDescription: string;
    frameBulletPoints: string[];
    referenceImages: string[];
  } | null>(null);
  const [assets, setAssets] = useState<{
    characters: Array<{ id: string; name: string; description?: string; alias?: string; images: ImageItem[] }>;
    locations: Array<{ id: string; name: string; description?: string; alias?: string; images: ImageItem[] }>;
  }>({ characters: [], locations: [] });

  const { showToast } = useToast();
  const { jobs } = useGenerationJobs();
  const { updateJsonData } = useAIChat();
  const [storyboardData, setStoryboardData] = useState<StoryboardResponse | null>(null);
  
  // 页面初始化日志
  useEffect(() => {
    console.log('[Storyboard] Component mounted/initialized:', {
      timestamp: new Date().toISOString(),
      hasJobs: jobs.size > 0,
      jobsCount: jobs.size,
      jobIds: Array.from(jobs.keys())
    });
  }, [jobs]);
  
  // 添加jobs状态变化监听
  useEffect(() => {
    console.log('[Storyboard] Jobs state updated:', {
      timestamp: new Date().toISOString(),
      totalJobs: jobs.size,
      jobIds: Array.from(jobs.keys()),
      activeJobs: Array.from(jobs.values()).filter(job => 
        job.status === 'queued' || job.status === 'running'
      ).length
    });
  }, [jobs]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load script and convert to frames
  useEffect(() => {
    async function loadFrames() {
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
          setStoryboardData(storyboardData); // 保存用于AI上下文
        } else {
          // No data available, use placeholders
          setFrames(getPlaceholderFrames());
          setStoryboardData(null);
        }
        }

        // Load saved frame images from backend
        try {
          const backendImages = await api<{ success: boolean; images: Record<string, ImageItem> }>(
            `/api/projects/${projectId}/storyboard/frames/images`
          );
          
          // Also load from localStorage as fallback
          const localImages = readJSON<Record<string, ImageItem>>(
            `storyboard_frames_${projectId}`,
            {}
          );

          // Merge backend and local images (backend takes precedence)
          const mergedImages = { ...localImages, ...backendImages.images };
          setFrameImages(new Map(Object.entries(mergedImages)));
        } catch (err) {
          // 静默处理 404 错误（数据为空时正常情况）
          const apiError = err as Error & { status?: number };
          if (apiError.status === 404) {
            console.log('[Storyboard] No frame images in backend, using localStorage only');
          } else {
            console.warn('[Storyboard] Failed to load frame images from backend, using localStorage only:', err);
          }
          // Fallback to localStorage only
          const localImages = readJSON<Record<string, ImageItem>>(
            `storyboard_frames_${projectId}`,
            {}
          );
          setFrameImages(new Map(Object.entries(localImages)));
        }

        // Load assets - 确保这段代码总是执行
        console.log('[Storyboard] Loading assets...');
        const assetsData = await getProjectAssets(projectId);
        console.log('[Storyboard] Assets loaded:', assetsData.characters.length, 'characters,', assetsData.locations.length, 'locations');
        setAssets(assetsData);
      } catch (err) {
        console.error("Failed to load frames:", err);
        setFrames(getPlaceholderFrames());
      } finally {
        setLoading(false);
      }
    }

    loadFrames();
  }, [projectId]);

  // 注册到AI聊天上下文：当storyboardData变化时更新JSON数据
  useEffect(() => {
    if (storyboardData) {
      const jsonData = extractStoryboardJson(storyboardData);
      updateJsonData(jsonData);
    } else {
      // 如果没有storyboardData，尝试从frames构建
      if (frames.length > 0 && !frames.every(frame => frame.id?.startsWith('placeholder_'))) {
        // 从frames构建StoryboardResponse格式
        const constructedData: StoryboardResponse = {
          projectId,
          scenes: [], // 这里需要根据frames构建scenes，暂时留空
        };
        const jsonData = extractStoryboardJson(constructedData);
        updateJsonData(jsonData);
      } else {
        updateJsonData(null);
      }
    }
  }, [storyboardData, frames, projectId, updateJsonData]);

  // 监听AI修改数据事件，刷新storyboard
  useEffect(() => {
    const handleDataUpdated = async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.pageType === 'storyboard' && projectId) {
        try {
          // 重新加载分镜数据
          const result = await getStoryboardData(projectId);
          if (result.success && result.frames && result.frames.length > 0) {
            setFrames(result.frames as FrameData[]);
          }
          // 重新加载storyboard JSON
          const storyboardData = readJSON<StoryboardResponse | null>(
            `storyboard_${projectId}`, 
            null
          );
          if (storyboardData) {
            setStoryboardData(storyboardData);
          }
          showToast("数据已更新", "success");
        } catch (err) {
          console.error("Failed to reload storyboard after AI update:", err);
        }
      }
    };

    window.addEventListener('ai-chat-data-updated', handleDataUpdated);
    return () => {
      window.removeEventListener('ai-chat-data-updated', handleDataUpdated);
    };
  }, [projectId, showToast]);

  // Save frame images to localStorage
  useEffect(() => {
    const obj = Object.fromEntries(frameImages);
    saveJSON(`storyboard_frames_${projectId}`, obj);
  }, [frameImages, projectId]);

  // Auto-save frames to database (debounced)
  useEffect(() => {
    if (frames.length === 0) return;

    // 检查是否是 placeholder frames（数据为空时的占位符）
    const isPlaceholderData = frames.every(frame => frame.id?.startsWith('placeholder_'));
    if (isPlaceholderData) {
      // 跳过保存 placeholder 数据
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        console.log('[Storyboard] Auto-saving', frames.length, 'frames to database...');
        await saveStoryboardData(projectId, frames);
        console.log('[Storyboard] Auto-save successful');
      } catch (error) {
        // 静默处理保存失败（可能是数据为空或网络问题）
        const apiError = error as Error & { status?: number };
        if (apiError.status === 404) {
          console.log('[Storyboard] Storyboard data not found in backend, saving to localStorage only');
        } else {
          console.warn('[Storyboard] Auto-save failed, saving to localStorage only:', error);
        }
        // Fallback to localStorage
        saveJSON(`storyboard_frames_data_${projectId}`, frames);
      }
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(timeoutId);
  }, [frames, projectId]);

  // Helper: Replace character/location names with descriptions (why: reduce ambiguity in multi-entity scenes)
  const replaceNamesWithDescriptions = useCallback((
    basePrompt: string,
    frameCharacters: string[] = [],
    frameLocations: string[] = []
  ): string => {
    let prompt = basePrompt;

    // Helper: escape regex special characters and use a CJK-compatible boundary
    // \b doesn't work for CJK characters, so we use negative lookbehind/lookahead for word chars
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const makeBoundaryRegex = (name: string) => {
      const escaped = escapeRegex(name);
      // Use a pattern that works for both CJK and Latin: match the name not preceded/followed by same-class chars
      return new RegExp(`(?<![\\w\\u4e00-\\u9fff])${escaped}(?![\\w\\u4e00-\\u9fff])`, 'g');
    };

    // Replace character names
    frameCharacters.forEach(charName => {
      const asset = assets.characters.find(c => c.name === charName);
      if (asset && asset.description) {
        const regex = makeBoundaryRegex(charName);
        prompt = prompt.replace(regex, asset.description);
      }
    });

    // Replace location names
    frameLocations.forEach(locName => {
      const asset = assets.locations.find(l => l.name === locName);
      if (asset && asset.description) {
        const regex = makeBoundaryRegex(locName);
        prompt = prompt.replace(regex, asset.description);
      }
    });

    return prompt;
  }, [assets]);

  // Handlers
  const handleGenerate = useCallback(
    (frameId: string) => {
      const frame = frames.find((f) => f.id === frameId);
      if (!frame) return;

      // 使用 frame.referenceImages（由"刷新参考照片"添加的图片）
      // 如果为空，则根据 characters/locations 自动获取（避免用户忘记刷新）
      let referenceImages: string[] = [];
      
      if (frame.referenceImages && frame.referenceImages.length > 0) {
        // 用户已刷新参考照片，直接使用（额外去重保护）
        referenceImages = Array.from(new Set(frame.referenceImages));
      } else {
        // 用户未刷新，自动从资产库获取（使用 Set 去重）
        const referenceImagesSet = new Set<string>();
        
        // Match characters from frame.characters (只取首图)
        if (frame.characters && frame.characters.length > 0) {
          frame.characters.forEach(charName => {
            const asset = assets.characters.find(c => c.name === charName);
            if (asset && asset.images.length > 0) {
              referenceImagesSet.add(asset.images[0].url);
            }
          });
        }
        
        // Match locations from frame.locations (只取首图)
        if (frame.locations && frame.locations.length > 0) {
          frame.locations.forEach(locName => {
            const asset = assets.locations.find(l => l.name === locName);
            if (asset && asset.images.length > 0) {
              referenceImagesSet.add(asset.images[0].url);
            }
          });
        }
        
        referenceImages = Array.from(referenceImagesSet);
      }
      
      // Auto decision: image-guided if references exist, text-only otherwise
      const hasReferences = referenceImages.length > 0;
      let defaultPrompt = '';
      
      if (hasReferences) {
        // Image-guided mode: use or derive imageGuided prompt
        if (frame.prompts?.imageGuided) {
          defaultPrompt = frame.prompts.imageGuided;
        } else if (frame.prompts?.textToImage) {
          // Derive imageGuided from textToImage by replacing names
          const derivedPrompt = replaceNamesWithDescriptions(
            frame.prompts.textToImage,
            frame.characters,
            frame.locations
          );
          defaultPrompt = derivedPrompt;
          
          // Persist derived prompt back to frame (why: reuse on next generation)
          handleFrameChange(frameId, {
            prompts: {
              ...frame.prompts,
              imageGuided: derivedPrompt,
            },
          });
        } else {
          // Fallback: construct from scene description
          defaultPrompt = frame.scene_description || frame.description || '';
        }
      } else {
        // Text-only mode: use textToImage or fallback
        defaultPrompt = frame.prompts?.textToImage || frame.scene_description || frame.description || '';
      }

      setGeneratorModal({
        frameId,
        frameTitle: frame.title,
        frameDescription: defaultPrompt, // Pass computed prompt as description
        frameBulletPoints: frame.bulletPoints,
        referenceImages: referenceImages.slice(0, 4), // Max 4 references
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frames, assets, replaceNamesWithDescriptions]
  );

  // 持久化 prompt 到 frame
  const handlePersistPrompt = useCallback(
    (frameId: string, prompt: string, hasReferences: boolean) => {
      // 根据是否有参考图决定持久化到哪个字段
      const promptKey = hasReferences ? 'imageGuided' : 'textToImage';
      
      setFrames((prevFrames) =>
        prevFrames.map((frame) =>
          frame.id === frameId
            ? {
                ...frame,
                prompts: {
                  ...frame.prompts,
                  [promptKey]: prompt,
                },
              }
            : frame
        )
      );
    },
    []
  );

  const handleGenerated = useCallback(
    async (frameId: string, images: ImageItem[]) => {
      if (images.length > 0) {
        const newImage = images[0];
        setFrameImages((prev) => new Map(prev).set(frameId, newImage));
        showToast("图片生成成功！", "success");

        // Store to generated assets collection
        const frame = frames.find((f) => f.id === frameId);
        const generatedAsset: GeneratedAssetLocal = {
          id: `gen_${Date.now()}`,
          name: frame?.title || "生成图片",
          description: frame?.description,
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
          console.error("Failed to persist frame image to backend:", err);
          // Still saved locally, no need to show error
        }
      }
    },
    [projectId, showToast, frames]
  );

  // Auto-update frame images when generation jobs complete
  useEffect(() => {
    console.log('[Storyboard] Checking jobs for completion:', {
      totalJobs: jobs.size,
      jobIds: Array.from(jobs.keys()),
      timestamp: new Date().toISOString()
    });
    
    // Check all jobs for completed ones with frameId and resultUrl
    const jobsArray = Array.from(jobs.values());
    jobsArray.forEach((job) => {
      if (
        job.status === 'succeeded' &&
        job.frameId &&
        job.resultUrl &&
        !frameImages.has(job.frameId) // Only update if image not already set
      ) {
        console.log('[Storyboard] Auto-updating frame image from completed job:', {
          jobId: job.id,
          frameId: job.frameId,
          resultUrl: job.resultUrl,
          status: job.status,
          progress: job.progress
        });

        // Convert resultUrl to ImageItem format
        const newImage: ImageItem = {
          id: `gen_${job.id}`,
          url: job.resultUrl,
          source: 'generated',
          createdAt: job.updatedAt || job.createdAt,
        };

        // Call handleGenerated to update the frame image
        handleGenerated(job.frameId, [newImage]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]); // Only depend on jobs, handleGenerated and frameImages are stable

  // Also listen for custom generation:completed events
  useEffect(() => {
    const handleGenerationCompleted = (event: Event) => {
      const { frameId, image } = (event as CustomEvent).detail;
      console.log('[Storyboard] Received generation:completed event:', { frameId, imageUrl: image.url });
      
      if (frameId && image && !frameImages.has(frameId)) {
        handleGenerated(frameId, [image]);
      }
    };

    window.addEventListener('generation:completed', handleGenerationCompleted);
    return () => {
      window.removeEventListener('generation:completed', handleGenerationCompleted);
    };
  }, [frameImages, handleGenerated]);

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
      showToast("分镜已复制", "success");
    },
    [frames, showToast]
  );

  const handleDelete = useCallback(
    (frameId: string) => {
      if (frames.length <= 1) {
        showToast("至少需要保留一个分镜", "error");
        return;
      }

      const newFrames = frames
        .filter((f) => f.id !== frameId)
        .map((f, i) => ({ ...f, order: i + 1 }));

      setFrames(newFrames);
      setFrameImages((prev) => {
        const next = new Map(prev);
        next.delete(frameId);
        return next;
      });
      showToast("分镜已删除", "success");
    },
    [frames, showToast]
  );

  const handleImageDrop = useCallback(
    async (frameId: string, imageUrl: string) => {
      const newImage: ImageItem = {
        id: `img_${Date.now()}`,
        url: imageUrl,
        source: "upload",
        createdAt: new Date().toISOString(),
      };

      setFrameImages((prev) => new Map(prev).set(frameId, newImage));
      showToast("图片已添加到分镜", "success");

      // Persist to backend
      try {
        await api(`/api/projects/${projectId}/storyboard/frames/${frameId}/image`, {
          method: 'PUT',
          body: { image: newImage },
        });
      } catch (err) {
        console.error("Failed to persist frame image to backend:", err);
        // Still saved locally, no need to show error
      }
    },
    [projectId, showToast]
  );

  const handleFrameChange = useCallback(
    (frameId: string, updates: Partial<FrameData>) => {
      setFrames((prevFrames) =>
        prevFrames.map((frame) =>
          frame.id === frameId ? { ...frame, ...updates } : frame
        )
      );
    },
    []
  );

  const handleAddFrame = useCallback(() => {
    const newFrame: FrameData = {
      id: `frame_${Date.now()}`,
      order: frames.length + 1,
      title: "新场景",
      sceneType: "INT.",
      timeOfDay: "日",
      description: "请编辑场景描述",
      bulletPoints: [],
      style: "线稿",
    };

    setFrames([...frames, newFrame]);
    showToast("新分镜已添加", "success");
  }, [frames, showToast]);

  const handleInsertAfter = useCallback(
    (frameId: string) => {
      const frame = frames.find((f) => f.id === frameId);
      if (!frame) return;

      const newFrame: FrameData = {
        id: `frame_${Date.now()}`,
        order: frame.order + 1,
        title: "新场景",
        sceneType: "INT.",
        timeOfDay: "日",
        description: "请编辑场景描述",
        bulletPoints: [],
        style: "线稿",
      };

      const index = frames.findIndex((f) => f.id === frameId);
      const newFrames = [...frames];
      newFrames.splice(index + 1, 0, newFrame);

      // Reorder immutably
      const reorderedFrames = newFrames.map((f, i) => ({ ...f, order: i + 1 }));

      setFrames(reorderedFrames);
      showToast("新分镜已插入", "success");
    },
    [frames, showToast]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = frames.findIndex((f) => f.id === active.id);
        const newIndex = frames.findIndex((f) => f.id === over.id);

        const reordered = arrayMove(frames, oldIndex, newIndex).map((f, i) => ({
          ...f,
          order: i + 1,
        }));

        setFrames(reordered);
      }
    },
    [frames]
  );

  // 刷新参考照片：基于每帧的角色/地点在资产库搜索匹配（名称或别名，模糊包含），仅添加首图，并去重
  const handleRefreshReferences = useCallback(() => {
    setRefreshing(true);
    
    try {
      console.log('=== 刷新参考照片调试 ===');
      console.log('总帧数:', frames.length);
      console.log('帧数据示例:', frames[0]);
      console.log('角色资产数量:', assets.characters.length);
      console.log('地点资产数量:', assets.locations.length);
      
      // 1. 构建可匹配索引（直接使用已加载的 assets，包含 alias）
      interface MatchableAsset {
        name: string;
        alias?: string;
        image?: { url: string; path?: string };
        type: 'character' | 'location';
      }
      
      const matchableAssets: MatchableAsset[] = [];
      
      // 从角色资产构建索引
      assets.characters.forEach((asset) => {
        if (asset.images && asset.images.length > 0) {
          const firstImage = asset.images[0];
          matchableAssets.push({
            name: asset.name,
            alias: asset.alias,
            image: {
              url: firstImage.url,
              path: (firstImage as { path?: string }).path,
            },
            type: 'character',
          });
        }
      });
      
      // 从地点资产构建索引
      assets.locations.forEach((asset) => {
        if (asset.images && asset.images.length > 0) {
          const firstImage = asset.images[0];
          matchableAssets.push({
            name: asset.name,
            alias: asset.alias,
            image: {
              url: firstImage.url,
              path: (firstImage as { path?: string }).path,
            },
            type: 'location',
          });
        }
      });
      
      console.log('可匹配资产数量:', matchableAssets.length);
      console.log('可匹配资产示例:', matchableAssets.slice(0, 2));
      
      // 3. 遍历每帧，匹配并更新参考图
      let totalAdded = 0;
      
      const updatedFrames = frames.map((frame, frameIndex) => {
        const currentImages = new Set(frame.referenceImages || []);
        const newImages: string[] = [...(frame.referenceImages || [])];
        const newPaths: string[] = [...(frame.referencePaths || [])];
        
        // 收集该帧需要匹配的术语（去重）
        const termsSet = new Set<string>();
        if (frame.characters) frame.characters.forEach(c => termsSet.add(c));
        if (frame.locations) frame.locations.forEach(l => termsSet.add(l));
        const terms = Array.from(termsSet);
        
        if (frameIndex === 0) {
          console.log(`帧 ${frame.id} - 角色:`, frame.characters, '地点:', frame.locations);
          console.log('匹配术语:', terms);
        }
        
        // 对每个术语进行匹配
        terms.forEach((term) => {
          const termLower = term.toLowerCase();
          
          matchableAssets.forEach((asset) => {
            const nameLower = asset.name.toLowerCase();
            const aliasLower = asset.alias?.toLowerCase() || '';
            
            // 完全匹配（名称或别称）
            const nameMatch = nameLower === termLower;
            const aliasMatch = aliasLower && aliasLower === termLower;
            
            if ((nameMatch || aliasMatch) && asset.image) {
              // 去重：检查 URL 是否已存在
              if (!currentImages.has(asset.image.url)) {
                newImages.push(asset.image.url);
                newPaths.push(asset.image.path || '');
                currentImages.add(asset.image.url);
                totalAdded++;
              }
            }
          });
        });
        
        // 返回更新后的帧（仅在有新增时更新）
        if (newImages.length > (frame.referenceImages?.length || 0)) {
          return {
            ...frame,
            referenceImages: newImages,
            referencePaths: newPaths,
          };
        }
        
        return frame;
      });
      
      // 4. 更新状态
      setFrames(updatedFrames);
      
      // 5. 显示 Toast
      if (totalAdded > 0) {
        showToast(`已为分镜添加 ${totalAdded} 张参考图片`, 'success');
      } else {
        showToast('未找到可匹配的参考图片', 'info');
      }
    } catch (error) {
      console.error('刷新参考照片失败:', error);
      showToast('刷新参考照片失败', 'error');
    } finally {
      setRefreshing(false);
    }
  }, [frames, assets, showToast]);

  // 清空所有参考照片
  const handleClearReferences = useCallback(() => {
    const updatedFrames = frames.map((frame) => ({
      ...frame,
      referenceImages: [],
      referencePaths: [],
    }));
    
    setFrames(updatedFrames);
    showToast('已清空所有参考照片', 'success');
  }, [frames, showToast]);

  // Merge frames with images
  const framesWithImages = useMemo(() => {
    return frames.map((frame) => ({
      ...frame,
      image: frameImages.get(frame.id),
    }));
  }, [frames, frameImages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--at-bg)] animate-fade-in">
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="w-8 h-8 text-[var(--at-text-tertiary)] animate-spin" />
          <p className="text-sm font-medium text-[var(--at-text-secondary)] mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--at-bg)]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-[var(--at-border)] px-6 py-3 flex items-center justify-between bg-[var(--at-surface)]">
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold text-[var(--at-text)] tracking-tight">分镜</h1>
              <span className="text-xs font-medium text-[var(--at-accent)] bg-[var(--at-accent-light)] px-2 py-0.5 rounded-full">{frames.length}</span>
            </div>
            <div className="w-px h-4 bg-[var(--at-border)]" />
            <div className="flex items-center gap-1">
              <button
                onClick={handleRefreshReferences}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] transition-colors disabled:opacity-50"
                aria-label="刷新参考照片"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                刷新参考照片
              </button>
              <button
                onClick={handleClearReferences}
                className="flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                aria-label="清空参考照片"
              >
                <Trash2 size={14} />
                清空
              </button>
              <div className="w-px h-4 bg-[var(--at-border)]" />
              <button
                className="flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] transition-colors"
                aria-label="下载"
              >
                <Download size={14} />
                Download
              </button>
              <button
                className="flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] transition-colors"
                aria-label="演示"
              >
                <Monitor size={14} />
                Present
              </button>
              <button
                className="flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg bg-[var(--at-accent)] text-[var(--at-text-inverse)] hover:bg-[var(--at-accent-hover)] transition-colors"
                aria-label="分享"
              >
                <Share2 size={14} />
                Share
              </button>
            </div>
          </div>

          {/* Zoom Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              className="p-1.5 rounded-md text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] transition-colors"
              aria-label="缩小"
            >
              <Minus size={14} />
            </button>
            <div className="relative w-32 h-2 rounded-full overflow-hidden bg-[var(--at-border)]">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all"
                style={{
                  width: `${((zoom - 50) / 100) * 100}%`,
                  background: 'var(--at-accent)',
                  opacity: 0.6,
                }}
              />
              <input
                type="range"
                min="50"
                max="150"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="缩放"
              />
            </div>
            <button
              onClick={() => setZoom(Math.min(150, zoom + 10))}
              className="p-1.5 rounded-md text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] transition-colors"
              aria-label="放大"
            >
              <Plus size={14} />
            </button>
            <span className="text-xs w-12 text-right font-mono text-[var(--at-text-tertiary)]">
              {zoom}%
            </span>
          </div>
        </div>

        {/* Frames Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={frames.map((f) => f.id)}
              strategy={rectSortingStrategy}
            >
              <div
                className={cn(
                  "grid gap-4 transition-all duration-200",
                  "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                )}
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "top left",
                }}
              >
                {framesWithImages.map((frame) => (
                  <FrameCard
                    key={frame.id}
                    frame={frame}
                    onGenerate={handleGenerate}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                    onImageDrop={handleImageDrop}
                    onChange={handleFrameChange}
                    onInsertAfter={handleInsertAfter}
                    projectId={projectId}
                    assets={assets}
                  />
                ))}

                {/* Add Frame Card */}
                <button
                  onClick={handleAddFrame}
                  className="aspect-[16/10] bg-[var(--at-surface)] border border-dashed border-[var(--at-border)] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[var(--at-accent)] hover:bg-[var(--at-accent-light)] transition-colors cursor-pointer"
                  aria-label="添加分镜"
                >
                  <Plus className="w-8 h-8 text-[var(--at-text-tertiary)]" />
                  <span className="text-sm font-medium text-[var(--at-text-tertiary)]">Add Frame</span>
                </button>
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Assets Panel */}
      <SavedAssetsPanel
        projectId={projectId}
        collapsed={assetsPanelCollapsed}
        onToggleCollapse={() => setAssetsPanelCollapsed(!assetsPanelCollapsed)}
      />

      {/* Generator Modal */}
      {generatorModal && (
        <GeneratorModal
          projectId={projectId}
          frameId={generatorModal.frameId}
          frameTitle={generatorModal.frameTitle}
          frameDescription={generatorModal.frameDescription}
          frameBulletPoints={generatorModal.frameBulletPoints}
          referenceImages={generatorModal.referenceImages}
          onClose={() => setGeneratorModal(null)}
          onGenerated={handleGenerated}
          onPersistPrompt={handlePersistPrompt}
        />
      )}
    </div>
  );
}
