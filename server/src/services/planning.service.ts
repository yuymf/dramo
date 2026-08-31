import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import { ScreenplayService } from './screenplay.service';

export interface BeatRecord {
  id: string;
  action: string;
  intent: string;
  outcome: string;
  sortOrder: number;
}

export interface BeatCoverageRecord extends BeatRecord {
  covered: boolean;
}

export interface PropRecord {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  holder: string | null;
  continuity: string | null;
  images: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface WorldviewRuleRecord {
  key: string;
  value: string;
}

export interface BeatInput {
  id?: string;
  action: string;
  intent: string;
  outcome: string;
}

export function isBeatCovered(
  beat: { action: string; intent: string; outcome: string },
  corpus: string
): boolean {
  for (const part of [beat.action, beat.intent, beat.outcome]) {
    const trimmed = part.trim();
    if (trimmed.length >= 2 && corpus.includes(trimmed)) return true;
  }
  return false;
}

export function corpusFromNodes(nodes: Prisma.JsonValue): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((node) => {
      if (node && typeof node === 'object' && 'text' in node) {
        const text = (node as { text: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .join('\n');
}

function toBeat(row: {
  id: string;
  action: string;
  intent: string;
  outcome: string;
  sortOrder: number;
}): BeatRecord {
  return {
    id: row.id,
    action: row.action,
    intent: row.intent,
    outcome: row.outcome,
    sortOrder: row.sortOrder,
  };
}

function toProp(row: {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  holder: string | null;
  continuity: string | null;
  images: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): PropRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    holder: row.holder,
    continuity: row.continuity,
    images: row.images,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PlanningService {
  private screenplay = new ScreenplayService();

  private async requireEpisode(
    projectId: string,
    episodeId: string,
    userId: string,
    options?: { write?: boolean }
  ) {
    await this.screenplay.requireAccess(projectId, userId, options);
    const episode = await prisma.episode.findFirst({
      where: { id: episodeId, projectId },
    });
    if (!episode) {
      throw new AppException(ErrorCode.NOT_FOUND, '集不存在');
    }
    return episode;
  }

  async getOutline(
    projectId: string,
    episodeId: string,
    userId: string
  ): Promise<{ markdown: string }> {
    await this.requireEpisode(projectId, episodeId, userId);
    const row = await prisma.outline.findUnique({ where: { episodeId } });
    return { markdown: row?.markdown ?? '' };
  }

  async putOutline(
    projectId: string,
    episodeId: string,
    userId: string,
    markdown: string
  ): Promise<{ markdown: string }> {
    await this.requireEpisode(projectId, episodeId, userId, { write: true });
    const row = await prisma.outline.upsert({
      where: { episodeId },
      create: { episodeId, markdown },
      update: { markdown },
    });
    return { markdown: row.markdown };
  }

  async getBeats(
    projectId: string,
    episodeId: string,
    userId: string
  ): Promise<{ beats: BeatRecord[] }> {
    await this.requireEpisode(projectId, episodeId, userId);
    const rows = await prisma.beat.findMany({
      where: { episodeId },
      orderBy: { sortOrder: 'asc' },
    });
    return { beats: rows.map(toBeat) };
  }

  async putBeats(
    projectId: string,
    episodeId: string,
    userId: string,
    beats: BeatInput[]
  ): Promise<{ beats: BeatRecord[] }> {
    await this.requireEpisode(projectId, episodeId, userId, { write: true });

    const rows = await prisma.$transaction(async (tx) => {
      const existing = await tx.beat.findMany({ where: { episodeId } });
      const existingIds = new Set(existing.map((row) => row.id));
      const keepIds = new Set<string>();
      const saved: BeatRecord[] = [];

      for (let i = 0; i < beats.length; i += 1) {
        const item = beats[i];
        const data = {
          action: item.action,
          intent: item.intent,
          outcome: item.outcome,
          sortOrder: i,
        };
        if (item.id && existingIds.has(item.id)) {
          const updated = await tx.beat.update({
            where: { id: item.id },
            data,
          });
          keepIds.add(updated.id);
          saved.push(toBeat(updated));
        } else {
          const created = await tx.beat.create({
            data: { episodeId, ...data },
          });
          keepIds.add(created.id);
          saved.push(toBeat(created));
        }
      }

      await tx.beat.deleteMany({
        where: {
          episodeId,
          ...(keepIds.size > 0 ? { id: { notIn: [...keepIds] } } : {}),
        },
      });

      return saved;
    });

    return { beats: rows };
  }

  async getCoverage(
    projectId: string,
    episodeId: string,
    userId: string
  ): Promise<{ beats: BeatCoverageRecord[] }> {
    await this.requireEpisode(projectId, episodeId, userId);
    const [beats, screenplay] = await Promise.all([
      prisma.beat.findMany({
        where: { episodeId },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.screenplay.findUnique({
        where: { episodeId },
        select: { nodes: true },
      }),
    ]);
    const corpus = corpusFromNodes(screenplay?.nodes ?? []);
    return {
      beats: beats.map((beat) => ({
        ...toBeat(beat),
        covered: isBeatCovered(beat, corpus),
      })),
    };
  }

  async listProps(projectId: string, userId: string): Promise<{ data: PropRecord[] }> {
    await this.screenplay.requireAccess(projectId, userId);
    const rows = await prisma.prop.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return { data: rows.map(toProp) };
  }

  async updateProp(
    projectId: string,
    propId: string,
    userId: string,
    input: { description?: string | null; holder?: string | null; continuity?: string | null }
  ): Promise<PropRecord> {
    await this.screenplay.requireAccess(projectId, userId, { write: true });
    const existing = await prisma.prop.findFirst({
      where: { id: propId, projectId },
    });
    if (!existing) {
      throw new AppException(ErrorCode.NOT_FOUND, '道具不存在');
    }
    const updated = await prisma.prop.update({
      where: { id: propId },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.holder !== undefined ? { holder: input.holder } : {}),
        ...(input.continuity !== undefined ? { continuity: input.continuity } : {}),
      },
    });
    return toProp(updated);
  }

  async getWorldview(
    projectId: string,
    userId: string
  ): Promise<{ rules: WorldviewRuleRecord[] }> {
    await this.screenplay.requireAccess(projectId, userId);
    const rows = await prisma.worldviewRule.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return { rules: rows.map((row) => ({ key: row.key, value: row.value })) };
  }

  async putWorldview(
    projectId: string,
    userId: string,
    rules: WorldviewRuleRecord[]
  ): Promise<{ rules: WorldviewRuleRecord[] }> {
    await this.screenplay.requireAccess(projectId, userId, { write: true });
    const cleaned = rules
      .map((rule) => ({ key: rule.key.trim(), value: rule.value }))
      .filter((rule) => rule.key.length > 0);

    const keys = cleaned.map((rule) => rule.key);
    if (new Set(keys).size !== keys.length) {
      throw new AppException(ErrorCode.INVALID_INPUT, '世界观规则 key 不能重复');
    }

    const saved = await prisma.$transaction(async (tx) => {
      await tx.worldviewRule.deleteMany({ where: { projectId } });
      const rows = [];
      for (const rule of cleaned) {
        rows.push(
          await tx.worldviewRule.create({
            data: { projectId, key: rule.key, value: rule.value },
          })
        );
      }
      return rows;
    });

    return { rules: saved.map((row) => ({ key: row.key, value: row.value })) };
  }
}
