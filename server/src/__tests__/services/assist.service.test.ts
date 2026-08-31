import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../lib/db', () => ({
  prisma: {},
}));

jest.mock('../../services/screenplay.service', () => ({
  ScreenplayService: jest.fn().mockImplementation(() => ({})),
}));

import { normalizeColdStart, suggestMicroContinue } from '../../services/assist.service';

describe('suggestMicroContinue', () => {
  it('returns 50–100 characters based on previous text', () => {
    const suggestion = suggestMicroContinue(
      [
        { id: 'a', text: '林晚把旧怀表按在掌心。' },
        { id: 'b', text: '' },
      ],
      'b'
    );
    expect(suggestion.length).toBeGreaterThanOrEqual(50);
    expect(suggestion.length).toBeLessThanOrEqual(100);
    expect(suggestion).toContain('旧怀表');
  });
});

describe('normalizeColdStart', () => {
  it('defaults to gate 1 and empty answers', () => {
    const doc = normalizeColdStart({});
    expect(doc.gate).toBe(1);
    expect(doc.premise.character).toBe('');
  });

  it('clamps gate and keeps written fields', () => {
    const doc = normalizeColdStart({
      gate: 3,
      premise: { character: '林晚', desire: '离开' },
    });
    expect(doc.gate).toBe(3);
    expect(doc.premise.character).toBe('林晚');
    expect(doc.premise.desire).toBe('离开');
  });
});
