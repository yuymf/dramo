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

export const GENERATED_ASSETS_KEY_PREFIX = 'generated_assets_';

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
  assets.unshift(asset);
  setProjectGeneratedAssets(projectId, assets);
}

export function deleteProjectGeneratedAsset(projectId: string, assetId: string) {
  const assets = getProjectGeneratedAssets(projectId);
  setProjectGeneratedAssets(projectId, assets.filter((a) => a.id !== assetId));
}
