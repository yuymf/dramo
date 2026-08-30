const PREFIX = 'dramo:';

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
