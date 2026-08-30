import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/password';
import { config } from '../config';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type AuthEnv,
} from '../middleware/session';

const auth = new Hono<AuthEnv>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function publicUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function cookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: 'Lax' as const,
    secure: !config.isDev,
  };
}

async function issueSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await prisma.session.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, SESSION_COOKIE, token, cookieOptions());
}

auth.post('/auth/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !EMAIL_RE.test(email)) {
    throw new AppException(ErrorCode.INVALID_INPUT, '请输入有效邮箱');
  }
  if (!name) {
    throw new AppException(ErrorCode.INVALID_INPUT, '请输入名称');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppException(ErrorCode.INVALID_INPUT, `密码至少 ${MIN_PASSWORD_LENGTH} 位`);
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await prisma.user.create({
      data: { email, name, passwordHash },
      select: { id: true, email: true, name: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppException(ErrorCode.CONFLICT, '该邮箱已注册');
    }
    throw err;
  }

  const token = await issueSession(user.id);
  setSessionCookie(c, token);
  return c.json({ user: publicUser(user) }, 201);
});

auth.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    throw new AppException(ErrorCode.INVALID_INPUT, '请输入邮箱和密码');
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    throw new AppException(ErrorCode.UNAUTHORIZED, '邮箱或密码错误');
  }

  const token = await issueSession(user.id);
  setSessionCookie(c, token);
  return c.json({ user: publicUser(user) });
});

auth.post('/auth/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

auth.get('/auth/me', async (c) => {
  const sessionUser = c.get('user');
  if (!sessionUser) {
    throw new AppException(ErrorCode.UNAUTHORIZED, '未登录');
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    throw new AppException(ErrorCode.UNAUTHORIZED, '未登录');
  }

  return c.json({ user: publicUser(user) });
});

export { auth };
