import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { AppException, ErrorCode } from '../lib/errors.js';
import { ScreenplayService } from './screenplay.service.js';
import {
  applyBeatFieldPatch,
  applyOutlineParagraphPatch,
  formatBeatProposalText,
  formatProposalText,
  reviseBeatFieldsWithLlm,
  reviseOutlineParagraphWithLlm,
  splitOutlineParagraphs,
  wrapOutlineParagraphAsNodes,
  type BeatFields,
} from './planning-revise.js';

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

  private parseInstruction(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'instruction 必须是字符串');
    }
    return value;
  }

  private parseOutlineReviseScope(value: unknown): { type: 'paragraph'; index: number } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'scope 格式无效');
    }
    const raw = value as Record<string, unknown>;
    if (raw.type !== 'paragraph') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'scope.type 必须是 paragraph');
    }
    if (typeof raw.index !== 'number' || !Number.isInteger(raw.index) || raw.index < 0) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'scope.index 必须是非负整数');
    }
    return { type: 'paragraph', index: raw.index };
  }

  private parseBeatReviseScope(value: unknown): { type: 'beat'; beatId: string } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'scope 格式无效');
    }
    const raw = value as Record<string, unknown>;
    if (raw.type !== 'beat') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'scope.type 必须是 beat');
    }
    if (typeof raw.beatId !== 'string' || !raw.beatId.trim()) {
      throw new AppException(ErrorCode.INVALID_INPUT, '请先保存该 Beat');
    }
    return { type: 'beat', beatId: raw.beatId.trim() };
  }

  private parseRevisedText(value: unknown): string {
    if (typeof value !== 'string') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'revisedText 必须是字符串');
    }
    return value;
  }

  private parseBeatFields(value: unknown): BeatFields {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'revised 必须是对象');
    }
    const raw = value as Record<string, unknown>;
    for (const field of ['action', 'intent', 'outcome'] as const) {
      if (typeof raw[field] !== 'string') {
        throw new AppException(ErrorCode.INVALID_INPUT, `revised.${field} 必须是字符串`);
      }
    }
    return {
      action: raw.action as string,
      intent: raw.intent as string,
      outcome: raw.outcome as string,
    };
  }

  /**
   * Preview outline paragraph revise: LLM only for that paragraph; no putOutline.
   */
  async previewOutlineRevise(
    projectId: string,
    episodeId: string,
    userId: string,
    body: { instruction?: unknown; scope?: unknown },
    requestId?: string
  ): Promise<{
    instruction: string;
    scope: { type: 'paragraph'; index: number };
    revisedText: string;
    proposalText: string;
  }> {
    await this.requireEpisode(projectId, episodeId, userId, { write: true });
    const instruction = this.parseInstruction(body.instruction);
    const scope = this.parseOutlineReviseScope(body.scope);
    const row = await prisma.outline.findUnique({ where: { episodeId } });
    const markdown = row?.markdown ?? '';
    const paragraphs = splitOutlineParagraphs(markdown);
    if (scope.index >= paragraphs.length) {
      throw new AppException(ErrorCode.INVALID_INPUT, '段落索引无效');
    }
    const paragraph = paragraphs[scope.index];
    const revisedText = await reviseOutlineParagraphWithLlm({
      paragraph,
      index: scope.index,
      instruction,
      userId,
      requestId,
    });
    // Validate patch without writing.
    applyOutlineParagraphPatch(markdown, scope.index, revisedText);
    const proposalText = formatProposalText(
      wrapOutlineParagraphAsNodes(scope.index, revisedText)
    );
    return { instruction, scope, revisedText, proposalText };
  }

  /**
   * Accept outline paragraph revise: patch that index only, then putOutline.
   */
  async acceptOutlineRevise(
    projectId: string,
    episodeId: string,
    userId: string,
    body: { scope?: unknown; revisedText?: unknown }
  ): Promise<{ markdown: string }> {
    await this.requireEpisode(projectId, episodeId, userId, { write: true });
    const scope = this.parseOutlineReviseScope(body.scope);
    const revisedText = this.parseRevisedText(body.revisedText);
    const row = await prisma.outline.findUnique({ where: { episodeId } });
    const markdown = row?.markdown ?? '';
    const next = applyOutlineParagraphPatch(markdown, scope.index, revisedText);
    return this.putOutline(projectId, episodeId, userId, next);
  }

  /**
   * Preview beat revise: LLM for that beat's three fields; no putBeats.
   */
  async previewBeatRevise(
    projectId: string,
    episodeId: string,
    userId: string,
    body: { instruction?: unknown; scope?: unknown },
    requestId?: string
  ): Promise<{
    instruction: string;
    scope: { type: 'beat'; beatId: string };
    revised: BeatFields;
    proposalText: string;
  }> {
    await this.requireEpisode(projectId, episodeId, userId, { write: true });
    const instruction = this.parseInstruction(body.instruction);
    const scope = this.parseBeatReviseScope(body.scope);
    const rows = await prisma.beat.findMany({
      where: { episodeId },
      orderBy: { sortOrder: 'asc' },
    });
    const beat = rows.find((row) => row.id === scope.beatId);
    if (!beat) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Beat 不存在');
    }
    const fields: BeatFields = {
      action: beat.action,
      intent: beat.intent,
      outcome: beat.outcome,
    };
    const revised = await reviseBeatFieldsWithLlm({
      beatId: scope.beatId,
      fields,
      instruction,
      userId,
      requestId,
    });
    // Validate isolation without writing.
    applyBeatFieldPatch(rows.map(toBeat), scope.beatId, revised);
    return {
      instruction,
      scope,
      revised,
      proposalText: formatBeatProposalText(revised),
    };
  }

  /**
   * Accept beat revise: merge fields into that beat only via putBeats.
   */
  async acceptBeatRevise(
    projectId: string,
    episodeId: string,
    userId: string,
    body: { scope?: unknown; revised?: unknown }
  ): Promise<{ beats: BeatRecord[] }> {
    await this.requireEpisode(projectId, episodeId, userId, { write: true });
    const scope = this.parseBeatReviseScope(body.scope);
    const revised = this.parseBeatFields(body.revised);
    const { beats } = await this.getBeats(projectId, episodeId, userId);
    const patched = applyBeatFieldPatch(beats, scope.beatId, revised);
    return this.putBeats(
      projectId,
      episodeId,
      userId,
      patched.map((beat) => ({
        id: beat.id,
        action: beat.action,
        intent: beat.intent,
        outcome: beat.outcome,
      }))
    );
  }
}
