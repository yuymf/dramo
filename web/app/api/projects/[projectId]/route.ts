import { createProxyRoute } from '../../_utils/route-factory';

export const { GET, PATCH } = createProxyRoute('/api/v1/projects/:projectId', ['GET', 'PATCH']);
