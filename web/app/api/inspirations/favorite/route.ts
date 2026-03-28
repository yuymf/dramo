import { NextResponse } from 'next/server';
import { ensureContract } from '../../_utils/openapi-guard';

/**
 * POST /api/inspirations/favorite
 * Toggle favorite status of an inspiration (mock implementation)
 */
export async function POST(request: Request) {
  ensureContract('/api/inspirations/favorite', 'POST');

  const body = await request.json().catch(() => ({}));
  const { inspirationId } = body;

  if (!inspirationId) {
    return NextResponse.json(
      { error: { code: 'MISSING_INSPIRATION_ID', message: 'inspirationId is required' } },
      { status: 400 }
    );
  }

  // Mock: return updated favorite status
  return NextResponse.json({
    inspirationId,
    isFavorite: true,
    favoritedAt: new Date().toISOString(),
  });
}

