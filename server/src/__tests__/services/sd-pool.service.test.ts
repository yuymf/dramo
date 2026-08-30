import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  parseSdWorkers,
  selectWorker,
  SdPoolService,
  DEFAULT_SD_WORKERS,
  SD_FAILURE_THRESHOLD,
  type SdWorkerRuntime,
} from '../../services/sd-pool.service';

function runtime(
  overrides: Partial<SdWorkerRuntime> & Pick<SdWorkerRuntime, 'id'>
): SdWorkerRuntime {
  return {
    baseUrl: `http://127.0.0.1/${overrides.id}`,
    weight: 1,
    capabilities: ['txt2img'],
    queue: 0,
    failCount: 0,
    healthy: true,
    ...overrides,
  };
}

describe('parseSdWorkers', () => {
  it('returns two default slots when unset', () => {
    expect(parseSdWorkers(undefined)).toEqual(DEFAULT_SD_WORKERS);
    expect(parseSdWorkers('')).toEqual(DEFAULT_SD_WORKERS);
    expect(parseSdWorkers('   ')).toHaveLength(2);
  });

  it('returns empty list for [] so dispatch can fail closed', () => {
    expect(parseSdWorkers('[]')).toEqual([]);
  });

  it('parses a configured pool', () => {
    const raw = JSON.stringify([
      { id: 'sd-a', baseUrl: 'http://127.0.0.1:7860/', weight: 2, capabilities: ['txt2img', 'img2img'] },
      { id: 'sd-b', baseUrl: 'http://127.0.0.1:7861', capabilities: ['txt2img'] },
    ]);
    expect(parseSdWorkers(raw)).toEqual([
      { id: 'sd-a', baseUrl: 'http://127.0.0.1:7860', weight: 2, capabilities: ['txt2img', 'img2img'] },
      { id: 'sd-b', baseUrl: 'http://127.0.0.1:7861', weight: 1, capabilities: ['txt2img'] },
    ]);
  });
});

describe('selectWorker', () => {
  it('picks the shortest live queue that matches capability', () => {
    const workers = [
      runtime({ id: 'sd-1', queue: 3, capabilities: ['txt2img'] }),
      runtime({ id: 'sd-2', queue: 1, capabilities: ['txt2img'] }),
    ];
    expect(selectWorker(workers, { capability: 'txt2img' })?.id).toBe('sd-2');
  });

  it('skips drained workers and capability mismatches', () => {
    const workers = [
      runtime({ id: 'sd-1', healthy: false, queue: 0 }),
      runtime({ id: 'sd-2', capabilities: ['img2img'], queue: 0 }),
      runtime({ id: 'sd-3', queue: 2 }),
    ];
    expect(selectWorker(workers, { capability: 'txt2img' })?.id).toBe('sd-3');
  });

  it('sticks to the same worker for a stickyKey when that worker is still eligible', () => {
    const workers = [
      runtime({ id: 'sd-1', queue: 4 }),
      runtime({ id: 'sd-2', queue: 0 }),
    ];
    const picked = selectWorker(workers, {
      capability: 'txt2img',
      stickyKey: 'char-1',
      stickyWorkerId: 'sd-1',
    });
    expect(picked?.id).toBe('sd-1');
  });

  it('falls back to shortest queue when the sticky worker is drained', () => {
    const workers = [
      runtime({ id: 'sd-1', healthy: false, queue: 0 }),
      runtime({ id: 'sd-2', queue: 1 }),
    ];
    const picked = selectWorker(workers, {
      capability: 'txt2img',
      stickyKey: 'char-1',
      stickyWorkerId: 'sd-1',
    });
    expect(picked?.id).toBe('sd-2');
  });

  it('returns null when nothing is available', () => {
    expect(selectWorker([], { capability: 'txt2img' })).toBeNull();
    expect(
      selectWorker([runtime({ id: 'sd-1', healthy: false })], { capability: 'txt2img' })
    ).toBeNull();
  });
});

describe('SdPoolService pick + drain', () => {
  let pool: SdPoolService;

  beforeEach(() => {
    pool = new SdPoolService({
      workers: [
        { id: 'sd-1', baseUrl: 'http://127.0.0.1:7860', weight: 1, capabilities: ['txt2img'] },
        { id: 'sd-2', baseUrl: 'http://127.0.0.1:7861', weight: 1, capabilities: ['txt2img'] },
      ],
      probeOnPick: false,
    });
  });

  it('increments queue and reuses the sticky worker', async () => {
    const first = await pool.pickWorker({ capability: 'txt2img', stickyKey: 'char-9' });
    const second = await pool.pickWorker({ capability: 'txt2img', stickyKey: 'char-9' });
    expect(first?.id).toBe(second?.id);
    expect(second?.queue).toBe(2);
  });

  it('drains a worker after three consecutive failures', async () => {
    const first = await pool.pickWorker({ capability: 'txt2img' });
    expect(first).not.toBeNull();
    const drainedId = first!.id;
    pool.release(drainedId);

    for (let i = 0; i < SD_FAILURE_THRESHOLD; i += 1) {
      pool.markFailure(drainedId);
    }

    const next = await pool.pickWorker({ capability: 'txt2img' });
    expect(next?.id).not.toBe(drainedId);
    expect(pool.getRuntime().find((w) => w.id === drainedId)?.healthy).toBe(false);
  });
});

describe('SdPoolService.txt2img', () => {
  it('returns images[0] base64 and marks success', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ images: ['AAAAbase64'] }),
    })) as unknown as typeof fetch;

    const pool = new SdPoolService({
      workers: [{ id: 'sd-1', baseUrl: 'http://sd.local', weight: 1, capabilities: ['txt2img'] }],
      fetchImpl,
      probeOnPick: false,
    });

    const b64 = await pool.txt2img({ id: 'sd-1', baseUrl: 'http://sd.local' }, {
      prompt: 'a portrait',
      width: 512,
      height: 512,
      steps: 20,
    });

    expect(b64).toBe('AAAAbase64');
    expect(pool.getRuntime()[0].failCount).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://sd.local/sdapi/v1/txt2img',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
