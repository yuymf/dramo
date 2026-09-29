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
