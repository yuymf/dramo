import { NextRequest } from 'next/server';
import { proxyRequest, validateRouteParam } from '@/app/api/_utils/proxy';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invalid = validateRouteParam(id, 'id');
  if (invalid) return invalid;
  return proxyRequest(request, `/api/v1/llm-configs/${id}`, { requireAuth: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invalid = validateRouteParam(id, 'id');
  if (invalid) return invalid;
  return proxyRequest(request, `/api/v1/llm-configs/${id}`, { requireAuth: true });
}
