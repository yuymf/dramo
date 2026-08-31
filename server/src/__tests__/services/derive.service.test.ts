import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../lib/db', () => ({
  prisma: {},
}));

import { parsePropNames } from '../../services/derive.service';

describe('parsePropNames', () => {
  it('extracts #道具名 and stops at whitespace or punctuation', () => {
    expect(parsePropNames('她摸出 #旧怀表，指针停了。')).toEqual(['旧怀表']);
    expect(parsePropNames('把 #旧怀表 交给值班员')).toEqual(['旧怀表']);
    expect(parsePropNames('#枪。#证件，#雨伞!')).toEqual(['枪', '证件', '雨伞']);
  });

  it('dedupes and ignores empty hashes', () => {
    expect(parsePropNames('#旧怀表 又是 #旧怀表')).toEqual(['旧怀表']);
    expect(parsePropNames('# 空的 ##')).toEqual([]);
  });
});
