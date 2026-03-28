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

// Favorites management
export const FAVORITES_KEY = 'inspirations_favorites';

export function addFavorite(inspirationId: string, text: string, category: string) {
  const favorites = readJSON<Array<{ id: string; text: string; category: string; favoritedAt: string }>>(
    FAVORITES_KEY,
    []
  );
  if (favorites.find((f) => f.id === inspirationId)) return; // Already favorited
  favorites.push({
    id: inspirationId,
    text,
    category,
    favoritedAt: new Date().toISOString(),
  });
  saveJSON(FAVORITES_KEY, favorites);
}

export function removeFavorite(inspirationId: string) {
  const favorites = readJSON<Array<{ id: string; text: string; category: string; favoritedAt: string }>>(
    FAVORITES_KEY,
    []
  );
  const updated = favorites.filter((f) => f.id !== inspirationId);
  saveJSON(FAVORITES_KEY, updated);
}

export function getFavorites() {
  return readJSON<Array<{ id: string; text: string; category: string; favoritedAt: string }>>(
    FAVORITES_KEY,
    []
  );
}

// Version management
export const VERSIONS_KEY_PREFIX = 'script_versions_';

export interface ScriptVersion {
  id: string;
  scriptId: string;
  versionNumber: number;
  description?: string;
  createdAt: string;
  snapshot: unknown; // Full script snapshot
}

export function saveVersion(scriptId: string, snapshot: unknown, description?: string) {
  const versions = readJSON<ScriptVersion[]>(`${VERSIONS_KEY_PREFIX}${scriptId}`, []);
  const newVersion: ScriptVersion = {
    id: `v_${Date.now()}`,
    scriptId,
    versionNumber: versions.length + 1,
    description,
    createdAt: new Date().toISOString(),
    snapshot,
  };
  versions.push(newVersion);
  saveJSON(`${VERSIONS_KEY_PREFIX}${scriptId}`, versions);
  return newVersion;
}

export function getVersions(scriptId: string) {
  return readJSON<ScriptVersion[]>(`${VERSIONS_KEY_PREFIX}${scriptId}`, []);
}

export function deleteVersion(scriptId: string, versionId: string) {
  const versions = getVersions(scriptId);
  const updated = versions.filter((v) => v.id !== versionId);
  saveJSON(`${VERSIONS_KEY_PREFIX}${scriptId}`, updated);
}

// Project assets management
export const CHARACTER_ASSETS_KEY_PREFIX = 'character_assets_';
export const LOCATION_ASSETS_KEY_PREFIX = 'location_assets_';
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

export function getProjectCharacterAssets(projectId: string) {
  return readJSON<CharacterImageAssetLocal[]>(`${CHARACTER_ASSETS_KEY_PREFIX}${projectId}`, []);
}

export function setProjectCharacterAssets(projectId: string, assets: CharacterImageAssetLocal[]) {
  saveJSON(`${CHARACTER_ASSETS_KEY_PREFIX}${projectId}`, assets);
}

export function addProjectCharacterAsset(projectId: string, asset: CharacterImageAssetLocal) {
  const assets = getProjectCharacterAssets(projectId);
  assets.unshift(asset); // Add to beginning
  setProjectCharacterAssets(projectId, assets);
}

export function deleteProjectCharacterAsset(projectId: string, assetId: string) {
  const assets = getProjectCharacterAssets(projectId);
  const updated = assets.filter((a) => a.id !== assetId);
  setProjectCharacterAssets(projectId, updated);
}

export function updateProjectCharacterAsset(projectId: string, asset: CharacterImageAssetLocal) {
  const assets = getProjectCharacterAssets(projectId);
  const updated = assets.map((a) => (a.id === asset.id ? asset : a));
  setProjectCharacterAssets(projectId, updated);
}

export function getProjectLocationAssets(projectId: string) {
  return readJSON<LocationImageAssetLocal[]>(`${LOCATION_ASSETS_KEY_PREFIX}${projectId}`, []);
}

export function setProjectLocationAssets(projectId: string, assets: LocationImageAssetLocal[]) {
  saveJSON(`${LOCATION_ASSETS_KEY_PREFIX}${projectId}`, assets);
}

export function addProjectLocationAsset(projectId: string, asset: LocationImageAssetLocal) {
  const assets = getProjectLocationAssets(projectId);
  assets.unshift(asset);
  setProjectLocationAssets(projectId, assets);
}

export function deleteProjectLocationAsset(projectId: string, assetId: string) {
  const assets = getProjectLocationAssets(projectId);
  const updated = assets.filter((a) => a.id !== assetId);
  setProjectLocationAssets(projectId, updated);
}

export function updateProjectLocationAsset(projectId: string, asset: LocationImageAssetLocal) {
  const assets = getProjectLocationAssets(projectId);
  const updated = assets.map((a) => (a.id === asset.id ? asset : a));
  setProjectLocationAssets(projectId, updated);
}

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
