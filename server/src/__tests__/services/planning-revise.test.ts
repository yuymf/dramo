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
  applyBeatFieldPatch,
  applyOutlineParagraphPatch,
  paragraphIndexAtOffset,
  reviseBeatFieldsWithLlm,
  reviseOutlineParagraphWithLlm,
  splitOutlineParagraphs,
  wrapBeatFieldsAsNodes,
  wrapOutlineParagraphAsNodes,
} from '../../services/planning-revise.js';

const mockedStart = startWorkflowRun as jest.MockedFunction<typeof startWorkflowRun>;
const mocked = (fn: unknown) => fn as any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('splitOutlineParagraphs / applyOutlineParagraphPatch', () => {
  it('splits on blank-line runs and keeps trailing empty', () => {
    expect(splitOutlineParagraphs('一段\n\n二段\n\n')).toEqual(['一段', '二段', '']);
    expect(splitOutlineParagraphs('')).toEqual(['']);
    expect(splitOutlineParagraphs('单段')).toEqual(['单段']);
    expect(splitOutlineParagraphs('a\n\n\n\nb')).toEqual(['a', 'b']);
  });

  it('patches only the targeted paragraph; others stay identical', () => {
    const markdown = '前提\n\n转折\n\n结局';
    const next = applyOutlineParagraphPatch(markdown, 1, '新转折');
    expect(next).toBe('前提\n\n新转折\n\n结局');
    const paras = splitOutlineParagraphs(next);
    expect(paras[0]).toBe('前提');
    expect(paras[2]).toBe('结局');
  });

  it('rejects out-of-range index', () => {
    expect(() => applyOutlineParagraphPatch('只有一段', 2, 'x')).toThrow(AppException);
  });

  it('maps caret offset to paragraph index', () => {
    const md = 'AAA\n\nBBB\n\nCCC';
    expect(paragraphIndexAtOffset(md, 0)).toBe(0);
    expect(paragraphIndexAtOffset(md, 2)).toBe(0);
    expect(paragraphIndexAtOffset(md, 5)).toBe(1); // inside separator → next
    expect(paragraphIndexAtOffset(md, 7)).toBe(1);
    expect(paragraphIndexAtOffset(md, md.length)).toBe(2);
  });
});

describe('applyBeatFieldPatch isolation', () => {
  const beats = [
    { id: 'b1', action: 'A1', intent: 'I1', outcome: 'O1', sortOrder: 0 },
    { id: 'b2', action: 'A2', intent: 'I2', outcome: 'O2', sortOrder: 1 },
    { id: 'b3', action: 'A3', intent: 'I3', outcome: 'O3', sortOrder: 2 },
  ];

  it('mutates only the targeted beat; other beats stay referentially identical', () => {
    const next = applyBeatFieldPatch(beats, 'b2', {
      action: '新动作',
      intent: '新意图',
      outcome: '新结果',
    });
    expect(next[0]).toBe(beats[0]);
    expect(next[2]).toBe(beats[2]);
    expect(next[1]).toEqual({
      id: 'b2',
      action: '新动作',
      intent: '新意图',
      outcome: '新结果',
      sortOrder: 1,
    });
  });

  it('rejects missing beat id with Chinese', () => {
    expect(() => applyBeatFieldPatch(beats, '', { action: '', intent: '', outcome: '' })).toThrow(
      expect.objectContaining({ message: '请先保存该 Beat' })
    );
  });

  it('rejects unknown beat id', () => {
    expect(() =>
      applyBeatFieldPatch(beats, 'missing', { action: 'x', intent: 'y', outcome: 'z' })
    ).toThrow(AppException);
  });
});

describe('wrap helpers for reviseworkflow', () => {
  it('wraps outline paragraph as one action node p{index}', () => {
    expect(wrapOutlineParagraphAsNodes(2, '段落')).toEqual([
      { id: 'p2', type: 'action', text: '段落' },
    ]);
  });

  it('wraps beat fields as three action nodes', () => {
    expect(
      wrapBeatFieldsAsNodes('beat99', { action: 'a', intent: 'i', outcome: 'o' })
    ).toEqual([
      { id: 'beat99:action', type: 'action', text: 'a' },
      { id: 'beat99:intent', type: 'action', text: 'i' },
      { id: 'beat99:outcome', type: 'action', text: 'o' },
    ]);
  });
});

describe('reviseOutlineParagraphWithLlm / reviseBeatFieldsWithLlm no-LLM Chinese', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked(mockGetLLMHeaders).mockReset();
    mocked(mockGetLLMHeaders).mockResolvedValue({
      'X-LLM-Api-Key': 'k',
      'X-LLM-Base-Url': 'https://example.com/v1',
      'X-LLM-Model-Id': 'deepseek-v4.1-flash',
    });
  });

  it('outline: missing LLM config throws Chinese and does not call AgentOS', async () => {
    mocked(mockGetLLMHeaders).mockRejectedValue(
      new AppException(ErrorCode.LLM_NOT_CONFIGURED, 'No default TEXT_LLM configuration found')
    );
    await expect(
      reviseOutlineParagraphWithLlm({
        paragraph: '旧段落',
        index: 0,
        instruction: '改短一点',
        userId: 'u1',
      })
    ).rejects.toMatchObject({
      code: ErrorCode.LLM_NOT_CONFIGURED,
      message: '未配置默认文本模型，请先在设置中配置 LLM',
    });
    expect(mockedStart).not.toHaveBeenCalled();
  });

  it('outline: AgentOS unavailable throws Chinese — never placeholder success', async () => {
    mockedStart.mockRejectedValue(new Error('AGENTOS_503: down'));
    await expect(
      reviseOutlineParagraphWithLlm({
        paragraph: '旧段落',
        index: 1,
        instruction: '改一下',
        userId: 'u1',
      })
    ).rejects.toMatchObject({
      code: ErrorCode.UPSTREAM_ERROR,
      message: 'AI 修订服务暂不可用，请稍后重试',
    });
  });

  it('outline success path calls reviseworkflow with p{index} action node', async () => {
    mockedStart.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: JSON.stringify({ nodes: [{ id: 'p1', type: 'action', text: '新段落' }] }),
      }),
    } as Response);
    const revised = await reviseOutlineParagraphWithLlm({
      paragraph: '旧',
      index: 1,
      instruction: '改',
      userId: 'u1',
    });
    expect(revised).toBe('新段落');
    expect(mockedStart).toHaveBeenCalledWith(
      'reviseworkflow',
      expect.objectContaining({
        nodes: [{ id: 'p1', type: 'action', text: '旧' }],
      }),
      expect.anything()
    );
  });

  it('beat: missing LLM config throws Chinese and does not call AgentOS', async () => {
    mocked(mockGetLLMHeaders).mockRejectedValue(
      new AppException(ErrorCode.LLM_NOT_CONFIGURED, 'No default TEXT_LLM configuration found')
    );
    await expect(
      reviseBeatFieldsWithLlm({
        beatId: 'b1',
        fields: { action: 'a', intent: 'i', outcome: 'o' },
        instruction: '更紧',
        userId: 'u1',
      })
    ).rejects.toMatchObject({
      code: ErrorCode.LLM_NOT_CONFIGURED,
      message: '未配置默认文本模型，请先在设置中配置 LLM',
    });
    expect(mockedStart).not.toHaveBeenCalled();
  });

  it('beat success path calls reviseworkflow with three field nodes', async () => {
    mockedStart.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: JSON.stringify({
          nodes: [
            { id: 'b1:action', type: 'action', text: 'NA' },
            { id: 'b1:intent', type: 'action', text: 'NI' },
            { id: 'b1:outcome', type: 'action', text: 'NO' },
          ],
        }),
      }),
    } as Response);
    const revised = await reviseBeatFieldsWithLlm({
      beatId: 'b1',
      fields: { action: 'a', intent: 'i', outcome: 'o' },
      instruction: '改',
      userId: 'u1',
    });
    expect(revised).toEqual({ action: 'NA', intent: 'NI', outcome: 'NO' });
    expect(mockedStart).toHaveBeenCalledWith(
      'reviseworkflow',
      expect.objectContaining({
        nodes: wrapBeatFieldsAsNodes('b1', { action: 'a', intent: 'i', outcome: 'o' }),
      }),
      expect.anything()
    );
  });
});
