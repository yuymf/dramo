import { NextResponse } from 'next/server';
import { ensureContract } from '../_utils/openapi-guard';
import type { PolishRequest, PolishResponse } from '@/lib/models';

/**
 * POST /api/polish
 * 文本润色/重写接口
 * 支持操作：adjust_style（改变风格）、simplify（简化）、expand（扩写）、rewrite（重写）
 */
export async function POST(request: Request) {
  ensureContract('/api/polish', 'POST');

  const body: PolishRequest = await request.json().catch(() => ({
    text: '',
  }));

  const {
    text,
    operation = 'adjust_style',
    styles,
    characterId,
    instruction,
  } = body;

  if (!text) {
    return NextResponse.json(
      { error: { code: 'MISSING_TEXT', message: '文本不能为空' } },
      { status: 400 }
    );
  }

  console.log('[POST /api/polish]', {
    operation,
    textLength: text.length,
    styles,
    characterId,
    hasInstruction: !!instruction,
  });

  // Mock: 根据不同操作返回不同的润色结果
  let polished: string;
  let explanation: string;

  switch (operation) {
    case 'simplify':
      polished = text.replace(/[，。！？]/g, ' ').trim().substring(0, Math.floor(text.length * 0.7));
      explanation = '已简化表达，去除冗余内容，保留核心信息。';
      break;

    case 'expand':
      polished = `${text}。此外，我们还可以进一步补充说明...（这是扩写示例）`;
      explanation = '已扩写内容，增加细节描述和补充说明。';
      break;

    case 'rewrite':
      polished = `【重写版本】${text}——让我换个角度来表达同样的意思...`;
      explanation = instruction
        ? `根据指令"${instruction}"重新生成内容。`
        : '已重新生成内容，保持核心意思但改变表达方式。';
      break;

    case 'adjust_style':
    default:
      const styleDesc = styles?.join('、') || '默认';
      polished = `【${styleDesc}风格】${text}`;
      explanation = `已调整为 ${styleDesc} 风格。`;
      if (characterId) {
        explanation += ` 符合角色 ${characterId} 的语言特征。`;
      }
      break;
  }

  const response: PolishResponse = {
    original: text,
    polished,
    explanation,
  };

  return NextResponse.json(response);
}

