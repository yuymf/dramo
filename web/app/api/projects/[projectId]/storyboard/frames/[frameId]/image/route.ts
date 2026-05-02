import { createProxyRoute } from '../../../../../../_utils/route-factory';

export const { PUT, DELETE } = createProxyRoute(
  '/api/v1/projects/:projectId/storyboard/frames/:frameId/image',
  ['PUT', 'DELETE']
);
