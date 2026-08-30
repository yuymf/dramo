import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Hono } from 'hono';

jest.mock('../../lib/db', () => ({
  prisma: {
    session: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/db';
import { auth } from '../../routes/auth';
import { sessionMiddleware, type AuthEnv, SESSION_COOKIE } from '../../middleware/session';
import { errorHandler } from '../../middleware/error-handler';
import { hashPassword } from '../../lib/password';

const mocked = (fn: unknown) => fn as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function makeApp() {
  const app = new Hono<AuthEnv>();
  app.use('*', sessionMiddleware);
  app.route('/api/v1', auth);
  app.onError(errorHandler);
  return app;
}

describe('auth routes', () => {
  const app = makeApp();

  beforeEach(() => {
    jest.clearAllMocks();
    mocked(prisma.session.findUnique).mockResolvedValue(null);
  });

  it('POST /auth/register rejects short passwords', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', name: 'A', password: 'short' }),
    });
    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('POST /auth/register sets session cookie', async () => {
    mocked(prisma.user.create).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
    });
    mocked(prisma.session.create).mockResolvedValue({ id: 's1' });

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', name: 'A', password: 'longenough' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe('a@b.com');
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie).toContain('Path=/');
    expect(prisma.session.create).toHaveBeenCalled();
  });

  it('POST /auth/login rejects bad password', async () => {
    const passwordHash = await hashPassword('longenough');
    mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      passwordHash,
    });

    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'wrong-password' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /auth/me is 401 without a session', async () => {
    const res = await app.request('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /auth/me returns the user when session is valid', async () => {
    mocked(prisma.session.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'u1', email: 'a@b.com' },
    });
    mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
    });

    const res = await app.request('/api/v1/auth/me', {
      headers: { Cookie: `${SESSION_COOKIE}=tok` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string; email: string } };
    expect(body.user).toEqual({ id: 'u1', email: 'a@b.com', name: 'A' });
  });
});
