import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../lib/db', () => ({
  prisma: {},
}));

jest.mock('../../services/screenplay.service', () => ({
  ScreenplayService: jest.fn().mockImplementation(() => ({})),
}));

import { corpusFromNodes, isBeatCovered } from '../../services/planning.service';

describe('isBeatCovered', () => {
  it('covers when any trimmed field of length >= 2 appears in the corpus', () => {
    const beat = { action: '交出旧怀表', intent: '求他放行', outcome: '门开了' };
    expect(isBeatCovered(beat, '林晚交出旧怀表。')).toBe(true);
    expect(isBeatCovered(beat, '他只是求他放行。')).toBe(true);
    expect(isBeatCovered(beat, '最后门开了')).toBe(true);
  });

  it('does not cover short or missing fragments', () => {
    const beat = { action: '交', intent: 'x', outcome: '' };
    expect(isBeatCovered(beat, '交')).toBe(false);
    expect(isBeatCovered({ action: '交出旧怀表', intent: '', outcome: '' }, '没有这段')).toBe(false);
  });
});

describe('corpusFromNodes', () => {
  it('joins node texts', () => {
    expect(
      corpusFromNodes([
        { id: 'a', type: 'action', text: '她摸出旧怀表' },
        { id: 'b', type: 'dialogue', text: '末班车要到了。' },
      ])
    ).toBe('她摸出旧怀表\n末班车要到了。');
  });
});
