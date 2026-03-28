import { NextResponse } from 'next/server';
import { ensureContract } from '../../_utils/openapi-guard';

export async function GET(request: Request) {
  ensureContract('/api/scripts/{id}', 'GET');
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop() || 'script_mock';
  const now = new Date().toISOString();
  return NextResponse.json({
    id,
    title: 'Generated Script',
    projectId: null,
    type: 'product',
    style: 'humorous',
    status: 'draft',
    scenes: [
      { id: 'scene_1', title: '开场暖场', order: 1, content: [] },
      { id: 'scene_2', title: '主题陈述', order: 2, content: [] },
      { id: 'scene_3', title: '核心环节', order: 3, content: [] },
      { id: 'scene_4', title: '互动', order: 4, content: [] },
      { id: 'scene_5', title: '收尾', order: 5, content: [] },
    ],
    createdAt: now,
    updatedAt: now,
  });
}
