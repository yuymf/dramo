import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { config } from '../config/index.js';
import type { AuthEnv } from '../middleware/session.js';
import { resolveAccess } from '../services/access.service.js';
import { requireUser } from './helpers.js';

const files = new Hono<AuthEnv>();

files.get('/files/projects/:projectId/:filename', async (c) => {
  const projectId = c.req.param('projectId');
  const filename = c.req.param('filename');
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId) || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return c.body(null, 404);
  }
  await resolveAccess(projectId, requireUser(c).userId);
  const root = path.resolve(config.storageLocalDir, 'projects');
  const filePath = path.resolve(root, projectId, filename);
  if (!filePath.startsWith(root + path.sep)) {
    return c.body(null, 404);
  }
  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const type =
      ext === '.mp4'
        ? 'video/mp4'
        : ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.webp'
              ? 'image/webp'
              : 'application/octet-stream';
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch {
    return c.body(null, 404);
  }
});

export { files };
