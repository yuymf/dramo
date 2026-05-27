import { createProxyRoute } from '../_utils/route-factory';

export const { GET, POST } = createProxyRoute('/api/v1/llm-configs', ['GET', 'POST']);
