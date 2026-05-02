import { createProxyRoute } from '../../../_utils/route-factory';

// GET: fetch script (no timeout)
export const { GET } = createProxyRoute('/api/v1/projects/:projectId/script', ['GET']);

// POST: generate script with AI (3-minute timeout for long-running generation)
export const { POST } = createProxyRoute('/api/v1/projects/:projectId/script', ['POST'], {
  timeoutMs: 180000,
});
