import type { MemberRole, Prisma, ShareMode } from '@prisma/client';
import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import { resolveAccess, resolveShareToken } from './access.service';
import { ScreenplayService } from './screenplay.service';
import { deriveFromNodes } from './derive.service';
import type { ScreenplayNode } from '../types/screenplay';

const SHARE_MODES: ShareMode[] = ['invite', 'anyone_view', 'anyone_edit'];
const ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'];

export class CollabService {
  private screenplay = new ScreenplayService();

  async getShare(projectId: string, userId: string) {
    const access = await resolveAccess(projectId, userId);
    return {
      shareToken: access.shareToken,
      shareMode: access.shareMode,
      sharePath: `/s/${access.shareToken}`,
      published: access.published,
      allowCopy: access.allowCopy,
    };
  }

  async updateShare(projectId: string, userId: string, shareMode: ShareMode) {
    await resolveAccess(projectId, userId, { manage: true });
    if (!SHARE_MODES.includes(shareMode)) {
      throw new AppException(ErrorCode.INVALID_INPUT, '无效的分享模式');
    }
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { shareMode },
      select: { shareToken: true, shareMode: true, published: true, allowCopy: true },
    });
    return { ...project, sharePath: `/s/${project.shareToken}` };
  }

  async resolveToken(token: string, userId: string) {
    const access = await resolveShareToken(token, userId);
    return { projectId: access.projectId, shareMode: access.shareMode, type: access.type };
  }

  async listMembers(projectId: string, userId: string) {
    await resolveAccess(projectId, userId);
    const rows = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      members: rows.map((row) => ({
        id: row.id,
        role: row.role,
        craft: row.craft,
        user: row.user,
      })),
    };
  }

  async inviteMember(projectId: string, userId: string, email: string, role: MemberRole) {
    await resolveAccess(projectId, userId, { manage: true });
    if (!ROLES.includes(role) || role === 'OWNER') {
      throw new AppException(ErrorCode.INVALID_INPUT, '不能邀请为 OWNER');
    }
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      throw new AppException(ErrorCode.NOT_FOUND, '用户不存在');
    }
    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: user.id } },
      create: { projectId, userId: user.id, role },
      update: { role },
    });
    return member;
  }

  async listComments(projectId: string, userId: string, query?: { anchorType?: string; anchorId?: string }) {
    await resolveAccess(projectId, userId);
    const rows = await prisma.comment.findMany({
      where: {
        projectId,
        ...(query?.anchorType ? { anchorType: query.anchorType } : {}),
        ...(query?.anchorId ? { anchorId: query.anchorId } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { comments: rows };
  }

  async addComment(
    projectId: string,
    userId: string,
    input: { anchorType: string; anchorId: string; body: string; episodeId?: string }
  ) {
    await resolveAccess(projectId, userId);
    const body = input.body.trim();
    if (!body) throw new AppException(ErrorCode.INVALID_INPUT, '评论不能为空');
    if (!input.anchorType?.trim() || !input.anchorId?.trim()) {
      throw new AppException(ErrorCode.INVALID_INPUT, '评论必须锚定');
    }
    const row = await prisma.comment.create({
      data: {
        projectId,
        userId,
        episodeId: input.episodeId,
        anchorType: input.anchorType.trim(),
        anchorId: input.anchorId.trim(),
        body,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return row;
  }

  async listVersions(projectId: string, userId: string) {
    await resolveAccess(projectId, userId);
    const rows = await prisma.projectVersion.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, automatic: true, createdAt: true },
    });
    return { versions: rows };
  }

  async createVersion(projectId: string, userId: string, name?: string) {
    await resolveAccess(projectId, userId, { write: true });
    const payload = await this.snapshot(projectId);
    const row = await prisma.projectVersion.create({
      data: {
        projectId,
        name: name?.trim() || null,
        automatic: !name?.trim(),
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    return { id: row.id, name: row.name, automatic: row.automatic, createdAt: row.createdAt };
  }

  async restoreVersion(projectId: string, versionId: string, userId: string) {
    await resolveAccess(projectId, userId, { write: true });
    const version = await prisma.projectVersion.findFirst({
      where: { id: versionId, projectId },
    });
    if (!version) throw new AppException(ErrorCode.NOT_FOUND, '版本不存在');
    await this.createVersion(projectId, userId);
    const payload = version.payload as unknown as Snapshot;
    await this.applySnapshot(projectId, payload);
    return { restored: versionId };
  }

  async publish(projectId: string, userId: string, allowCopy?: boolean) {
    await resolveAccess(projectId, userId, { manage: true });
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        published: true,
        publishedAt: new Date(),
        ...(allowCopy !== undefined ? { allowCopy } : {}),
      },
    });
    await this.createVersion(projectId, userId);
    return { published: true, allowCopy: project.allowCopy };
  }

  async unpublish(projectId: string, userId: string) {
    await resolveAccess(projectId, userId, { manage: true });
    await prisma.project.update({
      where: { id: projectId },
      data: { published: false, publishedAt: null },
    });
    return { published: false };
  }

  async listLibrary() {
    const rows = await prisma.project.findMany({
      where: { published: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        publishedAt: true,
        allowCopy: true,
      },
    });
    return { projects: rows };
  }

  async getLibraryProject(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        episodes: {
          orderBy: { sortOrder: 'asc' },
          include: { screenplay: true, outline: true },
        },
      },
    });
    if (!project?.published) {
      throw new AppException(ErrorCode.NOT_FOUND, '未发布');
    }
    const episode = project.episodes[0];
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      type: project.type,
      allowCopy: project.allowCopy,
      publishedAt: project.publishedAt,
      screenplay: episode?.screenplay
        ? { title: episode.screenplay.title, nodes: episode.screenplay.nodes }
        : null,
    };
  }

  async copyLibraryProject(projectId: string, userId: string) {
    const source = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        episodes: { include: { screenplay: true, outline: true, beats: true } },
        characters: true,
        locations: true,
        props: true,
      },
    });
    if (!source?.published) throw new AppException(ErrorCode.NOT_FOUND, '未发布');
    if (!source.allowCopy) throw new AppException(ErrorCode.FORBIDDEN, '作者不允许复制');

    const created = await prisma.project.create({
      data: {
        name: `${source.name}（副本）`,
        description: source.description,
        type: 'script',
        format: source.format,
        shareToken: crypto.randomUUID().replace(/-/g, ''),
        members: { create: { userId, role: 'OWNER' } },
        episodes: {
          create: {
            name: source.episodes[0]?.name || '第 1 集',
            sortOrder: 0,
            screenplay: source.episodes[0]?.screenplay
              ? {
                  create: {
                    title: source.episodes[0].screenplay.title,
                    cover: source.episodes[0].screenplay.cover as Prisma.InputJsonValue,
                    nodes: source.episodes[0].screenplay.nodes as Prisma.InputJsonArray,
                    crdt: source.episodes[0].screenplay.crdt,
                  },
                }
              : undefined,
          },
        },
      },
    });
    return created;
  }

  async listDiscussions(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { published: true } });
    if (!project?.published) throw new AppException(ErrorCode.NOT_FOUND, '未发布');
    const rows = await prisma.libraryDiscussion.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { discussions: rows };
  }

  async addDiscussion(projectId: string, userId: string, body: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { published: true } });
    if (!project?.published) throw new AppException(ErrorCode.NOT_FOUND, '未发布');
    const text = body.trim();
    if (!text) throw new AppException(ErrorCode.INVALID_INPUT, '讨论不能为空');
    return prisma.libraryDiscussion.create({
      data: { projectId, userId, body: text },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  private async snapshot(projectId: string): Promise<Snapshot> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        episodes: { include: { screenplay: true, outline: true, beats: true, reels: { include: { films: true } } } },
      },
    });
    if (!project) throw new AppException(ErrorCode.NOT_FOUND, '项目不存在');
    return {
      name: project.name,
      format: project.format,
      cinemaSettings: project.cinemaSettings,
      episodes: project.episodes.map((episode) => ({
        id: episode.id,
        name: episode.name,
        screenplay: episode.screenplay
          ? {
              title: episode.screenplay.title,
              cover: episode.screenplay.cover,
              nodes: episode.screenplay.nodes,
              crdt: episode.screenplay.crdt,
            }
          : null,
        outline: episode.outline?.markdown ?? '',
        beats: episode.beats,
        reels: episode.reels,
      })),
    };
  }

  private async applySnapshot(projectId: string, payload: Snapshot) {
    for (const episode of payload.episodes ?? []) {
      if (episode.screenplay) {
        await prisma.screenplay.updateMany({
          where: { episodeId: episode.id },
          data: {
            title: episode.screenplay.title,
            cover: episode.screenplay.cover as Prisma.InputJsonValue,
            nodes: episode.screenplay.nodes as Prisma.InputJsonArray,
            crdt: episode.screenplay.crdt ?? '',
          },
        });
        const nodes = Array.isArray(episode.screenplay.nodes)
          ? (episode.screenplay.nodes as ScreenplayNode[])
          : [];
        await deriveFromNodes(projectId, nodes, episode.id);
      }
      if (episode.outline !== undefined) {
        await prisma.outline.upsert({
          where: { episodeId: episode.id },
          create: { episodeId: episode.id, markdown: episode.outline },
          update: { markdown: episode.outline },
        });
      }
    }
    void this.screenplay;
  }
}

interface Snapshot {
  name: string;
  format: string;
  cinemaSettings: unknown;
  episodes: Array<{
    id: string;
    name: string;
    screenplay: {
      title: string;
      cover: unknown;
      nodes: unknown;
      crdt?: string;
    } | null;
    outline: string;
    beats: unknown;
    reels: unknown;
  }>;
}
