export const OUTLINE_SCOPE_EVENT = "dramo-outline-scope";
export const OUTLINE_SCOPE_REQUEST_EVENT = "dramo-outline-scope-request";
export const OUTLINE_REVISED_EVENT = "dramo-outline-revised";
export const OUTLINE_FLUSH_EVENT = "dramo-outline-flush";

export const BEAT_SCOPE_EVENT = "dramo-beat-scope";
export const BEAT_SCOPE_REQUEST_EVENT = "dramo-beat-scope-request";
export const BEAT_REVISED_EVENT = "dramo-beat-revised";
export const BEAT_FLUSH_EVENT = "dramo-beat-flush";

export interface OutlineScopeDetail {
  index: number;
}

export interface BeatScopeDetail {
  beatId: string | null;
}

export interface OutlineRevisedDetail {
  markdown: string;
}

export interface BeatRevisedDetail {
  beats: Array<{
    id?: string;
    action: string;
    intent: string;
    outcome: string;
    sortOrder?: number;
    covered?: boolean;
  }>;
}

export interface FlushDetail {
  done?: () => void;
}

/** Split outline markdown on blank-line runs; keep trailing empties. */
export function splitOutlineParagraphs(markdown: string): string[] {
  if (markdown.length === 0) return [""];
  return markdown.split(/\n\n+/);
}

/** Map caret offset to paragraph index (separator → following paragraph). */
export function paragraphIndexAtOffset(markdown: string, offset: number): number {
  const paragraphs = splitOutlineParagraphs(markdown);
  if (paragraphs.length <= 1) return 0;
  const clamped = Math.max(0, Math.min(offset, markdown.length));
  let cursor = 0;
  for (let i = 0; i < paragraphs.length; i += 1) {
    const paraEnd = cursor + paragraphs[i].length;
    let sepLen = 0;
    if (i < paragraphs.length - 1) {
      const match = markdown.slice(paraEnd).match(/^\n\n+/);
      sepLen = match ? match[0].length : 0;
    }
    const regionEnd = paraEnd + sepLen;
    if (clamped < paraEnd) return i;
    if (clamped >= paraEnd && clamped < regionEnd) {
      return Math.min(i + 1, paragraphs.length - 1);
    }
    if (clamped === paraEnd && sepLen === 0) return i;
    if (i === paragraphs.length - 1) return i;
    cursor = regionEnd;
  }
  return paragraphs.length - 1;
}

export function dispatchOutlineScope(index: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OutlineScopeDetail>(OUTLINE_SCOPE_EVENT, { detail: { index } })
  );
}

export function requestOutlineScope(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OUTLINE_SCOPE_REQUEST_EVENT));
}

export function dispatchOutlineRevised(markdown: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OutlineRevisedDetail>(OUTLINE_REVISED_EVENT, { detail: { markdown } })
  );
}

export function requestOutlineFlush(timeoutMs = 4000): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    window.dispatchEvent(
      new CustomEvent<FlushDetail>(OUTLINE_FLUSH_EVENT, { detail: { done } })
    );
    window.setTimeout(done, timeoutMs);
  });
}

export function dispatchBeatScope(beatId: string | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<BeatScopeDetail>(BEAT_SCOPE_EVENT, { detail: { beatId } })
  );
}

export function requestBeatScope(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BEAT_SCOPE_REQUEST_EVENT));
}

export function dispatchBeatRevised(beats: BeatRevisedDetail["beats"]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<BeatRevisedDetail>(BEAT_REVISED_EVENT, { detail: { beats } })
  );
}

export function requestBeatFlush(timeoutMs = 4000): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    window.dispatchEvent(
      new CustomEvent<FlushDetail>(BEAT_FLUSH_EVENT, { detail: { done } })
    );
    window.setTimeout(done, timeoutMs);
  });
}
