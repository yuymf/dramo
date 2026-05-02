import { createProxyRoute } from '../../../_utils/route-factory';

export const maxDuration = 100;

export const { POST } = createProxyRoute(
  '/api/v1/projects/:projectId/generate-image',
  ['POST']
);
