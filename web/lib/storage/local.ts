const PREFIX = 'als:'; // ai-live-script

function key(k: string) {
  return `${PREFIX}${k}`;
}

export function saveJSON<T>(k: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key(k), JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[localStorage] Failed to save key "${k}":`, error instanceof Error ? error.message : error);
    return false;
  }
}

export function readJSON<T>(k: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key(k));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function remove(k: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key(k));
  } catch {}
}

// Legacy favorites API — kept as no-op shims for backward compatibility.
// Favorites now live in the DB (`Inspiration.isFavorite`).
export const FAVORITES_KEY = 'inspirations_favorites'; // deprecated
export function addFavorite(_inspirationId: string, _text: string, _category: string) { /* moved to DB */ }
export function removeFavorite(_inspirationId: string) { /* moved to DB */ }
export function getFavorites(): Array<{ id: string; text: string; category: string; favoritedAt: string }> { return []; }

// Legacy script versions API — kept as no-op shims for backward compatibility.
// Versions now live in the DB (`ScriptVersion`).
export const VERSIONS_KEY_PREFIX = 'script_versions_'; // deprecated

export interface ScriptVersion {
  id: string;
  scriptId: string;
  versionNumber: number;
  description?: string;
  createdAt: string;
  snapshot: unknown; // Full script snapshot
}

// Shims retained for backward compatibility — no-ops (now in DB)
export function saveVersion(_scriptId: string, _snapshot: unknown, _description?: string): ScriptVersion {
  return { id: `v_noop_${Date.now()}`, scriptId: _scriptId, versionNumber: 0, createdAt: new Date().toISOString(), snapshot: _snapshot };
}

export function getVersions(_scriptId: string): ScriptVersion[] { return []; }

export function deleteVersion(_scriptId: string, _versionId: string) { /* moved to DB */ }

// Legacy character/location asset keys — kept as no-op shims; data is now in DB.
export const CHARACTER_ASSETS_KEY_PREFIX = 'character_assets_'; // deprecated
export const LOCATION_ASSETS_KEY_PREFIX = 'location_assets_'; // deprecated
export const GENERATED_ASSETS_KEY_PREFIX = 'generated_assets_';
export const RELATION_GRAPH_KEY_PREFIX = 'relation_graph_';

export interface CharacterImageAssetLocal {
  id: string;
  characterName: string;
  description?: string;
  alias?: string;
  images: Array<{
    id: string;
    url: string;
    width?: number;
    height?: number;
    source: 'upload' | 'generated' | 'reference';
    createdAt: string;
  }>;
  createdAt: string;
}

export interface LocationImageAssetLocal {
  id: string;
  locationName: string;
  description?: string;
  alias?: string;
  images: Array<{
    id: string;
    url: string;
    width?: number;
    height?: number;
    source: 'upload' | 'generated' | 'reference';
    createdAt: string;
  }>;
  createdAt: string;
}

// Shims retained for backward compatibility — no-ops (now in DB)
export function getProjectCharacterAssets(_projectId: string): CharacterImageAssetLocal[] { return []; }
export function setProjectCharacterAssets(_projectId: string, _assets: CharacterImageAssetLocal[]) { /* moved to DB */ }
export function addProjectCharacterAsset(_projectId: string, _asset: CharacterImageAssetLocal) { /* moved to DB */ }
export function deleteProjectCharacterAsset(_projectId: string, _assetId: string) { /* moved to DB */ }
export function updateProjectCharacterAsset(_projectId: string, _asset: CharacterImageAssetLocal) { /* moved to DB */ }

// Shims retained for backward compatibility — no-ops (now in DB)
export function getProjectLocationAssets(_projectId: string): LocationImageAssetLocal[] { return []; }
export function setProjectLocationAssets(_projectId: string, _assets: LocationImageAssetLocal[]) { /* moved to DB */ }
export function addProjectLocationAsset(_projectId: string, _asset: LocationImageAssetLocal) { /* moved to DB */ }
export function deleteProjectLocationAsset(_projectId: string, _assetId: string) { /* moved to DB */ }
export function updateProjectLocationAsset(_projectId: string, _asset: LocationImageAssetLocal) { /* moved to DB */ }

// Generated assets management (for storyboard generation results)
export interface GeneratedAssetLocal {
  id: string;
  name: string;
  description?: string;
  images: Array<{
    id: string;
    url: string;
    source: 'generated';
    createdAt: string;
  }>;
  createdAt: string;
}

export function getProjectGeneratedAssets(projectId: string) {
  return readJSON<GeneratedAssetLocal[]>(`${GENERATED_ASSETS_KEY_PREFIX}${projectId}`, []);
}

export function setProjectGeneratedAssets(projectId: string, assets: GeneratedAssetLocal[]) {
  saveJSON(`${GENERATED_ASSETS_KEY_PREFIX}${projectId}`, assets);
}

export function addProjectGeneratedAsset(projectId: string, asset: GeneratedAssetLocal) {
  const assets = getProjectGeneratedAssets(projectId);
  assets.unshift(asset); // Add to beginning
  setProjectGeneratedAssets(projectId, assets);
}

export function deleteProjectGeneratedAsset(projectId: string, assetId: string) {
  const assets = getProjectGeneratedAssets(projectId);
  const updated = assets.filter((a) => a.id !== assetId);
  setProjectGeneratedAssets(projectId, updated);
}

// Relation graph management
export interface RelationGraphLocal {
  id: string;
  projectId: string;
  nodes: Array<{ id: string; characterId: string; x: number; y: number }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    label?: string;
    type?: 'family' | 'friend' | 'colleague' | 'rival' | 'lover' | 'other';
  }>;
  updatedAt: string;
}

export function getRelationGraph(projectId: string): RelationGraphLocal | null {
  return readJSON<RelationGraphLocal | null>(`${RELATION_GRAPH_KEY_PREFIX}${projectId}`, null);
}

export function setRelationGraph(projectId: string, graph: RelationGraphLocal) {
  saveJSON(`${RELATION_GRAPH_KEY_PREFIX}${projectId}`, graph);
}

// Recent inputs management
export const RECENT_INPUTS_KEY_PREFIX = 'recent_inputs_';

export interface RecentInput {
  id: string;
  projectId: string;
  title: string;
  keyword?: string;
  summary?: string; // 首段摘要
  format: string; // script/dialogue/storyboard
  content: string; // live/film/short_drama/short_video/vlog
  createdAt: string;
}

export function getRecentInputs(projectId: string): RecentInput[] {
  return readJSON<RecentInput[]>(`${RECENT_INPUTS_KEY_PREFIX}${projectId}`, []);
}

export function addRecentInput(projectId: string, input: Omit<RecentInput, 'id' | 'projectId' | 'createdAt'>) {
  const inputs = getRecentInputs(projectId);
  const newInput: RecentInput = {
    ...input,
    id: `input_${Date.now()}`,
    projectId,
    createdAt: new Date().toISOString(),
  };
  // 最多保留 10 条
  inputs.unshift(newInput);
  if (inputs.length > 10) {
    inputs.pop();
  }
  saveJSON(`${RECENT_INPUTS_KEY_PREFIX}${projectId}`, inputs);
  return newInput;
}
