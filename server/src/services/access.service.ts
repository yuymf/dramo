import type { MemberRole, ShareMode } from '@prisma/client';
import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';

const WRITE_ROLES = new Set<MemberRole>(['OWNER', 'ADMIN', 'EDITOR']);
const MANAGE_ROLES = new Set<MemberRole>(['OWNER', 'ADMIN']);

export interface AccessContext {
  projectId: string;
  userId: string;
  role: MemberRole;
  via: 'member' | 'share';
  shareMode: ShareMode;
  type: 'script' | 'cinema' | 'spoken';
  format: 'hollywood' | 'asian';
  published: boolean;
  allowCopy: boolean;
  shareToken: string;
}

export async function resolveAccess(
  projectId: string,
  userId: string,
  options?: { write?: boolean; manage?: boolean }
): Promise<AccessContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      type: true,
      format: true,
      shareMode: true,
      shareToken: true,
      published: true,
      allowCopy: true,
    },
  });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, '项目不存在');
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  let role: MemberRole;
  let via: AccessContext['via'];
  if (member) {
    role = member.role;
    via = 'member';
  } else if (project.shareMode === 'anyone_edit') {
    role = 'EDITOR';
    via = 'share';
  } else if (project.shareMode === 'anyone_view') {
    role = 'VIEWER';
    via = 'share';
  } else {
    throw new AppException(ErrorCode.FORBIDDEN, '不是该项目成员');
  }

  if (options?.write && !WRITE_ROLES.has(role)) {
    throw new AppException(ErrorCode.FORBIDDEN, 'Viewer 不可调用');
  }
  if (options?.manage && (via !== 'member' || !MANAGE_ROLES.has(member!.role))) {
    throw new AppException(ErrorCode.FORBIDDEN, '没有管理权限');
  }

  return {
    projectId: project.id,
    userId,
    role,
    via,
    shareMode: project.shareMode,
    type: project.type,
    format: project.format,
    published: project.published,
    allowCopy: project.allowCopy,
    shareToken: project.shareToken,
  };
}

export async function resolveShareToken(token: string, userId: string): Promise<AccessContext> {
  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    select: { id: true },
  });
  if (!project) {
    throw new AppException(ErrorCode.NOT_FOUND, '分享链接无效');
  }
  return resolveAccess(project.id, userId);
}
