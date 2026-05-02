import { createProxyRoute } from '../../../../../_utils/route-factory';

export const { PATCH } = createProxyRoute(
  '/api/v1/projects/:projectId/storyboard-data/frames/:frameId',
  ['PATCH']
);
