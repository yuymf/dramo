import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/db';
import { config } from '../config';
import type { AuthEnv } from '../middleware/auth';

const auth = new Hono<AuthEnv>();

auth.post('/api/auth/register', async (c) => {
  const requestId = c.get('requestId');
  const { email, password, name } = await c.req.json();

  if (!email) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '邮箱不能为空', retryable: false }, requestId }, 400);
  }
  if (!password) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '密码不能为空', retryable: false }, requestId }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '邮箱格式无效', retryable: false }, requestId }, 400);
  }

  if (password.length < 6) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '密码长度至少为6个字符', retryable: false }, requestId }, 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return c.json({ error: { code: 'CONFLICT', message: '该邮箱已被注册', retryable: false }, requestId }, 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name: name || email.split('@')[0] },
  });

  const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } }, 201);
});

auth.post('/api/auth/login', async (c) => {
  const requestId = c.get('requestId');
  const { email, password } = await c.req.json();

  if (!email) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '邮箱不能为空', retryable: false }, requestId }, 400);
  }
  if (!password) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '密码不能为空', retryable: false }, requestId }, 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '邮箱或密码错误', retryable: false }, requestId }, 401);
  }

  if (!user.password) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '该账户尚未设置密码，请联系管理员', retryable: false }, requestId }, 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '邮箱或密码错误', retryable: false }, requestId }, 401);
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

auth.get('/api/auth/me', async (c) => {
  const requestId = c.get('requestId');
  const user = c.get('user');

  if (!user?.userId) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '未认证，请重新登录', retryable: false }, requestId }, 401);
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    return c.json({ error: { code: 'NOT_FOUND', message: '用户不存在', retryable: false }, requestId }, 404);
  }

  return c.json({ id: dbUser.id, email: dbUser.email, name: dbUser.name });
});

export { auth };
