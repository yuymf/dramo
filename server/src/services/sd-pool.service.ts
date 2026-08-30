import { config } from '../config';
import { logger } from '../lib/logger';

export const NO_SD_WORKER_MESSAGE = '没有可用的 Stable Diffusion worker';
export const SD_FAILURE_THRESHOLD = 3;
export const SD_HEALTH_TTL_MS = 30_000;
export const SD_HEALTH_TIMEOUT_MS = 5_000;
export const SD_TXT2IMG_TIMEOUT_MS = 180_000;
export const SD_DEFAULT_STEPS = 20;

export interface SdWorkerConfig {
  id: string;
  baseUrl: string;
  weight: number;
  capabilities: string[];
}

export interface SdWorkerRuntime extends SdWorkerConfig {
  queue: number;
  failCount: number;
  healthy: boolean;
}

export interface PickWorkerOptions {
  capability: string;
  stickyKey?: string;
}

export interface Txt2ImgParams {
  prompt: string;
  width: number;
  height: number;
  steps?: number;
}

export const DEFAULT_SD_WORKERS: SdWorkerConfig[] = [
  {
    id: 'sd-1',
    baseUrl: 'http://127.0.0.1:7860',
    weight: 1,
    capabilities: ['txt2img', 'img2img'],
  },
  {
    id: 'sd-2',
    baseUrl: 'http://127.0.0.1:7861',
    weight: 1,
    capabilities: ['txt2img'],
  },
];

/**
 * Parse SD_WORKERS JSON. Unset / blank → two default slots.
 * `[]` or invalid JSON → empty list (dispatch will fail with a readable error).
 */
export function parseSdWorkers(raw: string | undefined): SdWorkerConfig[] {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_SD_WORKERS.map((worker) => ({ ...worker, capabilities: [...worker.capabilities] }));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn('SD_WORKERS is not valid JSON; treating as empty worker list');
    return [];
  }

  if (!Array.isArray(parsed)) {
    logger.warn('SD_WORKERS must be a JSON array; treating as empty worker list');
    return [];
  }

  const workers: SdWorkerConfig[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== 'string' || !rec.id.trim()) continue;
    if (typeof rec.baseUrl !== 'string' || !rec.baseUrl.trim()) continue;
    const capabilities = Array.isArray(rec.capabilities)
      ? rec.capabilities.filter((cap): cap is string => typeof cap === 'string' && cap.length > 0)
      : ['txt2img'];
    const weight = typeof rec.weight === 'number' && rec.weight > 0 ? rec.weight : 1;
    workers.push({
      id: rec.id.trim(),
      baseUrl: rec.baseUrl.trim().replace(/\/$/, ''),
      weight,
      capabilities,
    });
  }
  return workers;
}

/**
 * Pure pick: live + capability match + shortest queue.
 * stickyKey (characterId / locationId) stays on the same worker when that worker is still eligible.
 */
export function selectWorker(
  workers: SdWorkerRuntime[],
  opts: PickWorkerOptions & { stickyWorkerId?: string | null }
): SdWorkerRuntime | null {
  const eligible = workers.filter(
    (worker) => worker.healthy && worker.capabilities.includes(opts.capability)
  );
  if (eligible.length === 0) return null;

  if (opts.stickyWorkerId) {
    const sticky = eligible.find((worker) => worker.id === opts.stickyWorkerId);
    if (sticky) return sticky;
  }

  const ranked = [...eligible].sort((a, b) => {
    if (a.queue !== b.queue) return a.queue - b.queue;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.id.localeCompare(b.id);
  });
  return ranked[0] ?? null;
}

export interface SdPoolOptions {
  workers?: SdWorkerConfig[];
  fetchImpl?: typeof fetch;
  probeOnPick?: boolean;
}

export class SdPoolService {
  private readonly workers: SdWorkerRuntime[];
  private readonly sticky = new Map<string, string>();
  private readonly fetchImpl: typeof fetch;
  private readonly probeOnPick: boolean;
  private lastHealthAt = 0;

  constructor(options?: SdPoolOptions) {
    const configs = options?.workers ?? parseSdWorkers(config.sdWorkers);
    this.workers = configs.map((worker) => ({
      ...worker,
      queue: 0,
      failCount: 0,
      healthy: true,
    }));
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.probeOnPick = options?.probeOnPick ?? true;
  }

  getRuntime(): SdWorkerRuntime[] {
    return this.workers.map((worker) => ({ ...worker, capabilities: [...worker.capabilities] }));
  }

  async pickWorker(opts: PickWorkerOptions): Promise<SdWorkerRuntime | null> {
    if (this.probeOnPick) {
      await this.refreshHealthIfStale();
    }

    const stickyWorkerId = opts.stickyKey ? this.sticky.get(opts.stickyKey) ?? null : null;
    const selected = selectWorker(this.workers, { ...opts, stickyWorkerId });
    if (!selected) return null;

    selected.queue += 1;
    if (opts.stickyKey) {
      this.sticky.set(opts.stickyKey, selected.id);
    }
    return { ...selected, capabilities: [...selected.capabilities] };
  }

  release(workerId: string): void {
    const worker = this.workers.find((item) => item.id === workerId);
    if (!worker) return;
    worker.queue = Math.max(0, worker.queue - 1);
  }

  markSuccess(workerId: string): void {
    const worker = this.workers.find((item) => item.id === workerId);
    if (!worker) return;
    worker.failCount = 0;
    worker.healthy = true;
  }

  markFailure(workerId: string): void {
    const worker = this.workers.find((item) => item.id === workerId);
    if (!worker) return;
    worker.failCount += 1;
    if (worker.failCount >= SD_FAILURE_THRESHOLD) {
      worker.healthy = false;
      logger.warn({ workerId, failCount: worker.failCount }, 'SD worker drained after consecutive failures');
    }
  }

  async txt2img(worker: Pick<SdWorkerConfig, 'id' | 'baseUrl'>, params: Txt2ImgParams): Promise<string> {
    const url = `${worker.baseUrl}/sdapi/v1/txt2img`;
    const body = {
      prompt: params.prompt,
      width: params.width,
      height: params.height,
      steps: params.steps ?? SD_DEFAULT_STEPS,
    };

    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SD_TXT2IMG_TIMEOUT_MS),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.markFailure(worker.id);
        throw new Error(`SD txt2img failed (${res.status}): ${text || res.statusText}`);
      }

      const payload = (await res.json()) as { images?: unknown };
      const image = Array.isArray(payload.images) ? payload.images[0] : undefined;
      if (typeof image !== 'string' || !image) {
        this.markFailure(worker.id);
        throw new Error('SD txt2img returned no images');
      }

      this.markSuccess(worker.id);
      return image;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('SD txt2img')) {
        throw err;
      }
      this.markFailure(worker.id);
      throw err;
    }
  }

  async refreshHealthIfStale(now = Date.now()): Promise<void> {
    if (now - this.lastHealthAt < SD_HEALTH_TTL_MS) return;
    await Promise.all(this.workers.map((worker) => this.probeWorker(worker)));
    this.lastHealthAt = now;
  }

  private async probeWorker(worker: SdWorkerRuntime): Promise<boolean> {
    const url = `${worker.baseUrl}/sdapi/v1/sd-models`;
    try {
      const res = await this.fetchImpl(url, {
        method: 'GET',
        signal: AbortSignal.timeout(SD_HEALTH_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.markFailure(worker.id);
        return false;
      }
      this.markSuccess(worker.id);
      return true;
    } catch (err) {
      this.markFailure(worker.id);
      logger.warn({ err, workerId: worker.id, url }, 'SD worker health probe failed');
      return false;
    }
  }
}

let sharedPool: SdPoolService | undefined;

export function getSdPool(): SdPoolService {
  if (!sharedPool) {
    sharedPool = new SdPoolService();
  }
  return sharedPool;
}

export function resetSdPoolForTests(): void {
  sharedPool = undefined;
}
