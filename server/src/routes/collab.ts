import { Hono } from 'hono';
import type { MemberRole, ShareMode } from '@prisma/client';
import type { AuthEnv } from '../middleware/session.js';
import { CollabService } from '../services/collab.service.js';
import { asObject, readJson, requireUser } from './helpers.js';

const collab = new Hono<AuthEnv>();
const service = new CollabService();

collab.get('/share/:token', async (c) => {
  return c.json(await service.resolveToken(c.req.param('token'), requireUser(c).userId));
});

collab.get('/projects/:projectId/share', async (c) => {
  return c.json(await service.getShare(c.req.param('projectId'), requireUser(c).userId));
});

collab.patch('/projects/:projectId/share', async (c) => {
  const body = asObject(await readJson(c));
  return c.json(
    await service.updateShare(c.req.param('projectId'), requireUser(c).userId, body.shareMode as ShareMode)
  );
});

collab.get('/projects/:projectId/members', async (c) => {
  return c.json(await service.listMembers(c.req.param('projectId'), requireUser(c).userId));
});

collab.post('/projects/:projectId/members', async (c) => {
  const body = asObject(await readJson(c));
  return c.json(
    await service.inviteMember(
      c.req.param('projectId'),
      requireUser(c).userId,
      String(body.email ?? ''),
      body.role as MemberRole
    ),
    201
  );
});

collab.get('/projects/:projectId/comments', async (c) => {
  const { anchorType, anchorId } = c.req.query();
  return c.json(
    await service.listComments(c.req.param('projectId'), requireUser(c).userId, { anchorType, anchorId })
  );
});

collab.post('/projects/:projectId/comments', async (c) => {
  const body = asObject(await readJson(c));
  return c.json(
    await service.addComment(c.req.param('projectId'), requireUser(c).userId, {
      anchorType: String(body.anchorType ?? ''),
      anchorId: String(body.anchorId ?? ''),
      body: String(body.body ?? ''),
      episodeId: typeof body.episodeId === 'string' ? body.episodeId : undefined,
    }),
    201
  );
});

collab.get('/projects/:projectId/versions', async (c) => {
  return c.json(await service.listVersions(c.req.param('projectId'), requireUser(c).userId));
});

collab.post('/projects/:projectId/versions', async (c) => {
  let name: string | undefined;
  try {
    const body = asObject(await readJson(c));
    name = typeof body.name === 'string' ? body.name : undefined;
  } catch {
    name = undefined;
  }
  return c.json(await service.createVersion(c.req.param('projectId'), requireUser(c).userId, name), 201);
});

collab.post('/projects/:projectId/versions/:versionId/restore', async (c) => {
  return c.json(
    await service.restoreVersion(c.req.param('projectId'), c.req.param('versionId'), requireUser(c).userId)
  );
});

collab.post('/projects/:projectId/publish', async (c) => {
  let allowCopy: boolean | undefined;
  try {
    const body = asObject(await readJson(c));
    allowCopy = typeof body.allowCopy === 'boolean' ? body.allowCopy : undefined;
  } catch {
    allowCopy = undefined;
  }
  return c.json(await service.publish(c.req.param('projectId'), requireUser(c).userId, allowCopy));
});

collab.post('/projects/:projectId/unpublish', async (c) => {
  return c.json(await service.unpublish(c.req.param('projectId'), requireUser(c).userId));
});

collab.get('/library', async (c) => {
  requireUser(c);
  return c.json(await service.listLibrary());
});

collab.get('/library/:projectId', async (c) => {
  requireUser(c);
  return c.json(await service.getLibraryProject(c.req.param('projectId')));
});

collab.post('/library/:projectId/copy', async (c) => {
  return c.json(await service.copyLibraryProject(c.req.param('projectId'), requireUser(c).userId), 201);
});

collab.get('/library/:projectId/discussions', async (c) => {
  requireUser(c);
  return c.json(await service.listDiscussions(c.req.param('projectId')));
});

collab.post('/library/:projectId/discussions', async (c) => {
  const body = asObject(await readJson(c));
  return c.json(
    await service.addDiscussion(c.req.param('projectId'), requireUser(c).userId, String(body.body ?? '')),
    201
  );
});

export { collab };
