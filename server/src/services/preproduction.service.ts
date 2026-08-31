import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import { fdxToNodes, nodesToFdx } from '../lib/fdx';
import { deriveFromNodes } from './derive.service';
import { ProjectService } from './project.service';
import { ScreenplayService } from './screenplay.service';

export interface ShotInput {
  id?: string;
  sceneHeading: string;
  description: string;
  camera: string;
  design: string;
}

export class PreproductionService {
  private screenplay = new ScreenplayService();
  private projects = new ProjectService();

  private async requireEpisode(
    projectId: string,
    episodeId: string,
    userId: string,
    options?: { write?: boolean }
  ) {
    await this.screenplay.requireAccess(projectId, userId, options);
    const episode = await prisma.episode.findFirst({
      where: { id: episodeId, projectId },
      include: { screenplay: true },
    });
    if (!episode) {
      throw new AppException(ErrorCode.NOT_FOUND, '集不存在');
    }
    return episode;
  }

  async listScenes(projectId: string, episodeId: string, userId: string) {
    const episode = await this.requireEpisode(projectId, episodeId, userId);
    if (episode.screenplay) {
      const nodes = Array.isArray(episode.screenplay.nodes)
        ? (episode.screenplay.nodes as Array<{ type?: string; text?: string }>)
        : [];
      await deriveFromNodes(
        projectId,
        nodes.map((node, i) => ({
          id: `n${i}`,
          type: (node.type as 'scene_heading') ?? 'action',
          text: node.text ?? '',
        })),
        episodeId
      );
    }
    const scenes = await prisma.scene.findMany({
      where: { episodeId },
      orderBy: { sortOrder: 'asc' },
    });
    return {
      scenes: scenes.map((row) => ({
        id: row.id,
        heading: row.heading,
        locationName: row.locationName,
        sortOrder: row.sortOrder,
      })),
    };
  }

  async listShots(projectId: string, episodeId: string, userId: string) {
    await this.requireEpisode(projectId, episodeId, userId);
    const shots = await prisma.shot.findMany({
      where: { episodeId },
      include: { scene: true },
      orderBy: { sortOrder: 'asc' },
    });
    return {
      shots: shots.map((row) => ({
        id: row.id,
        sceneId: row.sceneId,
        sceneHeading: row.scene.heading,
        description: row.description,
        camera: row.camera,
        design: row.design,
        stale: row.stale,
        images: row.images,
        sortOrder: row.sortOrder,
      })),
    };
  }

  async putShots(projectId: string, episodeId: string, userId: string, shots: ShotInput[]) {
    await this.requireEpisode(projectId, episodeId, userId, { write: true });
    if (shots.length > 6) {
      throw new AppException(ErrorCode.INVALID_INPUT, '超过 6 个镜头时先确认是否真要加覆盖镜头');
    }

    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.shot.findMany({ where: { episodeId } });
      const existingIds = new Set(existing.map((row) => row.id));
      const keep = new Set<string>();
      const rows = [];

      for (let i = 0; i < shots.length; i += 1) {
        const item = shots[i];
        const heading = item.sceneHeading.trim();
        if (!heading) {
          throw new AppException(ErrorCode.INVALID_INPUT, `shots[${i}].sceneHeading 不能为空`);
        }
        const scene = await tx.scene.upsert({
          where: { episodeId_heading: { episodeId, heading } },
          create: { episodeId, heading, sortOrder: i },
          update: {},
        });
        const data = {
          sceneId: scene.id,
          description: item.description,
          camera: item.camera,
          design: item.design,
          sortOrder: i,
          stale: false,
        };
        if (item.id && existingIds.has(item.id)) {
          const updated = await tx.shot.update({ where: { id: item.id }, data });
          keep.add(updated.id);
          rows.push(updated);
        } else {
          const created = await tx.shot.create({ data: { episodeId, ...data } });
          keep.add(created.id);
          rows.push(created);
        }
      }

      await tx.shot.deleteMany({
        where: { episodeId, ...(keep.size > 0 ? { id: { notIn: [...keep] } } : {}) },
      });
      return rows;
    });

    void saved;
    return this.listShots(projectId, episodeId, userId);
  }

  async exportFdx(projectId: string, episodeId: string, userId: string): Promise<{ filename: string; xml: string }> {
    const episode = await this.requireEpisode(projectId, episodeId, userId);
    const nodes = Array.isArray(episode.screenplay?.nodes)
      ? (episode.screenplay?.nodes as Array<{ id: string; type: string; text: string }>)
      : [];
    const title = episode.screenplay?.title || episode.name;
    return {
      filename: `${title || 'screenplay'}.fdx`,
      xml: nodesToFdx(
        nodes.map((node) => ({
          id: node.id,
          type: node.type as 'action',
          text: node.text,
        })),
        title
      ),
    };
  }

  async importFdx(userId: string, xml: string, name?: string) {
    let parsed;
    try {
      parsed = fdxToNodes(xml);
    } catch {
      throw new AppException(ErrorCode.INVALID_INPUT, '不是有效的 FDX');
    }
    if (parsed.nodes.length === 0) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'FDX 里没有可导入的段落');
    }
    const projectName = (name || parsed.title || '导入的剧本').trim();
    const project = await this.projects.createProject(userId, {
      name: projectName,
      type: 'script',
      format: 'hollywood',
    });
    const episode = project.episodes[0];
    if (!episode) {
      throw new AppException(ErrorCode.INTERNAL_ERROR, '导入后没有集');
    }
    await this.screenplay.putScreenplay(project.id, episode.id, userId, {
      title: projectName,
      nodes: parsed.nodes,
    });
    return { id: project.id, name: project.name, episodeId: episode.id };
  }

  async listAssets(projectId: string, userId: string) {
    await this.screenplay.requireAccess(projectId, userId);
    const [assets, tasks] = await Promise.all([
      prisma.asset.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.generationTask.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return {
      assets: assets.map((row) => ({
        id: row.id,
        kind: row.kind,
        url: row.url,
        entityType: row.entityType,
        entityId: row.entityId,
        createdAt: row.createdAt.toISOString(),
      })),
      tasks: tasks.map((row) => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        prompt: row.prompt,
        resultUrl: row.resultUrl,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}

export type { Prisma };
