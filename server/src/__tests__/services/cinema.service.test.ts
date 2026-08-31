import { describe, expect, it } from '@jest/globals';
import {
  deriveReelStage,
  hasPerformance,
  normalizeCinemaSettings,
  parsePerformance,
  placeholderStoryboardShots,
} from '../../types/cinema';

describe('parsePerformance', () => {
  it('reads @角色 #道具 and quoted dialogue', () => {
    const parsed = parsePerformance('@林晚 拿出 #旧怀表 说「末班车要到了。」');
    expect(parsed.characters).toEqual(['林晚']);
    expect(parsed.props).toEqual(['旧怀表']);
    expect(parsed.quotes).toEqual(['末班车要到了。']);
  });

  it('treats latin quotes as dialogue', () => {
    expect(parsePerformance('@值班员 "Last train."').quotes).toEqual(['Last train.']);
  });

  it('hasPerformance requires a character or a quote', () => {
    expect(hasPerformance('')).toBe(false);
    expect(hasPerformance('#旧怀表')).toBe(false);
    expect(hasPerformance('@林晚')).toBe(true);
    expect(hasPerformance('「开门」')).toBe(true);
  });
});

describe('deriveReelStage', () => {
  it('walks the five stages from data', () => {
    const empty = { performance: '', shots: [], images: [], films: [] };
    expect(deriveReelStage(empty)).toBe('scene');
    expect(deriveReelStage({ ...empty, performance: '@林晚 「走」' })).toBe('performance');
    expect(
      deriveReelStage({
        ...empty,
        performance: '@林晚 「走」',
        shots: [{ id: 's1', description: '走', camera: '近景' }],
      })
    ).toBe('text_storyboard');
    expect(
      deriveReelStage({
        ...empty,
        shots: [{ id: 's1', description: '走', camera: '近景' }],
        images: [{ shotId: 's1', url: '/x.png' }],
      })
    ).toBe('storyboard_images');
    expect(
      deriveReelStage({
        ...empty,
        images: [{ shotId: 's1', url: '/x.png' }],
        films: [{ id: 'f1', url: '/x.mp4', durationSec: 15, createdAt: '2026-01-01T00:00:00.000Z' }],
      })
    ).toBe('film');
  });
});

describe('placeholderStoryboardShots', () => {
  it('makes an establishing shot plus one per quote', () => {
    const shots = placeholderStoryboardShots('INT. 地铁 - NIGHT', '@林晚 「末班车要到了。」');
    expect(shots[0]?.camera).toBe('全景');
    expect(shots.some((shot) => shot.description.includes('末班车'))).toBe(true);
    expect(shots.length).toBeGreaterThanOrEqual(2);
  });
});

describe('normalizeCinemaSettings', () => {
  it('fills defaults and keeps legal aspect', () => {
    expect(normalizeCinemaSettings(null).aspectRatio).toBe('16:9');
    expect(normalizeCinemaSettings({ aspectRatio: '9:16', productionKind: '广告' })).toMatchObject({
      aspectRatio: '9:16',
      productionKind: '广告',
    });
    expect(normalizeCinemaSettings({ aspectRatio: '21:9' }).aspectRatio).toBe('16:9');
  });
});
