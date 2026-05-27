import { NextResponse } from 'next/server';
import type { LocationImageAssetV2 } from '@/lib/models';

/**
 * POST /api/projects/{projectId}/locations/generate-image
 * 根据地点描述生成地点图（支持多图与参考图）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const body = await request.json();

  console.log(`[POST /api/projects/${projectId}/locations/generate-image]`, {
    name: body.name,
    style: body.style,
    hasScript: !!body.script,
    referencesCount: body.referenceImages?.length,
  });

  try {
    // Proxy to backend unified generate-image endpoint
    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:12321';

    const response = await fetch(
      `${backendUrl}/api/v1/projects/${projectId}/generate-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: body.name,
          description: body.description,
          style: body.style,
          referenceImages: body.referenceImages,
          mode: 'single',
          assetType: 'location', // Tell backend to save as location asset
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend request failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    // Adapt backend response to LocationImageAssetV2 format
    const asset: LocationImageAssetV2 = {
      id: `loc_gen_${Date.now()}`,
      locationName: body.name || '未命名地点',
      description: body.description,
      images: result.images || [],
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error(`[POST /api/projects/${projectId}/locations/generate-image] Error:`, error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Location image generation failed',
          code: 'GENERATION_FAILED',
        },
      },
      { status: 500 }
    );
  }
}

