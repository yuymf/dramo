/**
 * Intent Service — detects user generation intent and builds fallback
 * clarificationComplete objects from conversation history.
 * Pure logic: no DB access, no external dependencies.
 */

const GENERATION_TRIGGER_PATTERNS = [
  /^(开始|就这样|生成|直接生成|直接|好了|行了|够了|走起)$/,
  /(开始生成|生成台本|生成完整|直接生成|开始吧|直接开始|可以开始|不用问|别问了)/,
  /(帮我写|帮我生成|直接写|赶紧写|快写|马上生成)/,
  /(可以了|差不多了|就这样吧|就按这个|按这个来)/,
];

export class IntentService {
  /**
   * Detect if user message expresses intent to start generation.
   * Server-side fallback when the LLM fails to set clarificationComplete.
   */
  isGenerationTrigger(userContent: string): boolean {
    const text = userContent.trim();
    return GENERATION_TRIGGER_PATTERNS.some((pattern) => pattern.test(text));
  }

  /**
   * Build a fallback clarificationComplete from conversation history
   * when the LLM fails to produce one despite the user triggering generation.
   */
  buildFallbackClarificationComplete(
    messages: Array<{ role: string; content: string }>
  ): Record<string, unknown> {
    const userTexts = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');

    let contentType = 'live';
    if (/vlog/i.test(userTexts)) contentType = 'vlog';
    else if (/短剧|短片/.test(userTexts)) contentType = 'short_drama';
    else if (/短视频/.test(userTexts)) contentType = 'short_video';
    else if (/电影/.test(userTexts)) contentType = 'film';
    else if (/直播/.test(userTexts)) contentType = 'live';

    const styleMap: Record<string, string> = {
      '搞笑|幽默|逗|好笑': 'humorous',
      '治愈|温暖|舒服': 'healing',
      '热血|激情|燃': 'passionate',
      '悬疑|烧脑': 'suspense',
      '恐怖|惊悚': 'horror',
      '荒诞|离谱': 'absurd',
      '文艺|文学': 'literary',
      '怀旧|复古': 'retro',
    };
    const styles: string[] = [];
    for (const [pattern, style] of Object.entries(styleMap)) {
      if (new RegExp(pattern).test(userTexts)) {
        styles.push(style);
      }
    }
    if (styles.length === 0) styles.push('humorous');

    return {
      contentType,
      styles,
      goal: 'entertainment',
      keyword: userTexts.slice(0, 20),
      topic: userTexts.slice(0, 50),
      situation: '',
      extraRequirements: '',
    };
  }
}
