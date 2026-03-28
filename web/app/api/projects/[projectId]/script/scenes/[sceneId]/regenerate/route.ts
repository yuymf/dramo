import { NextResponse } from 'next/server';
import type { Script, Scene, ScriptStyle, ScriptGoal } from '@/lib/models';

/**
 * POST /api/projects/{projectId}/script/scenes/{sceneId}/regenerate
 * 重新生成指定场景的内容
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  const { projectId, sceneId } = await params;
  const body: {
    actOrder?: number;
    actId?: string;
    script?: Script;
    styles?: ScriptStyle[];
    goal?: ScriptGoal;
    promptText?: string;
  } = await request.json();

  console.log(`[POST /api/projects/${projectId}/script/scenes/${sceneId}/regenerate]`, {
    actOrder: body.actOrder,
    stylesCount: body.styles?.length,
    goal: body.goal,
    hasPrompt: !!body.promptText,
    hasFullScript: !!body.script,
  });

  // Mock: 生成新场景内容
  const regeneratedScene: Scene = {
    id: sceneId,
    title: `重生成场景 ${sceneId}`,
    description: `基于风格 [${body.styles?.join(', ') || '默认'}] 重新生成`,
    isEXT: false,
    isDay: true,
    order: 1,
    content: [
      {
        id: `block_regen_${Date.now()}_1`,
        label: '开场暖场',
        text: `<p>重新生成的开场内容（风格: ${body.styles?.join(', ') || '默认'}）...</p>`,
      },
      {
        id: `block_regen_${Date.now()}_2`,
        label: '核心环节',
        text: body.promptText
          ? `<p>根据用户指令"${body.promptText}"生成的内容...</p>`
          : '<p>重新生成的核心环节...</p>',
      },
      {
        id: `block_regen_${Date.now()}_3`,
        label: '收尾',
        text: `<p>目标: ${body.goal || '未指定'}</p>`,
      },
    ],
  };

  // 开发环境返回同步结果（包含candidates格式以兼容前端）
  return NextResponse.json(
    {
      scene: regeneratedScene,
      candidates: [
        {
          id: `cand_${Date.now()}_1`,
          text: regeneratedScene.content.map(b => b.text).join('\n'),
          rank: 1,
        },
      ],
    },
    { status: 200 }
  );

  // 生产环境应返回：
  // return NextResponse.json(
  //   {
  //     taskId: `task_${Date.now()}`,
  //     status: 'queued',
  //     estimatedSeconds: 15,
  //   },
  //   { status: 202 }
  // );
}

