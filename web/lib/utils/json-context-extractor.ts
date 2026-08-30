import type { Script, CharacterImageAsset, LocationImageAssetV2, StoryboardResponse } from "@/lib/models";
import type { PageType } from "@/app/ai-chat-provider";

/**
 * 从路径判断当前页面类型
 */
export function getCurrentPageType(pathname: string | null): PageType {
  if (!pathname) return null;
  if (pathname.includes('/scripts')) return 'script';
  if (pathname.includes('/characters')) return 'characters';
  if (pathname.includes('/locations')) return 'locations';
  if (pathname.includes('/storyboard')) return 'storyboard';
  return null;
}

/**
 * 提取台本JSON数据
 * 返回完整的Script对象，便于AI理解和修改
 */
export function extractScriptJson(script: Script | null | undefined): object | null {
  if (!script) return null;
  
  // 返回完整的Script对象，包含所有字段
  return {
    id: script.id,
    projectId: script.projectId,
    title: script.title,
    topic: script.topic,
    form: script.form,
    contentType: script.contentType,
    styles: script.styles,
    goal: script.goal,
    status: script.status,
    acts: (script.acts ?? []).map(act => ({
      id: act.id,
      name: act.name,
      order: act.order,
      sceneIds: act.sceneIds,
    })),
    scenes: (script.scenes ?? []).map(scene => ({
      id: scene.id,
      title: scene.title,
      description: scene.description,
      isEXT: scene.isEXT,
      isDay: scene.isDay,
      order: scene.order,
      content: (scene.content ?? []).map(block => ({
        id: block.id,
        label: block.label,
        text: block.text, // HTML内容
      })),
    })),
    createdAt: script.createdAt,
    updatedAt: script.updatedAt,
  };
}

/**
 * 提取角色JSON数据
 * 返回角色资产数组的完整JSON表示
 */
export function extractCharactersJson(
  characters: CharacterImageAsset[] | null | undefined
): object | null {
  if (!characters || characters.length === 0) return null;
  
  return {
    characters: characters.map(char => ({
      id: char.id,
      characterName: char.characterName,
      description: char.description,
      alias: char.alias,
      images: char.images.map(img => ({
        id: img.id,
        url: img.url,
        width: img.width,
        height: img.height,
        source: img.source,
        createdAt: img.createdAt,
      })),
      createdAt: char.createdAt,
    })),
    totalCount: characters.length,
  };
}

/**
 * 提取地点JSON数据
 * 返回地点资产数组的完整JSON表示
 */
export function extractLocationsJson(
  locations: LocationImageAssetV2[] | null | undefined
): object | null {
  if (!locations || locations.length === 0) return null;
  
  return {
    locations: locations.map(loc => ({
      id: loc.id,
      locationName: loc.locationName,
      description: loc.description,
      alias: loc.alias,
      images: loc.images.map(img => ({
        id: img.id,
        url: img.url,
        width: img.width,
        height: img.height,
        source: img.source,
        createdAt: img.createdAt,
      })),
      createdAt: loc.createdAt,
    })),
    totalCount: locations.length,
  };
}

/**
 * 提取分镜JSON数据
 * 返回StoryboardResponse的完整JSON表示
 */
export function extractStoryboardJson(
  storyboard: StoryboardResponse | null | undefined
): object | null {
  if (!storyboard) return null;
  
  return {
    projectId: storyboard.projectId,
    scenes: storyboard.scenes.map(scene => ({
      id: scene.id,
      title: scene.title,
      summary: scene.summary,
      shots: scene.shots.map(shot => ({
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
      })),
    })),
    totalScenes: storyboard.scenes.length,
    totalShots: storyboard.scenes.reduce((sum, scene) => sum + scene.shots.length, 0),
  };
}

