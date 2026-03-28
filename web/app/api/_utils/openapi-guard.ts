import schema from '../../../public/openapi.json';

// Minimal runtime guard placeholder; for now just ensure schema is present.
export function ensureContract(_path: string, _method: string) {
  void _path;
  void _method;
  if (!(schema as { openapi?: string })?.openapi) {
    throw new Error('OpenAPI schema not loaded');
  }
}
