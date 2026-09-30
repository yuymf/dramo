import type { MemberRole, Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { startWorkflowRun } from '../lib/agentos-client.js';
import { AppException, ErrorCode } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { unwrapWorkflowJson } from '../lib/workflow-json.js';
import { LLMConfigService } from './llm-config.service.js';
import { resolveAccess } from './access.service.js';
import { deriveFromNodes } from './derive.service.js';
import {
  EMPTY_COVER,
  NODE_TYPES,
  type Cover,
  type NodeType,
  type ScreenplayDoc,
  type ScreenplayFormat,
  type ScreenplayNode,
} from '../types/screenplay.js';

const REVISE_WORKFLOW_ID = 'reviseworkflow';
const NODE_TYPE_SET = new Set<string>(NODE_TYPES);
const llmConfigService = new LLMConfigService();

export interface ScreenplayVersionMeta {
  id: string;
  version: number;
  summary: string | null;
  createdAt: string;
}

export interface CharacterRecord {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  images: unknown;
  castingNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocationRecord {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  images: unknown;
  storyPlace: string | null;
  shootPlace: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AccessContext {
  projectId: string;
  format: ScreenplayFormat;
  role: MemberRole;
}

interface LoadedEpisode {
  access: AccessContext;
  episodeId: string;
  episodeName: string;
  screenplay: {
    id: string;
    episodeId: string;
    title: string;
    cover: Prisma.JsonValue;
    nodes: Prisma.JsonValue;
    updatedAt: Date;
  } | null;
}

/**
 * Selection scope must be an exact contiguous span: every requested id exists,
 * and every node between min..max index is included (no silent hole-fill expand).
 */
export function assertExactContiguousSelection(
  nodes: ScreenplayNode[],
  nodeIds: string[]
): void {
  if (nodeIds.length === 0) {
    throw new AppException(ErrorCode.INVALID_INPUT, '请先在剧本里选中要改的句子');
  }
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < nodes.length; i += 1) {
    idToIndex.set(nodes[i].id, i);
  }
  const indices: number[] = [];
  const seen = new Set<string>();
  for (const id of nodeIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const idx = idToIndex.get(id);
    if (idx === undefined) {
      throw new AppException(ErrorCode.INVALID_INPUT, '选区包含不存在的节点，请重新选择');
    }
    indices.push(idx);
  }
  indices.sort((a, b) => a - b);
  const min = indices[0];
  const max = indices[indices.length - 1];
  if (indices.length !== max - min + 1) {
    throw new AppException(ErrorCode.INVALID_INPUT, '选区必须是连续节点，不能隔空选择');
  }
  for (let i = min; i <= max; i += 1) {
    if (!indices.includes(i)) {
      throw new AppException(ErrorCode.INVALID_INPUT, '选区必须是连续节点，不能隔空选择');
    }
  }
}

export function applyNodePatch(
  nodes: ScreenplayNode[],
  replacements: ScreenplayNode[],
  scopeNodeIds?: string[]
): ScreenplayNode[] {
  const originalIds = new Set(nodes.map((node) => node.id));
  const replacementIds = replacements.map((node) => node.id);
  const inferredScope = replacementIds.filter((id) => originalIds.has(id));
  const scopeIds = scopeNodeIds && scopeNodeIds.length > 0 ? scopeNodeIds : inferredScope;

  if (scopeIds.length === 0) {
    throw new AppException(ErrorCode.INVALID_INPUT, '无法确定修订范围');
  }

  // Exact contiguous scope — never silent hole-fill expand.
  assertExactContiguousSelection(nodes, scopeIds);

  const scopeSet = new Set(scopeIds);
  let rangeStart = -1;
  let rangeEnd = -1;
  for (let i = 0; i < nodes.length; i += 1) {
    if (scopeSet.has(nodes[i].id)) {
      if (rangeStart === -1) rangeStart = i;
      rangeEnd = i;
    }
  }

  if (rangeStart === -1) {
    throw new AppException(ErrorCode.INVALID_INPUT, '范围内没有可修订的节点');
  }

  const outOfRangeIds = new Set<string>();
  for (let i = 0; i < nodes.length; i += 1) {
    if (i < rangeStart || i > rangeEnd) {
      outOfRangeIds.add(nodes[i].id);
    }
  }

  for (const node of replacements) {
    if (outOfRangeIds.has(node.id)) {
      throw new AppException(ErrorCode.INVALID_INPUT, '修订不得改范围外节点');
    }
  }

  const next = [...nodes.slice(0, rangeStart), ...replacements, ...nodes.slice(rangeEnd + 1)];
  const seen = new Set<string>();
  for (const node of next) {
    if (seen.has(node.id)) {
      throw new AppException(ErrorCode.INVALID_INPUT, '节点 id 不能重复');
    }
    seen.add(node.id);
  }
  return next;
}

export interface ReviseProposal {
  instruction: string;
  scope: { type: 'selection' | 'scene'; nodeIds: string[] };
  replacements: ScreenplayNode[];
  /** Human-readable proposal text for Floating AI (before Accept writes). */
  proposalText: string;
}

/**
 * Call AgentOS ReviseWorkflow and return replacement nodes for the scoped span.
 * Empty instruction → in-range placeholder copy (unit tests / no-op).
 * Nonempty instruction → real LLM only; never silent placeholder success.
 */
export async function reviseWithLlm(input: {
  nodes: ScreenplayNode[];
  nodeIds: string[];
  instruction: string;
  scopeType: 'selection' | 'scene';
  format?: ScreenplayFormat;
  userId?: string;
  requestId?: string;
}): Promise<ScreenplayNode[]> {
  if (!input.instruction.trim()) {
    return placeholderRevise(input.nodes, input.nodeIds, input.instruction);
  }

  if (!input.userId) {
    throw new AppException(ErrorCode.LLM_NOT_CONFIGURED, '未配置默认文本模型，请先在设置中配置 LLM');
  }

  const fromAgent = await tryAgentOsRevise(input);
  if (!fromAgent) {
    throw new AppException(ErrorCode.UPSTREAM_ERROR, 'AI 修订服务暂不可用，请稍后重试', {
      retryable: true,
    });
  }
  if (!replacementsStayInRange(input.nodes, input.nodeIds, fromAgent)) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'AI 修订结果超出选区范围');
  }
  return fromAgent;
}

function replacementsStayInRange(
  nodes: ScreenplayNode[],
  nodeIds: string[],
  replacements: ScreenplayNode[]
): boolean {
  try {
    applyNodePatch(nodes, replacements, nodeIds);
    return true;
  } catch {
    return false;
  }
}

/** In-range no-op copy. Only for empty instruction or explicit unit tests — never silent success for real revise. */
export function placeholderRevise(
  nodes: ScreenplayNode[],
  nodeIds: string[],
  _instruction: string
): ScreenplayNode[] {
  const span = sliceScope(nodes, nodeIds);
  return span.map((node) => ({ ...node }));
}

export function formatProposalText(replacements: ScreenplayNode[]): string {
  if (replacements.length === 0) return '（无改动）';
  return replacements
    .map((node) => {
      const label =
        node.type === 'dialogue'
          ? '对白'
          : node.type === 'action'
            ? '动作'
            : node.type === 'character'
              ? '角色'
              : node.type === 'scene_heading'
                ? '场景'
                : node.type;
      return `【${label}】${node.text}`;
    })
    .join('\n');
}


/**
 * Expand seed nodeIds to the contiguous scene span:
 * from the scene_heading that contains the seed (or the seed itself if it is a heading)
 * through nodes until the next scene_heading (exclusive).
 * Throws Chinese AppException if seed cannot resolve to a scene.
 */
export function expandSceneNodeIds(nodes: ScreenplayNode[], seedIds: string[]): string[] {
  if (!seedIds.length) {
    throw new AppException(ErrorCode.INVALID_INPUT, '请先把光标放在某一场内');
  }
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < nodes.length; i += 1) {
    idToIndex.set(nodes[i].id, i);
  }

  let seedIndex = -1;
  for (const id of seedIds) {
    const idx = idToIndex.get(id);
    if (idx !== undefined) {
      seedIndex = idx;
      break;
    }
  }
  if (seedIndex === -1) {
    throw new AppException(ErrorCode.INVALID_INPUT, '无法定位当前场次，请先把光标放在某一场内');
  }

  // Walk backward to the containing scene_heading (or stay if seed is a heading).
  let start = seedIndex;
  while (start > 0 && nodes[start].type !== 'scene_heading') {
    start -= 1;
  }
  if (nodes[start].type !== 'scene_heading') {
    throw new AppException(ErrorCode.INVALID_INPUT, '无法定位当前场次，请先把光标放在某一场内');
  }

  let end = start + 1;
  while (end < nodes.length && nodes[end].type !== 'scene_heading') {
    end += 1;
  }

  const expanded = nodes.slice(start, end).map((n) => n.id);
  if (expanded.length === 0) {
    throw new AppException(ErrorCode.INVALID_INPUT, '当前场次没有可修订的节点');
  }
  return expanded;
}

function sliceScope(nodes: ScreenplayNode[], nodeIds: string[]): ScreenplayNode[] {
  assertExactContiguousSelection(nodes, nodeIds);
  const scopeSet = new Set(nodeIds);
  let rangeStart = -1;
  let rangeEnd = -1;
  for (let i = 0; i < nodes.length; i += 1) {
    if (scopeSet.has(nodes[i].id)) {
      if (rangeStart === -1) rangeStart = i;
      rangeEnd = i;
    }
  }
  if (rangeStart === -1) {
    throw new AppException(ErrorCode.INVALID_INPUT, '范围内没有可修订的节点');
  }
  return nodes.slice(rangeStart, rangeEnd + 1);
}

async function tryAgentOsRevise(input: {
  nodes: ScreenplayNode[];
  nodeIds: string[];
  instruction: string;
  scopeType: 'selection' | 'scene';
  format?: ScreenplayFormat;
  userId?: string;
  requestId?: string;
}): Promise<ScreenplayNode[] | null> {
  if (!input.userId) {
    throw new AppException(ErrorCode.LLM_NOT_CONFIGURED, '未配置默认文本模型，请先在设置中配置 LLM');
  }

  let llmHeaders: Record<string, string>;
  try {
    llmHeaders = await llmConfigService.getLLMHeaders(input.userId, 'TEXT_LLM');
  } catch (err) {
    if (err instanceof AppException) {
      throw new AppException(ErrorCode.LLM_NOT_CONFIGURED, '未配置默认文本模型，请先在设置中配置 LLM');
    }
    throw new AppException(ErrorCode.LLM_NOT_CONFIGURED, '未配置默认文本模型，请先在设置中配置 LLM');
  }

  const scoped = sliceScope(input.nodes, input.nodeIds);

  try {
    const res = await startWorkflowRun(
      REVISE_WORKFLOW_ID,
      {
        instruction: input.instruction,
        nodes: scoped,
        format: input.format ?? 'hollywood',
      },
      { llmHeaders, requestId: input.requestId, timeoutMs: 90_000 }
    );

    const parsed = parseRevisePayload(await res.json());
    if (!parsed) {
      logger.warn({ requestId: input.requestId }, 'reviseworkflow returned no usable nodes');
      throw new AppException(ErrorCode.UPSTREAM_ERROR, 'AI 返回的修订结果无效', { retryable: true });
    }
    return parsed;
  } catch (err) {
    if (err instanceof AppException) throw err;
    logger.info({ err, requestId: input.requestId }, 'reviseworkflow unavailable');
    return null;
  }
}

export function parseRevisePayload(payload: unknown): ScreenplayNode[] | null {
  const unwrapped = unwrapWorkflowJson(payload);
  const record = unwrapped as Record<string, unknown>;
  const candidates = [
    record.nodes,
    record.replacements,
    Array.isArray(unwrapped) ? unwrapped : null,
    record.content,
    record.output,
    unwrapped,
    payload,
  ];

  for (const candidate of candidates) {
    const nodes = coerceNodeArray(candidate);
    if (nodes) return nodes;
  }
  return null;
}

function coerceNodeArray(value: unknown): ScreenplayNode[] | null {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const nodes: ScreenplayNode[] = [];
  for (const item of raw) {
    const node = asScreenplayNode(item);
    if (!node) return null;
    nodes.push(node);
  }
  return nodes;
}

function asScreenplayNode(value: unknown): ScreenplayNode | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  if (typeof record.type !== 'string' || !NODE_TYPE_SET.has(record.type)) return null;
  if (typeof record.text !== 'string') return null;
  return {
    id: record.id.trim(),
    type: record.type as NodeType,
    text: stripHtml(record.text),
  };
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

function normalizeCover(value: unknown): Cover {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    title: typeof raw.title === 'string' ? raw.title : EMPTY_COVER.title,
    author: typeof raw.author === 'string' ? raw.author : EMPTY_COVER.author,
    contact: typeof raw.contact === 'string' ? raw.contact : EMPTY_COVER.contact,
    draftDate: typeof raw.draftDate === 'string' ? raw.draftDate : EMPTY_COVER.draftDate,
  };
}

function normalizeNodes(value: unknown): ScreenplayNode[] {
  if (!Array.isArray(value)) return [];
  const nodes: ScreenplayNode[] = [];
  for (const item of value) {
    const node = asScreenplayNode(item);
    if (node) nodes.push(node);
  }
  return nodes;
}

function parseCoverInput(value: unknown, fallback: Cover): Cover {
  if (value === undefined) return fallback;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'cover 格式无效');
  }
  const raw = value as Record<string, unknown>;
  const next = { ...fallback };
  for (const key of ['title', 'author', 'contact', 'draftDate'] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== 'string') {
      throw new AppException(ErrorCode.INVALID_INPUT, `cover.${key} 必须是字符串`);
    }
    next[key] = raw[key];
  }
  return next;
}

function parseNodesInput(value: unknown): ScreenplayNode[] {
  if (!Array.isArray(value)) {
    throw new AppException(ErrorCode.INVALID_INPUT, 'nodes 必须是数组');
  }
  const nodes: ScreenplayNode[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const node = asScreenplayNode(item);
    if (!node) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'nodes 含有无效节点');
    }
    if (seen.has(node.id)) {
      throw new AppException(ErrorCode.INVALID_INPUT, '节点 id 不能重复');
    }
    seen.add(node.id);
    nodes.push(node);
  }
  return nodes;
}

function toDoc(
  screenplay: {
    id: string;
    episodeId: string;
    title: string;
    cover: Prisma.JsonValue;
    nodes: Prisma.JsonValue;
    updatedAt: Date;
  },
  format: ScreenplayFormat
): ScreenplayDoc {
  return {
    id: screenplay.id,
    episodeId: screenplay.episodeId,
    title: screenplay.title,
    format,
    cover: normalizeCover(screenplay.cover),
    nodes: normalizeNodes(screenplay.nodes),
    updatedAt: screenplay.updatedAt.toISOString(),
  };
}

function toCharacterRecord(row: {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  images: Prisma.JsonValue;
  castingNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CharacterRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    images: row.images,
    castingNotes: row.castingNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toLocationRecord(row: {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  images: Prisma.JsonValue;
  storyPlace: string | null;
  shootPlace: string | null;
  createdAt: Date;
  updatedAt: Date;
}): LocationRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    images: row.images,
    storyPlace: row.storyPlace,
    shootPlace: row.shootPlace,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class ScreenplayService {
  async requireAccess(
    projectId: string,
    userId: string,
    options?: { write?: boolean }
  ): Promise<AccessContext> {
    const access = await resolveAccess(projectId, userId, options);
    return { projectId: access.projectId, format: access.format, role: access.role };
  }

  private async loadEpisode(
    projectId: string,
    episodeId: string,
    userId: string,
    options?: { write?: boolean }
  ): Promise<LoadedEpisode> {
    const access = await this.requireAccess(projectId, userId, options);
    const episode = await prisma.episode.findFirst({
      where: { id: episodeId, projectId },
      include: { screenplay: true },
    });
    if (!episode) {
      throw new AppException(ErrorCode.NOT_FOUND, '集不存在');
    }
    return {
      access,
      episodeId: episode.id,
      episodeName: episode.name,
      screenplay: episode.screenplay,
    };
  }

  async getScreenplay(
    projectId: string,
    episodeId: string,
    userId: string
  ): Promise<ScreenplayDoc> {
    const loaded = await this.loadEpisode(projectId, episodeId, userId);
    if (!loaded.screenplay) {
      throw new AppException(ErrorCode.NOT_FOUND, '剧本不存在');
    }
    return toDoc(loaded.screenplay, loaded.access.format);
  }

  async putScreenplay(
    projectId: string,
    episodeId: string,
    userId: string,
    body: { title?: unknown; cover?: unknown; nodes?: unknown }
  ): Promise<ScreenplayDoc> {
    const loaded = await this.loadEpisode(projectId, episodeId, userId, { write: true });
    if (body.nodes === undefined) {
      throw new AppException(ErrorCode.MISSING_REQUIRED_FIELD, 'nodes 不能为空');
    }

    const existingCover = loaded.screenplay
      ? normalizeCover(loaded.screenplay.cover)
      : { ...EMPTY_COVER };
    const title =
      body.title === undefined
        ? loaded.screenplay?.title ?? loaded.episodeName
        : this.parseTitle(body.title);
    const cover = parseCoverInput(body.cover, existingCover);
    const nodes = parseNodesInput(body.nodes);

    const screenplay = await this.persistWithVersion({
      existing: loaded.screenplay,
      episodeId: loaded.episodeId,
      title,
      cover,
      nodes,
      summary: '保存',
    });

    await deriveFromNodes(projectId, nodes, episodeId);
    return toDoc(screenplay, loaded.access.format);
  }

  async listVersions(
    projectId: string,
    episodeId: string,
    userId: string
  ): Promise<{ data: ScreenplayVersionMeta[] }> {
    const loaded = await this.loadEpisode(projectId, episodeId, userId);
    if (!loaded.screenplay) {
      return { data: [] };
    }
    const versions = await prisma.screenplayVersion.findMany({
      where: { screenplayId: loaded.screenplay.id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, summary: true, createdAt: true },
    });
    return {
      data: versions.map((row) => ({
        id: row.id,
        version: row.version,
        summary: row.summary,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async revertVersion(
    projectId: string,
    episodeId: string,
    versionId: string,
    userId: string
  ): Promise<ScreenplayDoc> {
    const loaded = await this.loadEpisode(projectId, episodeId, userId, { write: true });
    if (!loaded.screenplay) {
      throw new AppException(ErrorCode.NOT_FOUND, '剧本不存在');
    }

    const version = await prisma.screenplayVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.screenplayId !== loaded.screenplay.id) {
      throw new AppException(ErrorCode.NOT_FOUND, '版本不存在');
    }

    const cover = normalizeCover(version.cover);
    const nodes = parseNodesInput(version.nodes);
    const screenplay = await this.persistWithVersion({
      existing: loaded.screenplay,
      episodeId: loaded.episodeId,
      title: loaded.screenplay.title,
      cover,
      nodes,
      summary: `回滚到 v${version.version}`,
    });

    await deriveFromNodes(projectId, nodes, episodeId);
    return toDoc(screenplay, loaded.access.format);
  }

  /**
   * Preview revise: run LLM and return proposed scoped replacements without persist/version.
   * On LLM/AgentOS failure with nonempty instruction: throw Chinese AppException; draft untouched.
   */
  async previewRevise(
    projectId: string,
    episodeId: string,
    userId: string,
    body: { instruction?: unknown; scope?: unknown },
    requestId?: string
  ): Promise<ReviseProposal> {
    const loaded = await this.loadEpisode(projectId, episodeId, userId, { write: true });
    if (!loaded.screenplay) {
      throw new AppException(ErrorCode.NOT_FOUND, '剧本不存在');
    }

    const instruction = this.parseInstruction(body.instruction);
    const parsedScope = this.parseScope(body.scope);
    const current = normalizeNodes(loaded.screenplay.nodes);
    const scope = this.resolveScopeNodeIds(current, parsedScope);

    const replacements = await reviseWithLlm({
      nodes: current,
      nodeIds: scope.nodeIds,
      instruction,
      scopeType: scope.type,
      format: loaded.access.format,
      userId,
      requestId,
    });

    // Validate range safety without writing.
    applyNodePatch(current, replacements, scope.nodeIds);

    return {
      instruction,
      scope,
      replacements,
      proposalText: formatProposalText(replacements),
    };
  }

  /**
   * Accept a previously previewed proposal: apply scoped replacements, persist + version + derive.
   */
  async acceptRevise(
    projectId: string,
    episodeId: string,
    userId: string,
    body: { replacements?: unknown; scope?: unknown }
  ): Promise<ScreenplayDoc> {
    const loaded = await this.loadEpisode(projectId, episodeId, userId, { write: true });
    if (!loaded.screenplay) {
      throw new AppException(ErrorCode.NOT_FOUND, '剧本不存在');
    }

    const parsedScope = this.parseScope(body.scope);
    const replacements = parseNodesInput(body.replacements);
    if (replacements.length === 0) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'replacements 不能为空');
    }

    const current = normalizeNodes(loaded.screenplay.nodes);
    const scope = this.resolveScopeNodeIds(current, parsedScope);
    const nodes = applyNodePatch(current, replacements, scope.nodeIds);
    const cover = normalizeCover(loaded.screenplay.cover);
    const screenplay = await this.persistWithVersion({
      existing: loaded.screenplay,
      episodeId: loaded.episodeId,
      title: loaded.screenplay.title,
      cover,
      nodes,
      summary: '修订',
    });

    await deriveFromNodes(projectId, nodes, episodeId);
    return toDoc(screenplay, loaded.access.format);
  }

  /** @deprecated Prefer previewRevise + acceptRevise. Kept only if callers still expect one-shot. */
  async reviseScreenplay(
    projectId: string,
    episodeId: string,
    userId: string,
    body: { instruction?: unknown; scope?: unknown },
    requestId?: string
  ): Promise<ScreenplayDoc> {
    const proposal = await this.previewRevise(projectId, episodeId, userId, body, requestId);
    return this.acceptRevise(projectId, episodeId, userId, {
      replacements: proposal.replacements,
      scope: proposal.scope,
    });
  }

  async listCharacters(projectId: string, userId: string): Promise<{ data: CharacterRecord[] }> {
    await this.requireAccess(projectId, userId);
    const rows = await prisma.character.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return { data: rows.map(toCharacterRecord) };
  }

  async updateCharacter(
    projectId: string,
    characterId: string,
    userId: string,
    input: { description?: string | null; castingNotes?: string | null }
  ): Promise<CharacterRecord> {
    await this.requireAccess(projectId, userId, { write: true });
    const existing = await prisma.character.findFirst({
      where: { id: characterId, projectId },
    });
    if (!existing) {
      throw new AppException(ErrorCode.NOT_FOUND, '角色不存在');
    }
    const updated = await prisma.character.update({
      where: { id: characterId },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.castingNotes !== undefined ? { castingNotes: input.castingNotes } : {}),
      },
    });
    return toCharacterRecord(updated);
  }

  async listLocations(projectId: string, userId: string): Promise<{ data: LocationRecord[] }> {
    await this.requireAccess(projectId, userId);
    const rows = await prisma.location.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return { data: rows.map(toLocationRecord) };
  }

  async updateLocation(
    projectId: string,
    locationId: string,
    userId: string,
    input: {
      description?: string | null;
      storyPlace?: string | null;
      shootPlace?: string | null;
    }
  ): Promise<LocationRecord> {
    await this.requireAccess(projectId, userId, { write: true });
    const existing = await prisma.location.findFirst({
      where: { id: locationId, projectId },
    });
    if (!existing) {
      throw new AppException(ErrorCode.NOT_FOUND, '地点不存在');
    }
    const updated = await prisma.location.update({
      where: { id: locationId },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.storyPlace !== undefined ? { storyPlace: input.storyPlace } : {}),
        ...(input.shootPlace !== undefined ? { shootPlace: input.shootPlace } : {}),
      },
    });
    return toLocationRecord(updated);
  }

  private parseTitle(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'title 必须是非空字符串');
    }
    return value;
  }

  private parseInstruction(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'instruction 必须是字符串');
    }
    return value;
  }

  private parseScope(value: unknown): { type: 'selection' | 'scene'; nodeIds: string[] } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'scope 格式无效');
    }
    const raw = value as Record<string, unknown>;
    if (raw.type !== 'selection' && raw.type !== 'scene') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'scope.type 必须是 selection 或 scene');
    }
    if (!Array.isArray(raw.nodeIds)) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'scope.nodeIds 必须是数组');
    }
    const nodeIds = raw.nodeIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    if (nodeIds.length === 0) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'nodeIds 不能为空');
    }
    return { type: raw.type, nodeIds };
  }

  /**
   * selection: exact contiguous nodeIds only — never expandSceneNodeIds / never fill holes.
   * scene: expand seed ids to the full scene span.
   */
  private resolveScopeNodeIds(
    nodes: ScreenplayNode[],
    scope: { type: 'selection' | 'scene'; nodeIds: string[] }
  ): { type: 'selection' | 'scene'; nodeIds: string[] } {
    if (scope.type === 'selection') {
      assertExactContiguousSelection(nodes, scope.nodeIds);
      // Echo request ids unchanged — proves no silent expand.
      return { type: 'selection', nodeIds: [...scope.nodeIds] };
    }
    return { type: 'scene', nodeIds: expandSceneNodeIds(nodes, scope.nodeIds) };
  }

  private async persistWithVersion(input: {
    existing: LoadedEpisode['screenplay'];
    episodeId: string;
    title: string;
    cover: Cover;
    nodes: ScreenplayNode[];
    summary: string;
  }) {
    const coverJson = input.cover as unknown as Prisma.InputJsonValue;
    const nodesJson = input.nodes as unknown as Prisma.InputJsonValue;
    let existing = input.existing;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const current = existing;
          const screenplay = current
            ? await tx.screenplay.update({
                where: { id: current.id },
                data: { title: input.title, cover: coverJson, nodes: nodesJson },
              })
            : await tx.screenplay.create({
                data: {
                  episodeId: input.episodeId,
                  title: input.title,
                  cover: coverJson,
                  nodes: nodesJson,
                },
              });

          const latest = await tx.screenplayVersion.findFirst({
            where: { screenplayId: screenplay.id },
            orderBy: { version: 'desc' },
            select: { version: true },
          });

          await tx.screenplayVersion.create({
            data: {
              screenplayId: screenplay.id,
              version: (latest?.version ?? 0) + 1,
              summary: input.summary,
              cover: screenplay.cover as Prisma.InputJsonValue,
              nodes: screenplay.nodes as Prisma.InputJsonValue,
            },
          });

          return screenplay;
        });
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        if (code === 'P2002' && attempt < 2) {
          const found = await prisma.screenplay.findUnique({
            where: { episodeId: input.episodeId },
          });
          if (found) existing = found;
          continue;
        }
        throw err;
      }
    }

    throw new AppException(ErrorCode.CONFLICT, '版本写入冲突');
  }
}
