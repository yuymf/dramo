import { createProxyRoute } from '../../../../../_utils/route-factory';

export const { PUT, DELETE } = createProxyRoute(
  '/api/v1/projects/:projectId/locations/assets/:assetId',
  ['PUT', 'DELETE']
);
