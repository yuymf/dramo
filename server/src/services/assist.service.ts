import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import { ScreenplayService } from './screenplay.service';
import { isBeatCovered, corpusFromNodes } from './planning.service';

export const ADVISORS = [
  {
    id: 'three-act',
    name: '三幕',
    summary: '建置、对抗、解决。顾问只提供看稿镜头，不能雇自己，也不能改权限。',
  },
  {
    id: 'save-the-cat',
    name: 'Save the Cat',
    summary: '开场形象、主题陈述、催化剂、中点、全败、终局变奏。',
  },
  {
    id: 'story-circle',
    name: '故事圈',
    summary: '舒适区 → 欲望 → 进入陌生 → 适应 → 代价 → 回归 → 改变。',
  },
] as const;

export type AdvisorId = (typeof ADVISORS)[number]['id'];

const ADVISOR_IDS = new Set<string>(ADVISORS.map((item) => item.id));

export interface KnowledgeRecord {
  id: string;
  projectId: string;
  name: string;
  filename: string;
  mime: string;
  text: string;
  createdAt: string;
}

export interface ColdStartDoc {
  gate: number;
  premise: {
    character: string;
    desire: string;
    obstacle: string;
    cost: string;
    format: string;
  };
  structure: { causality: string; ending: string };
  beatsNote: string;
  entitiesNote: string;
  writingNote: string;
}

export interface DoctorNote {
  id: string;
  priority: 'high' | 'med' | 'low';
  area: 'scene' | 'character' | 'conflict' | 'theme';
  title: string;
  body: string;
}

const EMPTY_COLD: ColdStartDoc = {
  gate: 1,
  premise: { character: '', desire: '', obstacle: '', cost: '', format: '' },
  structure: { causality: '', ending: '' },
  beatsNote: '',
  entitiesNote: '',
  writingNote: '',
};

export function normalizeColdStart(raw: Prisma.JsonValue | null | undefined): ColdStartDoc {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const premise = obj.premise && typeof obj.premise === 'object' ? (obj.premise as Record<string, unknown>) : {};
  const structure =
    obj.structure && typeof obj.structure === 'object' ? (obj.structure as Record<string, unknown>) : {};
  const gate = typeof obj.gate === 'number' && obj.gate >= 1 && obj.gate <= 5 ? Math.floor(obj.gate) : 1;
  const str = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    gate,
    premise: {
      character: str(premise.character),
      desire: str(premise.desire),
      obstacle: str(premise.obstacle),
      cost: str(premise.cost),
      format: str(premise.format),
    },
    structure: { causality: str(structure.causality), ending: str(structure.ending) },
    beatsNote: str(obj.beatsNote),
    entitiesNote: str(obj.entitiesNote),
    writingNote: str(obj.writingNote),
  };
}

export function suggestMicroContinue(nodes: Array<{ id: string; text: string }>, afterNodeId: string): string {
  const index = nodes.findIndex((node) => node.id === afterNodeId);
  const before = (index >= 0 ? nodes.slice(0, index + 1) : nodes).reverse();
  const seed = before.find((node) => node.text.trim())?.text.trim() || '这场戏';
  const tail = seed.replace(/\s+/g, '').slice(-18);
  const text = `${tail}之后，空气里还剩一点没说完的意思。她没有立刻转身，只把那句话在嘴里过了一遍。`;
  if (text.length < 50) {
    return `${text}窗外的灯还亮着，像有人在等一个答案。`;
  }
  return text.slice(0, 100);
}

function toKnowledge(row: {
  id: string;
  projectId: string;
  name: string;
  filename: string;
  mime: string;
  text: string;
  createdAt: Date;
}): KnowledgeRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    filename: row.filename,
    mime: row.mime,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}

export class AssistService {
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

  async listKnowledge(projectId: string, userId: string): Promise<{ data: KnowledgeRecord[] }> {
    await this.screenplay.requireAccess(projectId, userId);
    const rows = await prisma.knowledgeFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows.map(toKnowledge) };
  }

  async createKnowledge(
    projectId: string,
    userId: string,
    input: { name: string; filename: string; text: string; mime?: string }
  ): Promise<KnowledgeRecord> {
    await this.screenplay.requireAccess(projectId, userId, { write: true });
    const name = input.name.trim();
    const filename = input.filename.trim();
    if (!name || !filename) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'name 和 filename 不能为空');
    }
    const row = await prisma.knowledgeFile.create({
      data: {
        projectId,
        name,
        filename,
        text: input.text,
        mime: input.mime?.trim() || 'text/plain',
      },
    });
    return toKnowledge(row);
  }

  async deleteKnowledge(projectId: string, fileId: string, userId: string): Promise<{ ok: true }> {
    await this.screenplay.requireAccess(projectId, userId, { write: true });
    const existing = await prisma.knowledgeFile.findFirst({
      where: { id: fileId, projectId },
    });
    if (!existing) {
      throw new AppException(ErrorCode.NOT_FOUND, '资料不存在');
    }
    await prisma.knowledgeFile.delete({ where: { id: fileId } });
    return { ok: true };
  }

  async getAdvisor(projectId: string, userId: string) {
    await this.screenplay.requireAccess(projectId, userId);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { advisorId: true },
    });
    const hired = ADVISORS.find((item) => item.id === project?.advisorId) ?? null;
    return { advisors: ADVISORS, hired };
  }

  async putAdvisor(projectId: string, userId: string, advisorId: string | null) {
    await this.screenplay.requireAccess(projectId, userId, { write: true });
    if (advisorId !== null && !ADVISOR_IDS.has(advisorId)) {
      throw new AppException(ErrorCode.INVALID_INPUT, '未知顾问');
    }
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { advisorId },
    });
    const hired = ADVISORS.find((item) => item.id === project.advisorId) ?? null;
    return { advisors: ADVISORS, hired };
  }

  async getColdStart(projectId: string, episodeId: string, userId: string): Promise<ColdStartDoc> {
    const episode = await this.requireEpisode(projectId, episodeId, userId);
    return normalizeColdStart(episode.coldStart);
  }

  async putColdStart(
    projectId: string,
    episodeId: string,
    userId: string,
    body: unknown
  ): Promise<ColdStartDoc> {
    await this.requireEpisode(projectId, episodeId, userId, { write: true });
    const doc = normalizeColdStart(body as Prisma.JsonValue);
    await prisma.episode.update({
      where: { id: episodeId },
      data: { coldStart: doc as unknown as Prisma.InputJsonValue },
    });
    return doc;
  }

  async getDoctor(projectId: string, episodeId: string, userId: string): Promise<{ notes: DoctorNote[] }> {
    await this.requireEpisode(projectId, episodeId, userId);
    const [outline, beats, screenplay, worldviewCount] = await Promise.all([
      prisma.outline.findUnique({ where: { episodeId } }),
      prisma.beat.findMany({ where: { episodeId }, orderBy: { sortOrder: 'asc' } }),
      prisma.screenplay.findUnique({ where: { episodeId } }),
      prisma.worldviewRule.count({ where: { projectId } }),
    ]);

    const nodes = Array.isArray(screenplay?.nodes) ? (screenplay?.nodes as Array<{ type?: string; text?: string }>) : [];
    const corpus = corpusFromNodes(screenplay?.nodes ?? []);
    const notes: DoctorNote[] = [];

    if (!outline?.markdown.trim()) {
      notes.push({
        id: 'outline-empty',
        priority: 'high',
        area: 'conflict',
        title: '大纲是空的',
        body: '先写本集因果和结局承诺，再开写场次。',
      });
    }

    const uncovered = beats.filter((beat) => !isBeatCovered(beat, corpus));
    if (uncovered.length > 0) {
      notes.push({
        id: 'beats-uncovered',
        priority: 'high',
        area: 'conflict',
        title: `${uncovered.length} 个 Beat 未在正文兑现`,
        body: uncovered
          .map((beat) => beat.action.trim() || beat.intent.trim() || beat.outcome.trim() || beat.id)
          .join('；'),
      });
    }

    const headings = nodes.filter((node) => node.type === 'scene_heading' && (node.text ?? '').trim());
    if (headings.length === 0) {
      notes.push({
        id: 'no-scenes',
        priority: 'high',
        area: 'scene',
        title: '还没有场次标题',
        body: '冷启动第五关一次只写一小撮场次，先立一场。',
      });
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (node.type !== 'character' || !(node.text ?? '').trim()) continue;
      const next = nodes[i + 1];
      if (!next || next.type !== 'dialogue' || !(next.text ?? '').trim()) {
        notes.push({
          id: `cue-${i}`,
          priority: 'med',
          area: 'character',
          title: `角色「${(node.text ?? '').trim()}」后面没有对白`,
          body: '角色行后面应接下对白，或改成动作。',
        });
      }
    }

    if (worldviewCount === 0) {
      notes.push({
        id: 'worldview-empty',
        priority: 'low',
        area: 'theme',
        title: '还没有世界观规则',
        body: '至少写一条不能被改写的前提，顾问看稿时才有边界。',
      });
    }

    return { notes };
  }

  async microContinue(
    projectId: string,
    episodeId: string,
    userId: string,
    afterNodeId: string
  ): Promise<{ suggestion: string }> {
    await this.requireEpisode(projectId, episodeId, userId, { write: true });
    const screenplay = await prisma.screenplay.findUnique({ where: { episodeId } });
    const nodes = Array.isArray(screenplay?.nodes)
      ? (screenplay?.nodes as Array<{ id: string; text: string }>)
      : [];
    if (!nodes.some((node) => node.id === afterNodeId)) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'afterNodeId 不在正文里');
    }
    return { suggestion: suggestMicroContinue(nodes, afterNodeId) };
  }
}
