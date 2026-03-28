import { NextResponse } from 'next/server';
import type { ScriptVersion } from '@/lib/models';

/**
 * GET /api/projects/{projectId}/script/versions
 * 获取台本的历史版本列表
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  // Mock: 返回版本历史（不包含完整content，仅元数据）
  const mockVersions: Omit<ScriptVersion, 'content'>[] = [
    {
      id: `version_${projectId}_1`,
      scriptId: `script_${projectId}`,
      version: 1,
      summary: '初始版本',
      author: '系统',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: `version_${projectId}_2`,
      scriptId: `script_${projectId}`,
      version: 2,
      summary: '添加了开场暖场内容',
      author: '用户',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: `version_${projectId}_3`,
      scriptId: `script_${projectId}`,
      version: 3,
      summary: '优化了核心环节的表达',
      author: '用户',
      createdAt: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      id: `version_${projectId}_4`,
      scriptId: `script_${projectId}`,
      version: 4,
      summary: '当前版本（自动保存）',
      author: '用户',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  return NextResponse.json({
    data: mockVersions,
    projectId,
    scriptId: `script_${projectId}`,
  });
}

