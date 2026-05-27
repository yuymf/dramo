import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntentService } from '../../services/intent.service';

describe('IntentService', () => {
  let service: IntentService;

  beforeEach(() => {
    service = new IntentService();
  });

  describe('isGenerationTrigger', () => {
    it('should return true for exact trigger words', () => {
      expect(service.isGenerationTrigger('开始')).toBe(true);
      expect(service.isGenerationTrigger('就这样')).toBe(true);
      expect(service.isGenerationTrigger('生成')).toBe(true);
      expect(service.isGenerationTrigger('直接生成')).toBe(true);
      expect(service.isGenerationTrigger('直接')).toBe(true);
      expect(service.isGenerationTrigger('好了')).toBe(true);
      expect(service.isGenerationTrigger('行了')).toBe(true);
      expect(service.isGenerationTrigger('够了')).toBe(true);
      expect(service.isGenerationTrigger('走起')).toBe(true);
    });

    it('should return true for phrases containing trigger patterns', () => {
      expect(service.isGenerationTrigger('开始生成台本')).toBe(true);
      expect(service.isGenerationTrigger('帮我写一个台本')).toBe(true);
      expect(service.isGenerationTrigger('可以了，直接生成吧')).toBe(true);
      expect(service.isGenerationTrigger('差不多了，开始吧')).toBe(true);
      expect(service.isGenerationTrigger('不用问了，直接开始')).toBe(true);
      expect(service.isGenerationTrigger('别问了，快写')).toBe(true);
    });

    it('should return true for "可以了" pattern', () => {
      expect(service.isGenerationTrigger('可以了')).toBe(true);
      expect(service.isGenerationTrigger('就按这个来')).toBe(true);
      expect(service.isGenerationTrigger('就这样吧')).toBe(true);
    });

    it('should return false for non-trigger messages', () => {
      expect(service.isGenerationTrigger('你好，我想聊聊')).toBe(false);
      expect(service.isGenerationTrigger('主角叫小明')).toBe(false);
      expect(service.isGenerationTrigger('场景在北京')).toBe(false);
      expect(service.isGenerationTrigger('添加更多角色')).toBe(false);
    });

    it('should handle whitespace trimming', () => {
      expect(service.isGenerationTrigger('  开始  ')).toBe(true);
      expect(service.isGenerationTrigger('\t生成\n')).toBe(true);
    });

    it('should handle empty string', () => {
      expect(service.isGenerationTrigger('')).toBe(false);
    });
  });

  describe('buildFallbackClarificationComplete', () => {
    it('should detect live content type by default', () => {
      const result = service.buildFallbackClarificationComplete([
        { role: 'user', content: '帮我生成一个台本' },
      ]);
      expect(result.contentType).toBe('live');
    });

    it('should detect vlog content type', () => {
      const result = service.buildFallbackClarificationComplete([
        { role: 'user', content: '我想做一个vlog' },
      ]);
      expect(result.contentType).toBe('vlog');
    });

    it('should detect short_drama content type', () => {
      const result = service.buildFallbackClarificationComplete([
        { role: 'user', content: '来一个短剧' },
      ]);
      expect(result.contentType).toBe('short_drama');
    });

    it('should detect short_video content type', () => {
      const result = service.buildFallbackClarificationComplete([
        { role: 'user', content: '做一个短视频' },
      ]);
      expect(result.contentType).toBe('short_video');
    });

    it('should detect film content type', () => {
      const result = service.buildFallbackClarificationComplete([
        { role: 'user', content: '拍一部电影' },
      ]);
      expect(result.contentType).toBe('film');
    });

    it('should detect humorous style', () => {
      const result = service.buildFallbackClarificationComplete([
        { role: 'user', content: '来一个搞笑的' },
      ]);
      expect((result.styles as string[]).includes('humorous')).toBe(true);
    });

    it('should detect healing style', () => {
      const result = service.buildFallbackClarificationComplete([
        { role: 'user', content: '治愈系风格' },
      ]);
      expect((result.styles as string[]).includes('healing')).toBe(true);
    });

    it('should default to humorous style when no style detected', () => {
      const result = service.buildFallbackClarificationComplete([
        { role: 'user', content: '生成台本' },
      ]);
      expect((result.styles as string[]).includes('humorous')).toBe(true);
    });

    it('should only include user messages in keyword/topic extraction', () => {
      const messages = [
        { role: 'assistant', content: '请告诉我主题' },
        { role: 'user', content: '搞笑宠物视频' },
        { role: 'assistant', content: '好的，还有其他要求吗？' },
        { role: 'user', content: '要有猫咪' },
      ];
      const result = service.buildFallbackClarificationComplete(messages);
      expect(result.keyword).toBeTruthy();
      expect(typeof result.topic).toBe('string');
    });

    it('should return all required fields', () => {
      const result = service.buildFallbackClarificationComplete([
        { role: 'user', content: '做个台本' },
      ]);
      expect(result).toHaveProperty('contentType');
      expect(result).toHaveProperty('styles');
      expect(result).toHaveProperty('goal');
      expect(result).toHaveProperty('keyword');
      expect(result).toHaveProperty('topic');
      expect(result).toHaveProperty('situation');
      expect(result).toHaveProperty('extraRequirements');
      expect(result.goal).toBe('entertainment');
    });

    it('should truncate keyword to 20 chars and topic to 50 chars', () => {
      const longText = 'a'.repeat(100);
      const result = service.buildFallbackClarificationComplete([
        { role: 'user', content: longText },
      ]);
      expect((result.keyword as string).length).toBeLessThanOrEqual(20);
      expect((result.topic as string).length).toBeLessThanOrEqual(50);
    });

    it('should handle empty messages array', () => {
      const result = service.buildFallbackClarificationComplete([]);
      expect(result.contentType).toBe('live');
      expect(Array.isArray(result.styles)).toBe(true);
    });
  });
});
