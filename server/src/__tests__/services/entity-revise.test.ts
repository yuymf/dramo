import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCharacterFind = jest.fn();
const mockLocationFind = jest.fn();
const mockGetLLMHeaders = jest.fn();

jest.mock('../../lib/db', () => ({ prisma: {
  character: { findFirst: mockCharacterFind },
  location: { findFirst: mockLocationFind },
} }));
jest.mock('../../lib/agentos-client', () => ({ startWorkflowRun: jest.fn() }));
jest.mock('../../services/llm-config.service', () => ({
  LLMConfigService: jest.fn().mockImplementation(() => ({ getLLMHeaders: mockGetLLMHeaders })),
}));
jest.mock('../../services/derive.service', () => ({ deriveFromNodes: jest.fn() }));

import { startWorkflowRun } from '../../lib/agentos-client.js';
import { ErrorCode, AppException } from '../../lib/errors.js';
import { EntityReviseService, diffEntityNodes, parseEntityDiff, parseEntityType } from '../../services/entity-revise.js';
import type { ScreenplayService } from '../../services/screenplay.service.js';

const mockStart = startWorkflowRun as jest.MockedFunction<typeof startWorkflowRun>;
const mocked = (fn: unknown) => fn as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const character = { id: 'c1', projectId: 'p1', name: '林晚', description: '旧描述', castingNotes: '旧备注' };
const location = { id: 'l1', projectId: 'p1', name: '车厢', description: '旧场景', storyPlace: '上海', shootPlace: '摄影棚' };
const access = jest.fn();
const updateCharacter = jest.fn();
const updateLocation = jest.fn();
const service = new EntityReviseService({
  requireAccess: access, updateCharacter, updateLocation,
} as unknown as ScreenplayService);

function llmNodes(nodes: Array<{ id: string; type: string; text: string }>) {
  mocked(mockStart).mockResolvedValue({ ok: true, json: async () => ({ content: JSON.stringify({ nodes }) }) } as Response);
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked(mockCharacterFind).mockResolvedValue(character);
  mocked(mockLocationFind).mockResolvedValue(location);
  mocked(mockGetLLMHeaders).mockResolvedValue({ 'X-LLM-Api-Key': 'test' });
  mocked(updateCharacter).mockImplementation(async (_project: string, _id: string, _user: string, patch: object) => ({ ...character, ...patch }));
  mocked(updateLocation).mockImplementation(async (_project: string, _id: string, _user: string, patch: object) => ({ ...location, ...patch }));
});

describe('entity revise scope and allowlist', () => {
  it('rejects unsupported entity types and identity fields before any write', () => {
    expect(() => parseEntityType('prop')).toThrow(AppException);
    expect(() => parseEntityDiff('character', [{ field: 'name', before: '林晚', after: '别人' }])).toThrow(AppException);
    expect(() => parseEntityDiff('location', [{ field: 'castingNotes', before: null, after: 'x' }])).toThrow(AppException);
    expect(() => parseEntityDiff('character', [{ field: 'description', before: '旧', after: '新', name: 'x' }])).toThrow(AppException);
    expect(() => parseEntityDiff('character', [
      { field: 'description', before: '旧', after: '新' },
      { field: 'description', before: '旧', after: '另一个' },
    ])).toThrow(AppException);
    expect(updateCharacter).not.toHaveBeenCalled();
  });

  it('preview produces field diff and never writes any entity or screenplay node', async () => {
    llmNodes([
      { id: 'c1:description', type: 'action', text: '新描述' },
      { id: 'c1:castingNotes', type: 'action', text: '旧备注' },
    ]);
    const preview = await service.preview('character', 'p1', 'c1', 'u1', { instruction: '更鲜明' });
    expect(preview.diff).toEqual([{ field: 'description', before: '旧描述', after: '新描述' }]);
    expect(preview.proposalText).toContain('新描述');
    expect(mockStart).toHaveBeenCalledWith('reviseworkflow', expect.objectContaining({
      nodes: expect.arrayContaining([{ id: 'c1:description', type: 'action', text: '旧描述' }]),
    }), expect.anything());
    expect(updateCharacter).not.toHaveBeenCalled();
    expect(updateLocation).not.toHaveBeenCalled();
    expect(mockLocationFind).not.toHaveBeenCalled();
  });

  it('reject / no-model / failed validation never write', async () => {
    mocked(mockGetLLMHeaders).mockRejectedValue(new AppException(ErrorCode.LLM_NOT_CONFIGURED, 'missing'));
    await expect(service.preview('character', 'p1', 'c1', 'u1', { instruction: '修改' })).rejects.toMatchObject({
      code: ErrorCode.LLM_NOT_CONFIGURED,
      message: '未配置默认文本模型，请先在设置中配置 LLM',
    });
    expect(mockStart).not.toHaveBeenCalled();
    expect(updateCharacter).not.toHaveBeenCalled();
    llmNodes([{ id: 'c1:name', type: 'action', text: '改名' }]);
    mocked(mockGetLLMHeaders).mockResolvedValue({ 'X-LLM-Api-Key': 'test' });
    await expect(service.preview('character', 'p1', 'c1', 'u1', { instruction: '修改' })).rejects.toMatchObject({ code: ErrorCode.INVALID_INPUT });
    expect(updateCharacter).not.toHaveBeenCalled();
    // Reject is client-only: no accept call and no mutation.
  });

  it('accept changes only target character allowlisted fields; stale and invalid diffs fail', async () => {
    await service.accept('character', 'p1', 'c1', 'u1', {
      diff: [{ field: 'description', before: '旧描述', after: '新描述' }],
    });
    expect(updateCharacter).toHaveBeenCalledWith('p1', 'c1', 'u1', { description: '新描述' });
    expect(updateLocation).not.toHaveBeenCalled();
    expect(mockLocationFind).not.toHaveBeenCalled();
    mocked(updateCharacter).mockClear();
    await expect(service.accept('character', 'p1', 'c1', 'u1', {
      diff: [{ field: 'description', before: '过时内容', after: '新描述' }],
    })).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(updateCharacter).not.toHaveBeenCalled();
  });

  it('location proposal and accept can change storyPlace and shootPlace only', async () => {
    llmNodes([
      { id: 'l1:description', type: 'action', text: '旧场景' },
      { id: 'l1:storyPlace', type: 'action', text: '苏州' },
      { id: 'l1:shootPlace', type: 'action', text: '老厂房' },
    ]);
    const proposal = await service.preview('location', 'p1', 'l1', 'u1', { instruction: '改地点' });
    expect(proposal.diff).toEqual([
      { field: 'storyPlace', before: '上海', after: '苏州' },
      { field: 'shootPlace', before: '摄影棚', after: '老厂房' },
    ]);
    expect(updateLocation).not.toHaveBeenCalled();
    await service.accept('location', 'p1', 'l1', 'u1', { diff: proposal.diff });
    expect(updateLocation).toHaveBeenCalledWith('p1', 'l1', 'u1', { storyPlace: '苏州', shootPlace: '老厂房' });
    expect(updateCharacter).not.toHaveBeenCalled();
  });

  it('rejects extra LLM nodes outside location allowlist', () => {
    expect(() => diffEntityNodes('location', 'l1', location as any, [ // eslint-disable-line @typescript-eslint/no-explicit-any
      { id: 'l1:name', type: 'action', text: '别名' },
    ])).toThrow(AppException);
  });
});
