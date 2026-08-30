import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../lib/db', () => ({
  prisma: {},
}));

jest.mock('../../lib/agentos-client', () => ({
  startWorkflowRun: jest.fn(),
}));

jest.mock('../../services/llm-config.service', () => ({
  LLMConfigService: jest.fn().mockImplementation(() => ({
    getLLMHeaders: jest.fn(),
  })),
}));

jest.mock('../../services/derive.service', () => ({
  deriveFromNodes: jest.fn(),
}));

import { startWorkflowRun } from '../../lib/agentos-client';
import { parseRevisePayload, reviseWithLlm } from '../../services/screenplay.service';

const mockedStart = startWorkflowRun as jest.MockedFunction<typeof startWorkflowRun>;

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

describe('reviseWithLlm', () => {
  it('calls reviseworkflow with scoped nodes and format', async () => {
    const nodes = [
      { id: 'a', type: 'action' as const, text: '一' },
      { id: 'b', type: 'dialogue' as const, text: '二' },
      { id: 'c', type: 'action' as const, text: '三' },
    ];
    const replacements = [{ id: 'b', type: 'dialogue' as const, text: '改' }];
    mockedStart.mockResolvedValue({
      ok: true,
      json: async () => ({ content: JSON.stringify({ nodes: replacements }) }),
    } as Response);

    const result = await reviseWithLlm({
      nodes,
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
        nodes: [nodes[1]],
      }),
      expect.objectContaining({ timeoutMs: 90_000 })
    );
    expect(result).toEqual(replacements);
  });
});
