import { NextResponse } from 'next/server';
import type { CharacterImageAsset } from '@/lib/models';

/**
 * POST /api/projects/{projectId}/characters/generate-image
 * 根据角色描述生成角色图片（支持多图与参考图）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const body = await request.json();

  console.log(`[POST /api/projects/${projectId}/characters/generate-image]`, {
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
          assetType: 'character', // Tell backend to save as character asset
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend request failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    // Adapt backend response to CharacterImageAsset format
    const asset: CharacterImageAsset = {
      id: `char_gen_${Date.now()}`,
      characterName: body.name || '未命名角色',
      description: body.description,
      images: result.images || [],
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error(`[POST /api/projects/${projectId}/characters/generate-image] Error:`, error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Character image generation failed',
          code: 'GENERATION_FAILED',
        },
      },
      { status: 500 }
    );
  }
}
















