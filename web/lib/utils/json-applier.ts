import { api } from "@/lib/api/client";
import type { Script, CharacterImageAsset, LocationImageAssetV2, StoryboardResponse } from "@/lib/models";
import type { PageType } from "@/app/ai-chat-provider";

/**
 * 应用台本JSON修改
 * 将AI返回的JSON数据应用到后端并返回更新后的Script对象
 */
export async function applyScriptJson(
  projectId: string,
  json: object
): Promise<Script> {
  if (!json || typeof json !== 'object') {
    throw new Error("Invalid script data: expected an object");
  }

  const scriptData = json as Partial<Script>;

  // 如果修改了内容字段（scenes, acts），先PATCH
  const hasContentChanges = scriptData.scenes || scriptData.acts;
  if (hasContentChanges) {
    await api(`/api/projects/${projectId}/script/content`, {
      method: "PATCH",
      body: {
        scenes: scriptData.scenes,
        acts: scriptData.acts,
      },
    });
  }

  // 如果修改了元数据字段（title, topic等），需要完整更新
  const hasMetadataChanges = scriptData.title || scriptData.topic || scriptData.styles;
  if (hasMetadataChanges) {
    // 获取当前台本（包含刚 PATCH 的 scenes/acts）
    const currentScript = await api<Script>(`/api/projects/${projectId}/script`);

    // 仅合并元数据字段，不覆盖 scenes/acts（避免用 AI 的旧数据覆盖刚 PATCH 的）
    const { scenes: _s, acts: _a, ...metadataOnly } = scriptData;
    void _s; void _a;

    const updatedScript = await api<Script>(`/api/projects/${projectId}/script`, {
      method: "POST",
      body: {
        ...currentScript,
        ...metadataOnly,
      },
    });

    return updatedScript;
  }
  
  // 重新获取更新后的台本
  return await api<Script>(`/api/projects/${projectId}/script`);
}

/**
 * 应用角色JSON修改
 * 将AI返回的JSON数据应用到后端
 */
export async function applyCharactersJson(
  projectId: string,
  json: object
): Promise<void> {
  if (!json || typeof json !== 'object') {
    throw new Error("Invalid characters data: expected an object");
  }

  const data = json as { characters?: CharacterImageAsset[] };

  if (!data.characters || !Array.isArray(data.characters)) {
    throw new Error("Invalid characters data format: missing 'characters' array");
  }

  if (data.characters.length > 200) {
    throw new Error("Too many characters: maximum 200 allowed");
  }
  
  // 逐个更新或创建角色
  const failures: string[] = [];
  for (const char of data.characters) {
    try {
      // 检查角色是否存在
      const existing = await api<{ id: string }>(
        `/api/projects/${projectId}/characters/assets/${char.id}`,
        { method: "GET" }
      ).catch(() => null);

      if (existing) {
        // 更新现有角色
        await api(`/api/projects/${projectId}/characters/assets/${char.id}`, {
          method: "PUT",
          body: {
            name: char.characterName,
            description: char.description,
            alias: char.alias,
            images: char.images,
          },
        });
      } else {
        // 创建新角色
        await api(`/api/projects/${projectId}/characters/assets`, {
          method: "POST",
          body: {
            name: char.characterName,
            description: char.description,
            alias: char.alias,
            images: char.images || [],
          },
        });
      }
    } catch (error) {
      console.error(`Failed to update character ${char.characterName}:`, error);
      failures.push(char.characterName || char.id);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to update ${failures.length} character(s): ${failures.join(', ')}`);
  }
}

/**
 * 应用地点JSON修改
 * 将AI返回的JSON数据应用到后端
 */
export async function applyLocationsJson(
  projectId: string,
  json: object
): Promise<void> {
  if (!json || typeof json !== 'object') {
    throw new Error("Invalid locations data: expected an object");
  }

  const data = json as { locations?: LocationImageAssetV2[] };

  if (!data.locations || !Array.isArray(data.locations)) {
    throw new Error("Invalid locations data format: missing 'locations' array");
  }

  if (data.locations.length > 200) {
    throw new Error("Too many locations: maximum 200 allowed");
  }
  
  // 逐个更新或创建地点
  const failures: string[] = [];
  for (const loc of data.locations) {
    try {
      // 检查地点是否存在
      const existing = await api<{ id: string }>(
        `/api/projects/${projectId}/locations/assets/${loc.id}`,
        { method: "GET" }
      ).catch(() => null);

      if (existing) {
        // 更新现有地点
        await api(`/api/projects/${projectId}/locations/assets/${loc.id}`, {
          method: "PUT",
          body: {
            name: loc.locationName,
            description: loc.description,
            alias: loc.alias,
            images: loc.images,
          },
        });
      } else {
        // 创建新地点
        await api(`/api/projects/${projectId}/locations/assets`, {
          method: "POST",
          body: {
            name: loc.locationName,
            description: loc.description,
            alias: loc.alias,
            images: loc.images || [],
          },
        });
      }
    } catch (error) {
      console.error(`Failed to update location ${loc.locationName}:`, error);
      failures.push(loc.locationName || loc.id);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to update ${failures.length} location(s): ${failures.join(', ')}`);
  }
}

/**
 * 应用分镜JSON修改
 * 将AI返回的JSON数据应用到后端
 */
export async function applyStoryboardJson(
  projectId: string,
  json: object
): Promise<StoryboardResponse> {
  if (!json || typeof json !== 'object') {
    throw new Error("Invalid storyboard data: expected an object");
  }

  const storyboardData = json as StoryboardResponse;

  if (!storyboardData.scenes || !Array.isArray(storyboardData.scenes)) {
    throw new Error("Invalid storyboard data: missing 'scenes' array");
  }
  
  // 将StoryboardResponse转换为frames格式
  const frames: unknown[] = [];
  storyboardData.scenes.forEach(scene => {
    scene.shots.forEach(shot => {
      frames.push({
        sceneId: scene.id,
        sceneTitle: scene.title,
        sceneSummary: scene.summary,
        ...shot,
      });
    });
  });
  
  // 保存分镜数据
  await api(`/api/projects/${projectId}/storyboard-data`, {
    method: "PUT",
    body: { frames },
  });
  
  // 重新获取更新后的分镜数据
  await api<{ success: boolean; frames: unknown[] }>(
    `/api/projects/${projectId}/storyboard-data`
  );
  
  // 转换回StoryboardResponse格式
  // 这里需要根据实际的frames格式进行转换
  // 暂时返回原始数据
  return storyboardData;
}

/**
 * 根据页面类型应用JSON修改
 */
export async function applyJsonByPageType(
  projectId: string,
  pageType: PageType,
  json: object
): Promise<object> {
  switch (pageType) {
    case 'script':
      return await applyScriptJson(projectId, json);
    case 'characters':
      await applyCharactersJson(projectId, json);
      return { success: true };
    case 'locations':
      await applyLocationsJson(projectId, json);
      return { success: true };
    case 'storyboard':
      return await applyStoryboardJson(projectId, json);
    default:
      throw new Error(`Unknown page type: ${pageType}`);
  }
}

