import { createProxyRoute } from '../../../../../_utils/route-factory';

export const { GET } = createProxyRoute(
  '/api/v1/projects/:projectId/locations/extract/stream',
  ['GET'],
  { appendQuery: true }
);
