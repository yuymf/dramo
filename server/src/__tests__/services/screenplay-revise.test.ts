import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../lib/db', () => ({
  prisma: {},
}));

jest.mock('../../lib/agentos-client', () => ({
  startWorkflowRun: jest.fn(),
}));

const mockGetLLMHeaders = jest.fn();

jest.mock('../../services/llm-config.service', () => ({
  LLMConfigService: jest.fn().mockImplementation(() => ({
    getLLMHeaders: mockGetLLMHeaders,
  })),
}));

jest.mock('../../services/derive.service', () => ({
  deriveFromNodes: jest.fn(),
}));

import { startWorkflowRun } from '../../lib/agentos-client.js';
import { AppException, ErrorCode } from '../../lib/errors.js';
import {
  applyNodePatch,
  assertExactContiguousSelection,
  expandSceneNodeIds,
  parseRevisePayload,
  placeholderRevise,
  reviseWithLlm,
} from '../../services/screenplay.service.js';

const mockedStart = startWorkflowRun as jest.MockedFunction<typeof startWorkflowRun>;
// jest.Mock defaults to never for mockResolvedValue under @jest/globals.
const mocked = (fn: unknown) => fn as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const sampleNodes = [
  { id: 'a', type: 'action' as const, text: '一' },
  { id: 'b', type: 'dialogue' as const, text: '二' },
  { id: 'c', type: 'action' as const, text: '三' },
  { id: 'd', type: 'dialogue' as const, text: '四' },
];

describe('parseRevisePayload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unwraps AgentOS { content: jsonString } into nodes', () => {
    const nodes = [{ id: 'n1', type: 'dialogue', text: '改过了' }];
    const parsed = parseRevisePayload({
      content: JSON.stringify({ nodes }),
    });
    expect(parsed).toEqual(nodes);
  });

  it('accepts a bare node array after unwrap', () => {
    const nodes = [{ id: 'n2', type: 'action', text: '他坐下' }];
    const parsed = parseRevisePayload({
      content: JSON.stringify(nodes),
    });
    expect(parsed).toEqual(nodes);
  });

  it('rejects invalid node types', () => {
    const parsed = parseRevisePayload({
      nodes: [{ id: 'n3', type: 'shot', text: 'x' }],
    });
    expect(parsed).toBeNull();
  });

  it('strips HTML from text', () => {
    const parsed = parseRevisePayload({
      nodes: [{ id: 'n4', type: 'dialogue', text: '<em>你好</em>' }],
    });
    expect(parsed).toEqual([{ id: 'n4', type: 'dialogue', text: '你好' }]);
  });
});

describe('applyNodePatch range safety', () => {
  it('replaces only the scoped contiguous range', () => {
    const next = applyNodePatch(
      sampleNodes,
      [{ id: 'b', type: 'dialogue', text: '改' }],
      ['b', 'c']
    );
    expect(next.map((n) => n.id)).toEqual(['a', 'b', 'd']);
    expect(next[1].text).toBe('改');
    expect(next[2].text).toBe('四');
  });

  it('rejects replacements that touch out-of-range ids', () => {
    expect(() =>
      applyNodePatch(
        sampleNodes,
        [
          { id: 'b', type: 'dialogue', text: '改' },
          { id: 'a', type: 'action', text: '越界' },
        ],
        ['b', 'c']
      )
    ).toThrow(AppException);
  });

  it('accept path only patches scope — out-of-scope nodes stay identical', () => {
    const replacements = [
      { id: 'b', type: 'dialogue' as const, text: '新对白' },
      { id: 'c', type: 'action' as const, text: '新动作' },
    ];
    const next = applyNodePatch(sampleNodes, replacements, ['b', 'c']);
    expect(next[0]).toEqual(sampleNodes[0]);
    expect(next[1].text).toBe('新对白');
    expect(next[2].text).toBe('新动作');
    expect(next[3]).toEqual(sampleNodes[3]);
  });
});

describe('reviseWithLlm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked(mockGetLLMHeaders).mockReset();
    mocked(mockGetLLMHeaders).mockResolvedValue({
      'X-LLM-Api-Key': 'k',
      'X-LLM-Base-Url': 'https://example.com/v1',
      'X-LLM-Model-Id': 'deepseek-v4.1-flash',
    });
  });

  it('calls reviseworkflow with scoped nodes and format', async () => {
    const replacements = [{ id: 'b', type: 'dialogue' as const, text: '改' }];
    mockedStart.mockResolvedValue({
      ok: true,
      json: async () => ({ content: JSON.stringify({ nodes: replacements }) }),
    } as Response);

    const result = await reviseWithLlm({
      nodes: sampleNodes,
      nodeIds: ['b'],
      instruction: '更狠一点',
      scopeType: 'selection',
      format: 'asian',
      userId: 'u1',
    });

    expect(mockedStart).toHaveBeenCalledWith(
      'reviseworkflow',
      expect.objectContaining({
        instruction: '更狠一点',
        format: 'asian',
        nodes: [sampleNodes[1]],
      }),
      expect.objectContaining({ timeoutMs: 90_000 })
    );
    expect(result).toEqual(replacements);
  });

  it('empty instruction uses placeholder without calling AgentOS', async () => {
    const result = await reviseWithLlm({
      nodes: sampleNodes,
      nodeIds: ['b', 'c'],
      instruction: '   ',
      scopeType: 'selection',
      userId: 'u1',
    });
    expect(mockedStart).not.toHaveBeenCalled();
    expect(result).toEqual(placeholderRevise(sampleNodes, ['b', 'c'], ''));
  });

  it('fail path: missing LLM config throws Chinese and does not call AgentOS (no persist)', async () => {
    mocked(mockGetLLMHeaders).mockRejectedValue(
      new AppException(ErrorCode.LLM_NOT_CONFIGURED, 'No default TEXT_LLM configuration found')
    );

    await expect(
      reviseWithLlm({
        nodes: sampleNodes,
        nodeIds: ['b'],
        instruction: '改一下',
        scopeType: 'selection',
        userId: 'u1',
      })
    ).rejects.toMatchObject({
      code: ErrorCode.LLM_NOT_CONFIGURED,
      message: '未配置默认文本模型，请先在设置中配置 LLM',
    });
    expect(mockedStart).not.toHaveBeenCalled();
  });

  it('fail path: AgentOS unavailable throws Chinese — never placeholder success', async () => {
    mockedStart.mockRejectedValue(new Error('AGENTOS_503: down'));

    await expect(
      reviseWithLlm({
        nodes: sampleNodes,
        nodeIds: ['b'],
        instruction: '改一下',
        scopeType: 'selection',
        userId: 'u1',
      })
    ).rejects.toMatchObject({
      code: ErrorCode.UPSTREAM_ERROR,
      message: 'AI 修订服务暂不可用，请稍后重试',
    });
  });

  it('fail path: unusable payload throws Chinese — no placeholder', async () => {
    mockedStart.mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'not-json-nodes' }),
    } as Response);

    await expect(
      reviseWithLlm({
        nodes: sampleNodes,
        nodeIds: ['b'],
        instruction: '改一下',
        scopeType: 'selection',
        userId: 'u1',
      })
    ).rejects.toMatchObject({
      code: ErrorCode.UPSTREAM_ERROR,
      message: 'AI 返回的修订结果无效',
    });
  });

  it('fail path: out-of-range replacements rejected', async () => {
    mockedStart.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: JSON.stringify({
          nodes: [
            { id: 'b', type: 'dialogue', text: '改' },
            { id: 'a', type: 'action', text: '越界' },
          ],
        }),
      }),
    } as Response);

    await expect(
      reviseWithLlm({
        nodes: sampleNodes,
        nodeIds: ['b', 'c'],
        instruction: '改一下',
        scopeType: 'selection',
        userId: 'u1',
      })
    ).rejects.toMatchObject({
      code: ErrorCode.INVALID_INPUT,
      message: 'AI 修订结果超出选区范围',
    });
  });
});

const twoSceneNodes = [
  { id: 's1', type: 'scene_heading' as const, text: '内景 咖啡馆 - 日' },
  { id: 'a1', type: 'action' as const, text: '小明推门。' },
  { id: 'c1', type: 'character' as const, text: '小明' },
  { id: 'd1', type: 'dialogue' as const, text: '一杯美式。' },
  { id: 's2', type: 'scene_heading' as const, text: '外景 街道 - 夜' },
  { id: 'a2', type: 'action' as const, text: '雨更大了。' },
  { id: 'c2', type: 'character' as const, text: '店员' },
  { id: 'd2', type: 'dialogue' as const, text: '再见。' },
];

describe('expandSceneNodeIds', () => {
  it('expands from an in-scene seed to the full scene span', () => {
    expect(expandSceneNodeIds(twoSceneNodes, ['d1'])).toEqual(['s1', 'a1', 'c1', 'd1']);
  });

  it('when seed is a scene_heading, includes from that heading', () => {
    expect(expandSceneNodeIds(twoSceneNodes, ['s2'])).toEqual(['s2', 'a2', 'c2', 'd2']);
  });

  it('does not include the next scene', () => {
    const ids = expandSceneNodeIds(twoSceneNodes, ['a1']);
    expect(ids).not.toContain('s2');
    expect(ids).not.toContain('a2');
  });

  it('fails Chinese when seed cannot resolve', () => {
    expect(() => expandSceneNodeIds(twoSceneNodes, ['missing'])).toThrow(AppException);
    try {
      expandSceneNodeIds(twoSceneNodes, ['missing']);
    } catch (err) {
      expect(err).toMatchObject({
        code: ErrorCode.INVALID_INPUT,
        message: expect.stringMatching(/无法定位当前场次|请先把光标放在某一场内/),
      });
    }
  });

  it('fails Chinese when seed is before any scene_heading', () => {
    const orphan = [
      { id: 'x', type: 'action' as const, text: '开场旁白' },
      ...twoSceneNodes,
    ];
    expect(() => expandSceneNodeIds(orphan, ['x'])).toThrow(AppException);
  });

  it('fails Chinese on empty seed', () => {
    expect(() => expandSceneNodeIds(twoSceneNodes, [])).toThrow(AppException);
    try {
      expandSceneNodeIds(twoSceneNodes, []);
    } catch (err) {
      expect((err as AppException).message).toMatch(/请先把光标放在某一场内/);
    }
  });
});

describe('scene-scoped applyNodePatch', () => {
  it('accept only mutates scene A; scene B unchanged', () => {
    const sceneAIds = expandSceneNodeIds(twoSceneNodes, ['d1']);
    const replacements = [
      { id: 's1', type: 'scene_heading' as const, text: '内景 咖啡馆 - 日' },
      { id: 'a1', type: 'action' as const, text: '小明猛地推门。' },
      { id: 'c1', type: 'character' as const, text: '小明' },
      { id: 'd1', type: 'dialogue' as const, text: '一杯美式，快！' },
    ];
    const next = applyNodePatch(twoSceneNodes, replacements, sceneAIds);
    expect(next.find((n) => n.id === 'a1')?.text).toBe('小明猛地推门。');
    expect(next.find((n) => n.id === 'd1')?.text).toBe('一杯美式，快！');
    // Scene B identical
    expect(next.find((n) => n.id === 's2')).toEqual(twoSceneNodes.find((n) => n.id === 's2'));
    expect(next.find((n) => n.id === 'a2')).toEqual(twoSceneNodes.find((n) => n.id === 'a2'));
    expect(next.find((n) => n.id === 'c2')).toEqual(twoSceneNodes.find((n) => n.id === 'c2'));
    expect(next.find((n) => n.id === 'd2')).toEqual(twoSceneNodes.find((n) => n.id === 'd2'));
  });

  it('rejects replacements that touch scene B when scope is scene A', () => {
    const sceneAIds = expandSceneNodeIds(twoSceneNodes, ['a1']);
    expect(() =>
      applyNodePatch(
        twoSceneNodes,
        [
          { id: 'a1', type: 'action', text: '改' },
          { id: 'a2', type: 'action', text: '越界到 B' },
        ],
        sceneAIds
      )
    ).toThrow(AppException);
  });
});

describe('reviseWithLlm scene scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked(mockGetLLMHeaders).mockReset();
    mocked(mockGetLLMHeaders).mockResolvedValue({
      'X-LLM-Api-Key': 'k',
      'X-LLM-Base-Url': 'https://example.com/v1',
      'X-LLM-Model-Id': 'deepseek-v4.1-flash',
    });
  });

  it('no-LLM Chinese fail for scene path — never placeholder success', async () => {
    mocked(mockGetLLMHeaders).mockRejectedValue(
      new AppException(ErrorCode.LLM_NOT_CONFIGURED, 'No default TEXT_LLM configuration found')
    );
    const sceneIds = expandSceneNodeIds(twoSceneNodes, ['d1']);
    await expect(
      reviseWithLlm({
        nodes: twoSceneNodes,
        nodeIds: sceneIds,
        instruction: '把本场对白改急一点',
        scopeType: 'scene',
        userId: 'u1',
      })
    ).rejects.toMatchObject({
      code: ErrorCode.LLM_NOT_CONFIGURED,
      message: '未配置默认文本模型，请先在设置中配置 LLM',
    });
    expect(mockedStart).not.toHaveBeenCalled();
  });

  it('calls AgentOS with expanded scene nodes only', async () => {
    const sceneIds = expandSceneNodeIds(twoSceneNodes, ['d1']);
    const replacements = sceneIds.map((id) => {
      const n = twoSceneNodes.find((x) => x.id === id)!;
      return { ...n, text: n.id === 'd1' ? '改急' : n.text };
    });
    mockedStart.mockResolvedValue({
      ok: true,
      json: async () => ({ content: JSON.stringify({ nodes: replacements }) }),
    } as Response);

    const result = await reviseWithLlm({
      nodes: twoSceneNodes,
      nodeIds: sceneIds,
      instruction: '改急',
      scopeType: 'scene',
      userId: 'u1',
    });

    expect(mockedStart).toHaveBeenCalledWith(
      'reviseworkflow',
      expect.objectContaining({
        instruction: '改急',
        nodes: twoSceneNodes.slice(0, 4),
      }),
      expect.any(Object)
    );
    expect(result.find((n) => n.id === 'd1')?.text).toBe('改急');
  });
});

describe('assertExactContiguousSelection', () => {
  it('accepts a single node', () => {
    expect(() => assertExactContiguousSelection(sampleNodes, ['b'])).not.toThrow();
  });

  it('accepts contiguous multi-node selection', () => {
    expect(() => assertExactContiguousSelection(sampleNodes, ['b', 'c'])).not.toThrow();
  });

  it('rejects holey selection — no silent fill', () => {
    expect(() => assertExactContiguousSelection(sampleNodes, ['a', 'c'])).toThrow(AppException);
    try {
      assertExactContiguousSelection(sampleNodes, ['a', 'c']);
    } catch (err) {
      expect(err).toMatchObject({
        code: ErrorCode.INVALID_INPUT,
        message: expect.stringMatching(/连续|隔空/),
      });
    }
  });

  it('rejects missing node ids', () => {
    expect(() => assertExactContiguousSelection(sampleNodes, ['b', 'missing'])).toThrow(AppException);
    try {
      assertExactContiguousSelection(sampleNodes, ['b', 'missing']);
    } catch (err) {
      expect(err).toMatchObject({
        code: ErrorCode.INVALID_INPUT,
        message: expect.stringMatching(/不存在/),
      });
    }
  });

  it('rejects empty selection', () => {
    expect(() => assertExactContiguousSelection(sampleNodes, [])).toThrow(AppException);
  });
});

describe('selection scope — no silent expand', () => {
  it('slice via placeholderRevise only returns exact contiguous selection', () => {
    const result = placeholderRevise(sampleNodes, ['b', 'c'], '');
    expect(result.map((n) => n.id)).toEqual(['b', 'c']);
    expect(result.map((n) => n.id)).not.toContain('a');
    expect(result.map((n) => n.id)).not.toContain('d');
  });

  it('holey selection rejected by applyNodePatch — no silent expand to fill hole', () => {
    expect(() =>
      applyNodePatch(
        sampleNodes,
        [
          { id: 'a', type: 'action', text: '改a' },
          { id: 'b', type: 'dialogue', text: '填洞' },
          { id: 'c', type: 'action', text: '改c' },
        ],
        ['a', 'c']
      )
    ).toThrow(AppException);
  });

  it('selection accept only patches selection — does not touch scene B / out-of-span', () => {
    const next = applyNodePatch(
      twoSceneNodes,
      [{ id: 'd1', type: 'dialogue', text: '改短' }],
      ['d1']
    );
    expect(next.find((n) => n.id === 'd1')?.text).toBe('改短');
    // Scene A other nodes unchanged
    expect(next.find((n) => n.id === 'a1')).toEqual(twoSceneNodes.find((n) => n.id === 'a1'));
    expect(next.find((n) => n.id === 'c1')).toEqual(twoSceneNodes.find((n) => n.id === 'c1'));
    // Scene B identical
    expect(next.find((n) => n.id === 's2')).toEqual(twoSceneNodes.find((n) => n.id === 's2'));
    expect(next.find((n) => n.id === 'a2')).toEqual(twoSceneNodes.find((n) => n.id === 'a2'));
    expect(next.find((n) => n.id === 'd2')).toEqual(twoSceneNodes.find((n) => n.id === 'd2'));
  });

  it('out-of-range replacements still rejected on selection path', () => {
    expect(() =>
      applyNodePatch(
        twoSceneNodes,
        [
          { id: 'd1', type: 'dialogue', text: '改' },
          { id: 'd2', type: 'dialogue', text: '越界到 B' },
        ],
        ['d1']
      )
    ).toThrow(AppException);
  });
});
