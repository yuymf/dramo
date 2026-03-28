/**
 * Storyboard utility functions
 * 分镜页面工具函数
 */

import type { Script, StoryboardResponse } from '@/lib/models';
import type { FrameData } from '@/lib/types/storyboard';

/**
 * Strip HTML tags from text
 */
export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Parse scene title into components
 */
export function parseSceneTitle(title: string) {
  const parts = title.split('|');
  const mainPart = parts[0]?.trim() || '';
  const description = parts[1]?.trim() || '';

  const match = mainPart.match(/^(EXT\.|INT\.)?\s*(.+?)(?:\s*[-–—]\s*(.+))?$/);
  if (match) {
    const [, type, name, time] = match;
    return {
      type: (type || 'INT.') as 'INT.' | 'EXT.',
      name: name?.trim() || '',
      time: (time?.trim() || '日') as '日' | '夜',
      description: description,
    };
  }
  return {
    type: 'INT.' as 'INT.' | 'EXT.',
    name: mainPart || '',
    time: '日' as '日' | '夜',
    description: description,
  };
}

/**
 * Convert Script to Frame data
 */
export function scriptToFrames(script: Script): FrameData[] {
  const orderedActs = [...script.acts].sort((a, b) => a.order - b.order);
  const sceneById = new Map(script.scenes.map((s) => [s.id, s]));

  const frames: FrameData[] = [];
  let order = 1;

  orderedActs.forEach((act) => {
    act.sceneIds.forEach((sceneId) => {
      const scene = sceneById.get(sceneId);
      if (!scene) return;

      const parsed = parseSceneTitle(scene.title);
      const bulletPoints = scene.content
        .slice(0, 3)
        .map((block) => stripHtml(block.text))
        .filter((text) => text.trim().length > 0);

      frames.push({
        id: scene.id,
        order,
        title: parsed.name,
        sceneType: parsed.type,
        timeOfDay: parsed.time,
        description: parsed.description,
        bulletPoints,
        // 初始化空的角色和地点数组（用户需要手动填充或从其他来源导入）
        characters: [],
        locations: [],
      });

      order++;
    });
  });

  return frames;
}

/**
 * Convert Storyboard JSON to Frame data
 */
export function storyboardJsonToFrames(data: StoryboardResponse): FrameData[] {
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

        characters: shot.characters || [],
        locations: shot.locations || [],
        dialogues: shot.dialogues || [],
        prompts: shot.prompts || {},
      });
    });
  });

  return frames;
}

/**
 * Get placeholder frames for empty storyboard
 */
export function getPlaceholderFrames(): FrameData[] {
  return [
    {
      id: 'placeholder_1',
      order: 1,
      title: '开场',
      sceneType: 'INT.',
      timeOfDay: '日',
      description: '直播间开场',
      bulletPoints: ['欢迎观众', '介绍主题', '建立氛围'],
      characters: [],
      locations: [],
    },
    {
      id: 'placeholder_2',
      order: 2,
      title: '核心内容',
      sceneType: 'INT.',
      timeOfDay: '日',
      description: '主要内容展示',
      bulletPoints: ['核心信息', '关键点讲解', '互动环节'],
      characters: [],
      locations: [],
    },
    {
      id: 'placeholder_3',
      order: 3,
      title: '收尾',
      sceneType: 'INT.',
      timeOfDay: '日',
      description: '结束与感谢',
      bulletPoints: ['总结要点', '感谢观看', '下期预告'],
      characters: [],
      locations: [],
    },
  ];
}

