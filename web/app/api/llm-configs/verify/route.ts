import { createProxyRoute } from '../../_utils/route-factory';

export const { POST } = createProxyRoute('/api/v1/llm-configs/verify', ['POST']);
