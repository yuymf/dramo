import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Hono } from 'hono';

jest.mock('../../lib/db', () => ({
  prisma: {
    session: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/db';
import { sessionMiddleware, type AuthEnv, SESSION_COOKIE } from '../../middleware/session';
import { cors } from 'hono/cors';

const mocked = (fn: unknown) => fn as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function makeApp() {
  const app = new Hono<AuthEnv>();
  app.use(
    '*',
    cors({
      origin: (origin) => origin || 'http://localhost:12323',
      credentials: true,
    })
  );
  app.use('*', sessionMiddleware);
  app.get('/api/v1/health', (c) => c.json({ ok: true }));
  app.get('/api/v1/projects', (c) => c.json({ ok: true, userId: c.get('user').userId }));
  return app;
}

describe('session middleware', () => {
  const app = makeApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows /health without a session', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });

  it('returns 401 for /projects without a session', async () => {
    const res = await app.request('/api/v1/projects');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('sets user from a valid unexpired session cookie', async () => {
    mocked(prisma.session.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u1', email: 'a@b.com' },
    });

    const res = await app.request('/api/v1/projects', {
      headers: { Cookie: `${SESSION_COOKIE}=valid-token` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string };
    expect(body.userId).toBe('u1');
  });

  it('rejects an expired session', async () => {
    mocked(prisma.session.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
      user: { id: 'u1', email: 'a@b.com' },
    });

    const res = await app.request('/api/v1/projects', {
      headers: { Cookie: `${SESSION_COOKIE}=expired` },
    });
    expect(res.status).toBe(401);
  });

  it('CORS reflects Origin and allows credentials (not *)', async () => {
    const res = await app.request('/api/v1/health', {
      headers: { Origin: 'http://localhost:12323' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:12323');
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});
