import { NextResponse } from 'next/server';
import { ensureContract } from '../_utils/openapi-guard';

/**
 * GET /api/inspirations
 * Fetch inspiration suggestions related to current script/scene
 */
export async function GET(request: Request) {
  ensureContract('/api/inspirations', 'GET');

  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const sceneId = url.searchParams.get('sceneId');
  const category = url.searchParams.get('category'); // quotes/topics/interactions/hotspots
  
  // 参数校验
  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 }
    );
  }

  // Mock inspirations with categories
  const allInspirations = [
    {
      id: 'insp_1',
      text: '家人们看这里！这个功能绝了！',
      category: 'quotes',
      relevance: 0.92,
      source: '历史优质台本',
    },
    {
      id: 'insp_2',
      text: '可以结合近期热门话题：AI大模型应用场景',
      category: 'hotspots',
      relevance: 0.88,
      source: '热点追踪',
    },
    {
      id: 'insp_3',
      text: '引导观众在弹幕分享使用体验',
      category: 'interactions',
      relevance: 0.85,
      source: '互动模板库',
    },
    {
      id: 'insp_4',
      text: '产品核心卖点对比：性能提升40%',
      category: 'topics',
      relevance: 0.90,
      source: '产品资料',
    },
    {
      id: 'insp_5',
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
    sceneId,
  });
}

