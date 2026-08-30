import type { ScreenplayDoc } from "@/lib/types/screenplay";

export const SCREENPLAY_SCOPE_EVENT = "screenplay-scope";
export const SCREENPLAY_REVISED_EVENT = "screenplay-revised";
export const SCREENPLAY_FLUSH_EVENT = "screenplay-flush";

export type ScreenplayScopeType = "selection" | "scene";

export interface ScreenplayScopeDetail {
  type: ScreenplayScopeType;
  nodeIds: string[];
}

export interface ScreenplayFlushDetail {
  done?: () => void;
}

export function dispatchScreenplayScope(
  nodeIds: string[],
  type: ScreenplayScopeType = "selection"
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ScreenplayScopeDetail>(SCREENPLAY_SCOPE_EVENT, {
      detail: { type, nodeIds },
    })
  );
}

export function dispatchScreenplayRevised(doc: ScreenplayDoc): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ScreenplayDoc>(SCREENPLAY_REVISED_EVENT, {
      detail: doc,
    })
  );
}

export function requestScreenplayFlush(timeoutMs = 4000): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    window.dispatchEvent(
      new CustomEvent<ScreenplayFlushDetail>(SCREENPLAY_FLUSH_EVENT, {
        detail: { done },
      })
    );
    window.setTimeout(done, timeoutMs);
  });
}
