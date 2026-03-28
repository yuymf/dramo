import { NextResponse } from 'next/server';
import type { Character } from '@/lib/models';

/**
 * GET /api/characters/{id}
 * 获取指定角色详情（原 personas 接口）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Mock: 返回角色详情
  const mockCharacter: Character = {
    id,
    name: `角色 ${id}`,
    styleTags: ['标签1', '标签2'],
    speechFeatures: {
      catchphrases: ['口头禅1', '口头禅2'],
      tabooWords: ['禁忌词1', '禁忌词2'],
      sentencePatterns: '句式特征描述',
    },
  };

  return NextResponse.json(mockCharacter);
}

