import { createProxyRoute } from '../../../../../_utils/route-factory';

export const { GET, PUT, DELETE } = createProxyRoute(
  '/api/v1/projects/:projectId/characters/assets/:assetId',
  ['GET', 'PUT', 'DELETE']
);
