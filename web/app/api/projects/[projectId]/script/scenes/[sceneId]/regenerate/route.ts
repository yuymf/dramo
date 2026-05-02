import { createProxyRoute } from '../../../../../../_utils/route-factory';

// POST: regenerate a specific scene with AI (3-minute timeout for long-running generation)
export const { POST } = createProxyRoute(
  '/api/v1/projects/:projectId/script/scenes/:sceneId/regenerate',
  ['POST'],
  { timeoutMs: 180000 }
);
