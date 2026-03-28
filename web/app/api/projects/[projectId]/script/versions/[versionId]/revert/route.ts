import { NextResponse } from 'next/server';
import type { Script } from '@/lib/models';

/**
 * POST /api/projects/{projectId}/script/versions/{versionId}/revert
 * 回滚到指定历史版本
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;

  console.log(`[POST /api/projects/${projectId}/script/versions/${versionId}/revert]`);

  // Mock: 返回回滚后的台本（实际应从版本历史中恢复）
  const revertedScript: Partial<Script> = {
    id: `script_${projectId}`,
    projectId,
    title: `已回滚到版本 ${versionId}`,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json({
    success: true,
    versionId,
    script: revertedScript,
    message: `已成功回滚到版本 ${versionId}`,
  });
}

