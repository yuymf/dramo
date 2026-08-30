import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { prisma } from '../lib/db';

export const SESSION_COOKIE = 'dramo_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface AuthUser {
  userId: string;
  email: string;
}

export type AuthEnv = {
  Variables: {
    user: AuthUser;
    requestId: string;
  };
};

function isPublicPath(path: string): boolean {
  return /(?:^|\/)auth(?:\/|$)/.test(path) || /(?:^|\/)health(?:\/|$)/.test(path);
}

export const sessionMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', requestId);

  if (c.req.method === 'OPTIONS') {
    return next();
  }

  let authenticated = false;
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true } } },
    });

    if (session && session.expiresAt > new Date()) {
      c.set('user', { userId: session.user.id, email: session.user.email });
      authenticated = true;
    }
  }

  if (!authenticated && !isPublicPath(c.req.path)) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: '未登录',
          retryable: false,
        },
        requestId,
      },
      401
    );
  }

  return next();
});
