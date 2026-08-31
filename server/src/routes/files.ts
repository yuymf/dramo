import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { config } from '../config';
import type { AuthEnv } from '../middleware/session';

const files = new Hono<AuthEnv>();

files.get('/files/projects/:projectId/:filename', async (c) => {
  const projectId = c.req.param('projectId');
  const filename = c.req.param('filename');
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId) || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return c.body(null, 404);
  }
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
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return c.body(null, 404);
  }
});

export { files };
