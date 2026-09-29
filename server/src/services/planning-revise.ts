import { AppException, ErrorCode } from '../lib/errors.js';
import type { ScreenplayNode } from '../types/screenplay.js';
import { formatProposalText, reviseWithLlm } from './screenplay.service.js';

export interface BeatFields {
  action: string;
  intent: string;
  outcome: string;
}

export interface BeatLike extends BeatFields {
  id: string;
  sortOrder?: number;
}

/** Split outline markdown on blank-line runs (`\n\n+`). Trailing empties are kept. */
export function splitOutlineParagraphs(markdown: string): string[] {
  if (markdown.length === 0) return [''];
  return markdown.split(/\n\n+/);
}

/** Replace a single paragraph by index; other paragraphs stay identical. */
export function applyOutlineParagraphPatch(
  markdown: string,
  index: number,
  revised: string
): string {
  const paragraphs = splitOutlineParagraphs(markdown);
  if (index < 0 || index >= paragraphs.length) {
    throw new AppException(ErrorCode.INVALID_INPUT, '段落索引无效');
  }
  const next = [...paragraphs];
  next[index] = revised;
  return next.join('\n\n');
}

/**
 * Map a caret/selection offset in the original markdown to a paragraph index.
 * Offsets that land inside a `\n\n+` separator resolve to the following paragraph.
 */
export function paragraphIndexAtOffset(markdown: string, offset: number): number {
  const paragraphs = splitOutlineParagraphs(markdown);
  if (paragraphs.length <= 1) return 0;
  const clamped = Math.max(0, Math.min(offset, markdown.length));
  let cursor = 0;
  for (let i = 0; i < paragraphs.length; i += 1) {
    const paraEnd = cursor + paragraphs[i].length;
    let sepLen = 0;
    if (i < paragraphs.length - 1) {
      const match = markdown.slice(paraEnd).match(/^\n\n+/);
      sepLen = match ? match[0].length : 0;
    }
    const regionEnd = paraEnd + sepLen;
    if (clamped < paraEnd) return i;
    if (clamped >= paraEnd && clamped < regionEnd) {
      return Math.min(i + 1, paragraphs.length - 1);
    }
    if (clamped === paraEnd && sepLen === 0) return i;
    if (i === paragraphs.length - 1) return i;
    cursor = regionEnd;
  }
  return paragraphs.length - 1;
}

/** Patch one beat's action/intent/outcome; other beats stay referentially identical. */
export function applyBeatFieldPatch<T extends BeatLike>(
  beats: T[],
  beatId: string,
  fields: BeatFields
): T[] {
  if (!beatId.trim()) {
    throw new AppException(ErrorCode.INVALID_INPUT, '请先保存该 Beat');
  }
  let found = false;
  const next = beats.map((beat) => {
    if (beat.id !== beatId) return beat;
    found = true;
    return {
      ...beat,
      action: fields.action,
      intent: fields.intent,
      outcome: fields.outcome,
    };
  });
  if (!found) {
    throw new AppException(ErrorCode.NOT_FOUND, 'Beat 不存在');
  }
  return next;
}

export function outlineParagraphNodeId(index: number): string {
  return `p${index}`;
}

export function beatFieldNodeId(beatId: string, field: keyof BeatFields): string {
  return `${beatId}:${field}`;
}

export function wrapOutlineParagraphAsNodes(index: number, text: string): ScreenplayNode[] {
  return [{ id: outlineParagraphNodeId(index), type: 'action', text }];
}

export function wrapBeatFieldsAsNodes(beatId: string, fields: BeatFields): ScreenplayNode[] {
  return (['action', 'intent', 'outcome'] as const).map((field) => ({
    id: beatFieldNodeId(beatId, field),
    type: 'action' as const,
    text: fields[field],
  }));
}

export function extractOutlineParagraphFromNodes(
  nodes: ScreenplayNode[],
  index: number
): string {
  const id = outlineParagraphNodeId(index);
  const hit = nodes.find((n) => n.id === id);
  if (!hit) {
    if (nodes.length === 1 && typeof nodes[0].text === 'string') return nodes[0].text;
    throw new AppException(ErrorCode.INVALID_INPUT, 'AI 修订结果缺少目标段落');
  }
  return hit.text;
}

export function extractBeatFieldsFromNodes(
  nodes: ScreenplayNode[],
  beatId: string,
  fallback: BeatFields
): BeatFields {
  const byId = new Map(nodes.map((n) => [n.id, n.text]));
  const action = byId.get(beatFieldNodeId(beatId, 'action'));
  const intent = byId.get(beatFieldNodeId(beatId, 'intent'));
  const outcome = byId.get(beatFieldNodeId(beatId, 'outcome'));
  if (action === undefined && intent === undefined && outcome === undefined && nodes.length === 3) {
    return {
      action: nodes[0].text,
      intent: nodes[1].text,
      outcome: nodes[2].text,
    };
  }
  return {
    action: action ?? fallback.action,
    intent: intent ?? fallback.intent,
    outcome: outcome ?? fallback.outcome,
  };
}

export function formatBeatProposalText(fields: BeatFields): string {
  return [`【动作】${fields.action}`, `【意图】${fields.intent}`, `【结果】${fields.outcome}`].join(
    '\n'
  );
}

/**
 * Revise a single outline paragraph via reviseworkflow (wrapped as one action node).
 * Nonempty instruction never returns placeholder success.
 */
export async function reviseOutlineParagraphWithLlm(input: {
  paragraph: string;
  index: number;
  instruction: string;
  userId: string;
  requestId?: string;
}): Promise<string> {
  const nodes = wrapOutlineParagraphAsNodes(input.index, input.paragraph);
  const replacements = await reviseWithLlm({
    nodes,
    nodeIds: nodes.map((n) => n.id),
    instruction: input.instruction,
    scopeType: 'selection',
    userId: input.userId,
    requestId: input.requestId,
  });
  return extractOutlineParagraphFromNodes(replacements, input.index);
}

/**
 * Revise one beat's three fields via reviseworkflow (3 action nodes).
 * Nonempty instruction never returns placeholder success.
 */
export async function reviseBeatFieldsWithLlm(input: {
  beatId: string;
  fields: BeatFields;
  instruction: string;
  userId: string;
  requestId?: string;
}): Promise<BeatFields> {
  const nodes = wrapBeatFieldsAsNodes(input.beatId, input.fields);
  const replacements = await reviseWithLlm({
    nodes,
    nodeIds: nodes.map((n) => n.id),
    instruction: input.instruction,
    scopeType: 'selection',
    userId: input.userId,
    requestId: input.requestId,
  });
  return extractBeatFieldsFromNodes(replacements, input.beatId, input.fields);
}

export { formatProposalText };
