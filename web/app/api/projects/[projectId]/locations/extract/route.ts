import { createProxyRoute } from '../../../../_utils/route-factory';

export const { POST } = createProxyRoute(
  '/api/v1/projects/:projectId/locations/extract',
  ['POST']
);
