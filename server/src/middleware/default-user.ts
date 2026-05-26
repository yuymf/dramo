import { createMiddleware } from 'hono/factory';
import { DEFAULT_USER_ID, DEFAULT_USER_EMAIL } from '../lib/default-user';

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

export const defaultUserMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.set('user', { userId: DEFAULT_USER_ID, email: DEFAULT_USER_EMAIL });
  return next();
});
