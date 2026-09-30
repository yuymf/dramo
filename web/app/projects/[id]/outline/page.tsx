"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { firstEpisodeId, getOutline, putOutline } from "@/lib/api/planning";
import { useToast } from "@/components/ui/Toast";
import {
  OUTLINE_FLUSH_EVENT,
  OUTLINE_REVISED_EVENT,
  OUTLINE_SCOPE_REQUEST_EVENT,
  dispatchOutlineScope,
  paragraphIndexAtOffset,
  type FlushDetail,
  type OutlineRevisedDetail,
} from "@/components/planning/scope";

export default function OutlinePage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { showToast } = useToast();
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markdownRef = useRef(markdown);
  const dirtyRef = useRef(dirty);
  const episodeIdRef = useRef(episodeId);
  const savingRef = useRef(saving);

  useEffect(() => {
    markdownRef.current = markdown;
  }, [markdown]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    episodeIdRef.current = episodeId;
  }, [episodeId]);
  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const eid = await firstEpisodeId(projectId);
        const doc = await getOutline(projectId, eid);
        if (cancelled) return;
        setEpisodeId(eid);
        setMarkdown(doc.markdown);
        setDirty(false);
      } catch (err) {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : "加载大纲失败", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, showToast]);

  const persist = useCallback(async () => {
    if (!episodeId || saving || !dirty) return;
    setSaving(true);
    try {
      const saved = await putOutline(projectId, episodeId, markdown);
      setMarkdown(saved.markdown);
      setDirty(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存大纲失败", "error");
    } finally {
      setSaving(false);
    }
  }, [dirty, episodeId, markdown, projectId, saving, showToast]);

  const publishScope = useCallback(() => {
    const el = textareaRef.current;
    const value = el?.value ?? markdownRef.current;
    const offset = el?.selectionStart ?? 0;
    dispatchOutlineScope(paragraphIndexAtOffset(value, offset));
  }, []);

  useEffect(() => {
    const onRequest = () => publishScope();
    const onRevised = (event: Event) => {
      const detail = (event as CustomEvent<OutlineRevisedDetail>).detail;
      if (!detail || typeof detail.markdown !== "string") return;
      setMarkdown(detail.markdown);
      setDirty(false);
    };
    const onFlush = (event: Event) => {
      const detail = (event as CustomEvent<FlushDetail>).detail;
      const done = detail?.done;
      void (async () => {
        try {
          const eid = episodeIdRef.current;
          if (eid && dirtyRef.current && !savingRef.current) {
            setSaving(true);
            try {
              const saved = await putOutline(projectId, eid, markdownRef.current);
              setMarkdown(saved.markdown);
              setDirty(false);
            } finally {
              setSaving(false);
            }
          }
        } catch (err) {
          showToast(err instanceof Error ? err.message : "保存大纲失败", "error");
        } finally {
          done?.();
        }
      })();
    };
    window.addEventListener(OUTLINE_SCOPE_REQUEST_EVENT, onRequest);
    window.addEventListener(OUTLINE_REVISED_EVENT, onRevised);
    window.addEventListener(OUTLINE_FLUSH_EVENT, onFlush);
    return () => {
      window.removeEventListener(OUTLINE_SCOPE_REQUEST_EVENT, onRequest);
      window.removeEventListener(OUTLINE_REVISED_EVENT, onRevised);
      window.removeEventListener(OUTLINE_FLUSH_EVENT, onFlush);
    };
  }, [projectId, publishScope, showToast]);

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="m-0 text-base font-semibold tracking-wide">大纲</h1>
          <span className="text-xs text-[var(--at-text-tertiary)]">按集保存的 Markdown</span>
        </div>
        <span className="text-[11px] text-[var(--at-text-tertiary)]">
          {saving ? "保存中…" : dirty ? "离开输入框后保存" : "已保存"}
        </span>
      </header>
      <div className="flex-1 min-h-0 px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-[var(--at-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            aria-label="大纲正文"
            value={markdown}
            onChange={(e) => {
              setMarkdown(e.target.value);
              setDirty(true);
            }}
            onBlur={() => void persist()}
            onFocus={publishScope}
            onClick={publishScope}
            onKeyUp={publishScope}
            onSelect={publishScope}
            placeholder="写下本集前提、因果和结局承诺…"
            className="w-full h-full min-h-[320px] resize-none rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] px-4 py-3 text-sm leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--at-accent)]"
          />
        )}
      </div>
    </div>
  );
}
