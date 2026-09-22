import { AppException, ErrorCode } from '../lib/errors.js';
import type { AuthEnv } from '../middleware/session.js';

type AuthContext = {
  get: (key: 'user') => AuthEnv['Variables']['user'] | undefined;
};

export function requireUser(c: AuthContext) {
  const user = c.get('user');
  if (!user) {
    throw new AppException(ErrorCode.UNAUTHORIZED, '未登录');
  }
  return user;
}

export async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new AppException(ErrorCode.INVALID_INPUT, '请求体必须是 JSON');
  }
}

export function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppException(ErrorCode.INVALID_INPUT, '请求体必须是对象');
  }
  return body as Record<string, unknown>;
}
