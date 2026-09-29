import { prisma } from '../lib/db.js';
import { AppException, ErrorCode } from '../lib/errors.js';
import { ScreenplayService, reviseWithLlm } from './screenplay.service.js';
import type { ScreenplayNode } from '../types/screenplay.js';

export type EntityType = 'character' | 'location';
type Field = 'description' | 'castingNotes' | 'storyPlace' | 'shootPlace';
export interface EntityFieldDiff {
  field: Field;
  before: string | null;
  after: string;
}

const FIELDS: Record<EntityType, readonly Field[]> = {
  character: ['description', 'castingNotes'],
  location: ['description', 'storyPlace', 'shootPlace'],
};
const LABELS: Record<Field, string> = {
  description: '描述',
  castingNotes: '选角备注',
  storyPlace: '故事地点',
  shootPlace: '实拍地',
};

export function parseEntityType(value: string): EntityType {
  if (value === 'character' || value === 'location') return value;
  throw new AppException(ErrorCode.INVALID_INPUT, '只支持角色或地点修订');
}

export function parseEntityDiff(type: EntityType, value: unknown): EntityFieldDiff[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppException(ErrorCode.INVALID_INPUT, '修订字段不能为空');
  }
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppException(ErrorCode.INVALID_INPUT, '修订字段格式无效');
    }
    const raw = item as Record<string, unknown>;
    if (Object.keys(raw).some((key) => !['field', 'before', 'after'].includes(key)) ||
      typeof raw.field !== 'string' || !FIELDS[type].includes(raw.field as Field) ||
      seen.has(raw.field) || (raw.before !== null && typeof raw.before !== 'string') ||
      typeof raw.after !== 'string') {
      throw new AppException(ErrorCode.INVALID_INPUT, '修订字段超出允许范围或格式无效');
    }
    seen.add(raw.field);
    return { field: raw.field as Field, before: raw.before as string | null, after: raw.after };
  });
}

export function entityNodes(type: EntityType, id: string, row: Record<Field, string | null>): ScreenplayNode[] {
  return FIELDS[type].map((field) => ({ id: `${id}:${field}`, type: 'action', text: row[field] ?? '' }));
}

export function diffEntityNodes(
  type: EntityType,
  id: string,
  row: Record<Field, string | null>,
  replacements: ScreenplayNode[]
): EntityFieldDiff[] {
  const allowed = new Map(FIELDS[type].map((field) => [`${id}:${field}`, field]));
  const seen = new Set<string>();
  for (const node of replacements) {
    if (!allowed.has(node.id) || seen.has(node.id) || node.type !== 'action' || typeof node.text !== 'string') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'AI 修订结果超出实体字段范围');
    }
    seen.add(node.id);
  }
  return replacements.flatMap((node) => {
    const field = allowed.get(node.id)!;
    return node.text === (row[field] ?? '') ? [] : [{ field, before: row[field], after: node.text }];
  });
}

export class EntityReviseService {
  constructor(private readonly screenplay = new ScreenplayService()) {}

  private async load(type: EntityType, projectId: string, id: string, userId: string) {
    await this.screenplay.requireAccess(projectId, userId, { write: true });
    const row = type === 'character'
      ? await prisma.character.findFirst({ where: { id, projectId } })
      : await prisma.location.findFirst({ where: { id, projectId } });
    if (!row) throw new AppException(ErrorCode.NOT_FOUND, type === 'character' ? '角色不存在' : '地点不存在');
    return row;
  }

  async preview(type: EntityType, projectId: string, id: string, userId: string,
    body: { instruction?: unknown }, requestId?: string) {
    if (typeof body.instruction !== 'string' || !body.instruction.trim()) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'instruction 必须是非空字符串');
    }
    const row = await this.load(type, projectId, id, userId);
    const fields = row as unknown as Record<Field, string | null>;
    const nodes = entityNodes(type, id, fields);
    const replacements = await reviseWithLlm({
      nodes, nodeIds: nodes.map((node) => node.id), instruction: body.instruction.trim(),
      scopeType: 'selection', userId, requestId,
    });
    const diff = diffEntityNodes(type, id, fields, replacements);
    return {
      instruction: body.instruction.trim(),
      scope: { type, id },
      diff,
      proposalText: diff.length
        ? diff.map(({ field, before, after }) => `【${LABELS[field]}】${before ?? '（空）'} → ${after}`).join('\n')
        : '（无改动）',
    };
  }

  async accept(type: EntityType, projectId: string, id: string, userId: string,
    body: { diff?: unknown }) {
    const diff = parseEntityDiff(type, body.diff);
    const row = await this.load(type, projectId, id, userId);
    const fields = row as unknown as Record<Field, string | null>;
    if (diff.some(({ field, before }) => fields[field] !== before)) {
      throw new AppException(ErrorCode.CONFLICT, '实体内容已变化，请重新预览');
    }
    const patch = Object.fromEntries(diff.map(({ field, after }) => [field, after]));
    return type === 'character'
      ? this.screenplay.updateCharacter(projectId, id, userId, patch)
      : this.screenplay.updateLocation(projectId, id, userId, patch);
  }
}
