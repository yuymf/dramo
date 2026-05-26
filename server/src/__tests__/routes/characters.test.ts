import app from '../../app';
import { prisma } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  prisma: {
    characterAsset: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    characterRelation: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

jest.mock('../../middleware/default-user', () => ({
  defaultUserMiddleware: async (c: unknown, next: () => Promise<void>) => {
    (c as { set: (k: string, v: unknown) => void }).set('user', { userId: 'u1' });
    return next();
  },
}));

jest.mock('../../services/llm-config.service', () => ({
  LLMConfigService: jest.fn().mockImplementation(() => ({
    getLLMHeaders: jest.fn().mockResolvedValue({}),
  })),
}));

describe('Characters routes (factory)', () => {
  it('GET /api/v1/projects/:projectId/characters/assets returns 200', async () => {
    const req = new Request('http://localhost/api/v1/projects/p1/characters/assets');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; dataV2: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.dataV2)).toBe(true);
  });
});

export {};
