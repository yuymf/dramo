import { NextResponse } from 'next/server';
import { ensureContract } from '../../_utils/openapi-guard';

/**
 * GET /api/inspirations/favorites
 * Fetch user's favorited inspirations (mock implementation)
 */
export async function GET() {
  ensureContract('/api/inspirations/favorites', 'GET');

  // Mock: return empty favorites (client should read from localStorage)
  return NextResponse.json({
    data: [],
    total: 0,
  });
}

