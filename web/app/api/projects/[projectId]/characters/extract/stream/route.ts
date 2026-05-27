import { createProxyRoute } from '../../../../../_utils/route-factory';

export const { GET } = createProxyRoute(
  '/api/v1/projects/:projectId/characters/extract/stream',
  ['GET'],
  { appendQuery: true }
);
