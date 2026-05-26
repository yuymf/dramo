import { type NextRequest } from 'next/server';
import { proxyRequest } from './proxy';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RouteContext = { params: Promise<Record<string, string>> };
type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;

interface ProxyRouteOptions {
  requireAuth?: boolean;
  appendQuery?: boolean;
  timeoutMs?: number;
}

/**
 * Interpolate :param placeholders in a path using resolved Next.js route params.
 *
 * @example
 * interpolatePath('/api/v1/projects/:projectId', { projectId: 'abc' })
 * → '/api/v1/projects/abc'
 *
 * For static paths with no placeholders the template is returned unchanged, so
 * routes without dynamic segments work correctly too.
 */
function interpolatePath(
  template: string,
  params: Record<string, string>
): string {
  return template.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, (_, key) => {
    const value = params[key];
    if (value === undefined || value === '') {
      throw new Error(`[route-factory] Missing route param: ${key}`);
    }
    return encodeURIComponent(value);
  });
}

/**
 * Factory for thin proxy route handlers.
 *
 * Reduces boilerplate for routes that pass 100% of the request to the backend
 * with no custom logic. Handles dynamic segments by interpolating `:param`
 * placeholders from the Next.js App Router second-argument `params`.
 *
 * @param backendPath  Backend path template, e.g. '/api/v1/projects/:projectId'
 * @param methods      HTTP methods to expose, e.g. ['GET', 'PATCH']
 * @param options      Optional ProxyOptions overrides (defaults: requireAuth=true)
 *
 * @example
 * // app/api/projects/[projectId]/route.ts
 * import { createProxyRoute } from '../../_utils/route-factory';
 * export const { GET, PATCH } = createProxyRoute('/api/v1/projects/:projectId', ['GET', 'PATCH']);
 *
 * @example
 * // app/api/auth/register/route.ts  (no auth required)
 * import { createProxyRoute } from '../_utils/route-factory';
 * export const { POST } = createProxyRoute('/api/v1/auth/register', ['POST'], { requireAuth: false });
 */
export function createProxyRoute(
  backendPath: string,
  methods: HttpMethod[],
  options: ProxyRouteOptions = {}
): Record<HttpMethod, RouteHandler> {
  const { appendQuery, timeoutMs } = options;

  const handler: RouteHandler = async (req, ctx) => {
    const params = await ctx.params;
    const resolvedPath = interpolatePath(backendPath, params);
    return proxyRequest(req, resolvedPath, {
      ...(appendQuery !== undefined && { appendQuery }),
      ...(timeoutMs !== undefined && { timeoutMs }),
    });
  };

  return Object.fromEntries(
    methods.map((method) => [method, handler])
  ) as Record<HttpMethod, RouteHandler>;
}
