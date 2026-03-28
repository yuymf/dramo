import { NextResponse } from 'next/server';
import { ensureContract } from '../../../_utils/openapi-guard';

/**
 * POST /api/scripts/{id}/regenerate
 * Regenerate specific scene content with optional new parameters
 */
export async function POST(request: Request) {
  ensureContract('/api/scripts/{id}/regenerate', 'POST');
  
  const url = new URL(request.url);
  const scriptId = url.pathname.split('/').slice(-2)[0]; // extract {id} from path
  
  const body = await request.json().catch(() => ({}));
  const { sceneId, parameters } = body;

  if (!sceneId) {
    return NextResponse.json(
      { error: { code: 'MISSING_SCENE_ID', message: 'sceneId is required' } },
      { status: 400 }
    );
  }

  // Mock: generate 3 candidates with slight variations
  const baseCandidates = [
    { id: 'cand_1', text: '欢迎家人们来到今晚的直播间！今天我们要聊一个非常有意思的话题……', rank: 1 },
    { id: 'cand_2', text: '大家好啊！看到这么多老铁在线，心里特别激动，今天带来了重磅内容……', rank: 2 },
    { id: 'cand_3', text: '各位观众朋友们晚上好！今天的主题是大家期待已久的新品讲解……', rank: 3 },
  ];

  const candidates = baseCandidates.map((c) => ({
    ...c,
    text: parameters?.emphasize
      ? `${c.text}（重点：${parameters.emphasize}）`
      : c.text,
  }));

  return NextResponse.json({
    scriptId,
    sceneId,
    candidates,
    regeneratedAt: new Date().toISOString(),
  });
}

