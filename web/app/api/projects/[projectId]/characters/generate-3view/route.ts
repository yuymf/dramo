import { NextResponse } from 'next/server';
import type { Script, Character, Character3ViewAsset } from '@/lib/models';

/**
 * POST /api/projects/{projectId}/characters/generate-3view
 * 根据角色描述生成角色三视图
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body: {
    name?: string;
    description?: string;
    notes?: string;
    script?: Script;
    characterProfile?: Character;
    artStyle?: 'sketch' | 'comic';
    referenceImages?: string[];
  } = await request.json();

  console.log(`[POST /api/projects/${projectId}/characters/generate-3view]`, {
    name: body.name,
    artStyle: body.artStyle,
    hasScript: !!body.script,
    hasProfile: !!body.characterProfile,
    referencesCount: body.referenceImages?.length,
  });

  // Mock: 返回生成的三视图资产
  const asset: Character3ViewAsset = {
    id: `char3view_${Date.now()}`,
    characterName: body.name || '未命名角色',
    assets: {
      front: `/mock/character-front-${body.artStyle || 'sketch'}.png`,
      side: `/mock/character-side-${body.artStyle || 'sketch'}.png`,
      back: `/mock/character-back-${body.artStyle || 'sketch'}.png`,
    },
    createdAt: new Date().toISOString(),
  };

  // 生产环境应返回 202 + taskId
  return NextResponse.json(asset, { status: 201 });
}

