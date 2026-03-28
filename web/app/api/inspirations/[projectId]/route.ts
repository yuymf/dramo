import { NextResponse } from 'next/server';
import type { Inspiration, InspirationCategory } from '@/lib/models';

/**
 * GET /api/inspirations/{projectId}
 * 获取项目的灵感推荐（轻量接口，用于进入项目时自动加载）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') as InspirationCategory | null;

  // Mock: 返回存储/缓存的灵感列表
  const allInspirations: Inspiration[] = [
    {
      id: `insp_${projectId}_1`,
      text: '家人们看这里！这个功能绝了！',
      category: 'quotes',
      relevance: 0.92,
      source: '历史优质台本',
    },
    {
      id: `insp_${projectId}_2`,
      text: '可以结合近期热门话题：AI大模型应用场景',
      category: 'hotspots',
      relevance: 0.88,
      source: '热点追踪',
    },
    {
      id: `insp_${projectId}_3`,
      text: '引导观众在弹幕分享使用体验',
      category: 'interactions',
      relevance: 0.85,
      source: '互动模板库',
    },
    {
      id: `insp_${projectId}_4`,
      text: '产品核心卖点对比：性能提升40%',
      category: 'topics',
      relevance: 0.90,
      source: '产品资料',
    },
    {
      id: `insp_${projectId}_5`,
      text: '用"连隔壁楼的猫都能数清楚毛"这样的夸张说法增强画面感',
      category: 'quotes',
      relevance: 0.87,
      source: '历史优质台本',
    },
  ];

  const filtered = category
    ? allInspirations.filter((i) => i.category === category)
    : allInspirations;

  return NextResponse.json({
    data: filtered,
    projectId,
  });
}

