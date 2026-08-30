import { createProxyRoute } from '../../../../../_utils/route-factory';

export const { POST } = createProxyRoute(
  '/api/v1/projects/:projectId/scripts/:scriptId/director',
  ['POST'],
  { timeoutMs: 120000 }
);
