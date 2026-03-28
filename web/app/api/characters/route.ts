import { NextResponse } from 'next/server';
import type { Character } from '@/lib/models';

/**
 * GET /api/characters
 * 获取角色列表（原 personas 接口）
 */
export async function GET() {
  // Mock: 返回角色列表
  const mockCharacters: Character[] = [
    {
      id: 'char_1',
      name: '热情主播',
      styleTags: ['幽默', '活泼', '亲和力'],
      speechFeatures: {
        catchphrases: ['家人们', '绝了', '这个真的太棒了'],
        tabooWords: ['低俗', '粗俗'],
        sentencePatterns: '多用感叹句，口语化表达',
      },
    },
    {
      id: 'char_2',
      name: '专业讲师',
      styleTags: ['严谨', '专业', '清晰'],
      speechFeatures: {
        catchphrases: ['让我们来看', '重点是', '需要注意'],
        tabooWords: ['口语化', '俚语'],
        sentencePatterns: '逻辑清晰，分点阐述',
      },
    },
    {
      id: 'char_3',
      name: '治愈系主播',
      styleTags: ['温柔', '治愈', '细腻'],
      speechFeatures: {
        catchphrases: ['大家好呀', '慢慢来', '没关系的'],
        tabooWords: ['激进', '攻击性'],
        sentencePatterns: '温和语气，多用肯定句',
      },
    },
  ];

  return NextResponse.json({
    data: mockCharacters,
  });
}

