import { createProxyRoute } from '../../../../../_utils/route-factory';

export const { PATCH, DELETE } = createProxyRoute(
  '/api/v1/projects/:projectId/characters/relations/:relationId',
  ['PATCH', 'DELETE']
);
