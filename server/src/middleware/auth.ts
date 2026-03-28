import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../lib/logger';

export interface AuthUser {
  userId: string;
  email: string;
}

/**
 * Hono context variable type declarations.
 * Access via `c.get('user')` in route handlers.
 */
export type AuthEnv = {
  Variables: {
    user: AuthUser;
    requestId: string;
  };
};

const PUBLIC_PATHS = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/billing/webhook',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * JWT authentication middleware for Hono.
 * Sets `c.set('user', { userId, email })` on success.
 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  // Generate request ID
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', requestId);

  const pathname = new URL(c.req.url).pathname;

  if (isPublicPath(pathname)) {
    return next();
  }

  const authHeader = c.req.header('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn({ url: pathname }, 'Missing bearer authorization header');
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: '未提供有效的认证凭据',
          retryable: false,
        },
        requestId,
      },
      401
    );
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId?: string;
      sub?: string;
      email?: string;
    };

    const userId = decoded.userId || decoded.sub;

    if (!userId) {
      logger.warn('JWT payload missing user identifier');
      return c.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token 无效或已过期',
            retryable: false,
          },
          requestId,
        },
        401
      );
    }

    c.set('user', { userId, email: decoded.email || '' });
    return next();
  } catch (err) {
    logger.warn({ err }, 'JWT verification failed');
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token 无效或已过期',
          retryable: false,
        },
        requestId,
      },
      401
    );
  }
});
