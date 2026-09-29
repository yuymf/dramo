"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Loader2, Minus, Send } from "lucide-react";
import { api } from "@/lib/api/client";
import { assistReel } from "@/lib/api/cinema";
import { firstEpisodeId } from "@/lib/api/planning";
import type { CinemaAssistTarget } from "@/lib/types/cinema";
import type { ScreenplayDoc } from "@/lib/types/screenplay";
import {
  SCREENPLAY_SCOPE_EVENT,
  dispatchScreenplayRevised,
  requestScreenplayScope,
  requestScreenplayFlush,
  type ScreenplayScopeDetail,
  type ScreenplayScopeType,
} from "@/components/screenplay/scope";

export interface FloatingAISendPayload {
  projectId: string;
  text: string;
  scopeNodeIds: string[];
}

export interface FloatingAIProps {
  projectId: string;
  scopeNodeIds: string[];
  onSend?: (payload: FloatingAISendPayload) => void;
  mode?: "script" | "cinema";
}

const MIN_W = 280;
const MIN_H = 220;
const DEFAULT_W = 360;
const DEFAULT_H = 400;
const INSET = 8;
const RESTORE_W = 56;
const RESTORE_H = 40;

type Frame = { x: number; y: number; w: number; h: number };
type Bounds = { left: number; top: number; right: number; bottom: number };
type ResizeAxis = "e" | "s" | "se";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function fitFrame(frame: Frame, bounds: Bounds): Frame {
  const availableW = Math.max(1, bounds.right - bounds.left - INSET * 2);
  const availableH = Math.max(1, bounds.bottom - bounds.top - INSET * 2);
  const w = clamp(frame.w, Math.min(MIN_W, availableW), availableW);
  const h = clamp(frame.h, Math.min(MIN_H, availableH), availableH);
  return {
    w,
    h,
    x: clamp(frame.x, bounds.left + INSET, bounds.right - w - INSET),
    y: clamp(frame.y, bounds.top + INSET, bounds.bottom - h - INSET),
  };
}

interface ChatLine {
  role: "user" | "assistant";
  text: string;
}

interface ProjectDetail {
  id: string;
  episodes?: Array<{ id: string; sortOrder?: number }>;
}

function unwrap<T extends object>(res: T | { data: T }): T {
  if (res && typeof res === "object" && "data" in res) {
    const inner = (res as { data: T }).data;
    if (inner && typeof inner === "object") return inner;
  }
  return res as T;
}

function pickEpisodeId(project: ProjectDetail): string | null {
  const episodes = [...(project.episodes ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  return episodes[0]?.id ?? null;
}

export function FloatingAI({ projectId, scopeNodeIds, onSend, mode = "script" }: FloatingAIProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [cinemaTarget, setCinemaTarget] = useState<CinemaAssistTarget>("performance");
  const [cinemaReelId, setCinemaReelId] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [scope, setScope] = useState<ScreenplayScopeDetail>({
    type: "selection",
    nodeIds: scopeNodeIds,
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<{ element: HTMLTextAreaElement; start: number; end: number } | null>(null);
  const episodeIdRef = useRef<string | null>(null);
  const linesEndRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: Frame;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: Frame;
    axis: ResizeAxis;
  } | null>(null);

  const getBounds = useCallback((): Bounds => {
    const parent = panelRef.current?.parentElement;
    if (!parent) return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const rect = parent.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = Math.max(0, (viewport?.offsetLeft ?? 0) - rect.left);
    const top = Math.max(0, (viewport?.offsetTop ?? 0) - rect.top);
    return {
      left,
      top,
      right: Math.max(left + 1, Math.min(parent.clientWidth, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - rect.left)),
      bottom: Math.max(top + 1, Math.min(parent.clientHeight, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - rect.top)),
    };
  }, []);

  const currentFrame = useCallback((): Frame => {
    if (frame) return frame;
    const bounds = getBounds();
    return fitFrame({
      x: bounds.right - DEFAULT_W - 16,
      y: bounds.bottom - DEFAULT_H - 16,
      w: DEFAULT_W,
      h: DEFAULT_H,
    }, bounds);
  }, [frame, getBounds]);

  useEffect(() => {
    const parent = panelRef.current?.parentElement;
    if (!parent) return;
    const settle = () => setFrame((previous) => fitFrame(previous ?? {
      x: parent.clientWidth - DEFAULT_W - 16,
      y: parent.clientHeight - DEFAULT_H - 16,
      w: DEFAULT_W,
      h: DEFAULT_H,
    }, getBounds()));
    settle();
    const observer = new ResizeObserver(settle);
    observer.observe(parent);
    window.addEventListener("resize", settle);
    window.visualViewport?.addEventListener("resize", settle);
    window.visualViewport?.addEventListener("scroll", settle);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", settle);
      window.visualViewport?.removeEventListener("resize", settle);
      window.visualViewport?.removeEventListener("scroll", settle);
    };
  }, [getBounds]);

  useEffect(() => {
    const remember = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement && target.matches(".sp-node-input")) {
        editorRef.current = { element: target, start: target.selectionStart, end: target.selectionEnd };
      }
    };
    const selection = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement && target === editorRef.current?.element) {
        editorRef.current = { element: target, start: target.selectionStart, end: target.selectionEnd };
      }
    };
    document.addEventListener("focusin", remember);
    document.addEventListener("select", selection, true);
    document.addEventListener("keyup", selection, true);
    return () => {
      document.removeEventListener("focusin", remember);
      document.removeEventListener("select", selection, true);
      document.removeEventListener("keyup", selection, true);
    };
  }, []);

  useEffect(() => {
    setScope((prev) => ({ ...prev, nodeIds: scopeNodeIds }));
  }, [scopeNodeIds]);

  useEffect(() => {
    const onScope = (event: Event) => {
      const detail = (event as CustomEvent<ScreenplayScopeDetail>).detail;
      if (!detail) return;
      const type: ScreenplayScopeType = detail.type === "scene" ? "scene" : "selection";
      const nodeIds = Array.isArray(detail.nodeIds)
        ? detail.nodeIds.filter((id) => typeof id === "string" && id.trim())
        : [];
      setScope({ type, nodeIds });
    };
    window.addEventListener(SCREENPLAY_SCOPE_EVENT, onScope);
    return () => window.removeEventListener(SCREENPLAY_SCOPE_EVENT, onScope);
  }, []);

  useEffect(() => {
    const onReel = (event: Event) => {
      const detail = (event as CustomEvent<{ reelId?: string; target?: CinemaAssistTarget }>).detail;
      if (detail?.reelId) setCinemaReelId(detail.reelId);
      if (detail?.target) setCinemaTarget(detail.target);
    };
    window.addEventListener("cinema-reel-scope", onReel);
    return () => window.removeEventListener("cinema-reel-scope", onReel);
  }, []);

  useEffect(() => {
    linesEndRef.current?.scrollIntoView({ block: "end" });
  }, [lines, sending]);

  const resolveEpisodeId = useCallback(async () => {
    if (episodeIdRef.current) return episodeIdRef.current;
    const project = unwrap(
      await api<ProjectDetail | { data: ProjectDetail }>(`/api/projects/${projectId}`, {
        noCache: true,
      })
    );
    const episodeId = pickEpisodeId(project);
    if (!episodeId) {
      throw new Error("项目还没有集数");
    }
    episodeIdRef.current = episodeId;
    return episodeId;
  }, [projectId]);

  const rememberEditor = () => {
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement && active.matches(".sp-node-input")) {
      editorRef.current = { element: active, start: active.selectionStart, end: active.selectionEnd };
    }
  };

  const returnToEditor = () => {
    const saved = editorRef.current;
    if (!saved?.element.isConnected) return;
    saved.element.focus();
    saved.element.setSelectionRange(saved.start, saved.end);
  };

  const collapse = () => {
    setCollapsed(true);
    window.requestAnimationFrame(returnToEditor);
  };

  const restore = () => {
    requestScreenplayScope();
    setFrame((previous) => fitFrame(previous ?? currentFrame(), getBounds()));
    setCollapsed(false);
    window.requestAnimationFrame(() => promptRef.current?.focus());
  };

  const onDragStart = (e: ReactPointerEvent) => {
    rememberEditor();
    requestScreenplayScope();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: currentFrame(),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onDragMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setFrame(fitFrame({
      ...drag.origin,
      x: drag.origin.x + e.clientX - drag.startX,
      y: drag.origin.y + e.clientY - drag.startY,
    }, getBounds()));
  };

  const onDragEnd = (e: ReactPointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const onResizeStart = (e: ReactPointerEvent, axis: ResizeAxis) => {
    rememberEditor();
    requestScreenplayScope();
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: currentFrame(),
      axis,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const onResizeMove = (e: ReactPointerEvent) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    const bounds = getBounds();
    const { origin, axis } = resize;
    const maxW = Math.max(1, bounds.right - origin.x - INSET);
    const maxH = Math.max(1, bounds.bottom - origin.y - INSET);
    setFrame({
      ...origin,
      w: axis.includes("e") ? clamp(origin.w + e.clientX - resize.startX, Math.min(MIN_W, maxW), maxW) : origin.w,
      h: axis.includes("s") ? clamp(origin.h + e.clientY - resize.startY, Math.min(MIN_H, maxH), maxH) : origin.h,
    });
  };

  const onResizeEnd = (e: ReactPointerEvent) => {
    if (resizeRef.current?.pointerId === e.pointerId) {
      resizeRef.current = null;
    }
  };

  const onHandleKeyDown = (event: ReactKeyboardEvent) => {
    const delta = event.key === "ArrowLeft" ? [-16, 0] : event.key === "ArrowRight" ? [16, 0]
      : event.key === "ArrowUp" ? [0, -16] : event.key === "ArrowDown" ? [0, 16] : null;
    if (!delta) return;
    event.preventDefault();
    setFrame((previous) => {
      const origin = previous ?? currentFrame();
      return fitFrame({ ...origin, x: origin.x + delta[0], y: origin.y + delta[1] }, getBounds());
    });
  };

  const submit = async () => {
    const next = text.trim();
    if (!next || sending) return;

    if (mode === "cinema") {
      setText("");
      setSending(true);
      setLines((prev) => [...prev, { role: "user", text: next }]);
      try {
        let reelId = cinemaReelId;
        if (!reelId) {
          const episodeId = await firstEpisodeId(projectId);
          const listed = unwrap(
            await api<{ reels: Array<{ id: string }> } | { data: { reels: Array<{ id: string }> } }>(
              `/api/projects/${projectId}/episodes/${episodeId}/reels`,
              { noCache: true }
            )
          );
          reelId = listed.reels[0]?.id ?? null;
        }
        if (!reelId) {
          throw new Error("还没有 Reel");
        }
        const result = await assistReel(projectId, reelId, { target: cinemaTarget, instruction: next });
        window.dispatchEvent(new CustomEvent("cinema-revised", { detail: result.reel }));
        setLines((prev) => [...prev, { role: "assistant", text: result.message }]);
        onSend?.({ projectId, text: next, scopeNodeIds: [] });
      } catch (err) {
        const message = err instanceof Error ? err.message : "修订失败";
        setLines((prev) => [...prev, { role: "assistant", text: message }]);
      } finally {
        setSending(false);
      }
      return;
    }

    if (scope.nodeIds.length === 0) {
      setLines((prev) => [...prev, { role: "assistant", text: "请先在剧本里选中要改的句子" }]);
      return;
    }

    setText("");
    setSending(true);
    setLines((prev) => [...prev, { role: "user", text: next }]);

    try {
      await requestScreenplayFlush();
      const episodeId = await resolveEpisodeId();
      const doc = unwrap(
        await api<ScreenplayDoc | { data: ScreenplayDoc }>(
          `/api/projects/${projectId}/episodes/${episodeId}/screenplay/revise`,
          {
            method: "POST",
            body: {
              instruction: next,
              scope: { type: scope.type, nodeIds: scope.nodeIds },
            },
            noCache: true,
            timeoutMs: 120_000,
          }
        )
      );
      dispatchScreenplayRevised(doc);
      const count = Array.isArray(doc.nodes) ? doc.nodes.length : 0;
      setLines((prev) => [
        ...prev,
        { role: "assistant", text: `已按选区写回编辑器（全文 ${count} 个节点）` },
      ]);
      onSend?.({ projectId, text: next, scopeNodeIds: scope.nodeIds });
    } catch (err) {
      const message = err instanceof Error ? err.message : "修订失败";
      setLines((prev) => [...prev, { role: "assistant", text: message }]);
    } finally {
      setSending(false);
    }
  };

  const positionStyle: CSSProperties = frame
    ? { left: frame.x, top: frame.y }
    : { right: 16, bottom: 16 };
  const restoreStyle: CSSProperties = frame
    ? {
        left: clamp(frame.x, getBounds().left + INSET, getBounds().right - RESTORE_W - INSET),
        top: clamp(frame.y, getBounds().top + INSET, getBounds().bottom - RESTORE_H - INSET),
      }
    : { right: 16, bottom: 16 };

  const scopeLabel =
    mode === "cinema"
      ? `Cinema · ${cinemaTarget === "scene" ? "场景" : cinemaTarget === "shots" ? "镜头" : "表演"}`
      : scope.nodeIds.length > 0
        ? `${scope.type === "scene" ? "本场" : "选区"} ${scope.nodeIds.length} 个节点`
        : "未选中节点";

  return (
    <>
      <button
        type="button"
        aria-label="展开 AI 浮层"
        onPointerDownCapture={() => { rememberEditor(); requestScreenplayScope(); }}
        onClick={restore}
        className="absolute z-20 h-10 px-3.5 rounded-lg text-sm font-medium"
        style={{
          ...restoreStyle,
          display: collapsed ? "block" : "none",
          background: "#ffffff",
          color: "#c2410c",
          border: "1px solid #e7e5e4",
          boxShadow: "0 4px 16px rgba(28, 25, 23, 0.08)",
        }}
      >
        AI
      </button>
    <div
      ref={panelRef}
      onPointerDownCapture={() => { rememberEditor(); requestScreenplayScope(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          collapse();
        }
      }}
      className="absolute z-20 flex flex-col overflow-hidden rounded-xl"
      style={{
        ...positionStyle,
        display: collapsed ? "none" : "flex",
        width: frame?.w ?? "min(360px, calc(100% - 24px))",
        height: frame?.h ?? "min(400px, calc(100% - 24px))",
        background: "#ffffff",
        border: "1px solid #e7e5e4",
        boxShadow: "0 12px 40px rgba(28, 25, 23, 0.10)",
      }}
    >
      <div
        className="flex items-center justify-between h-10 shrink-0 border-b select-none"
        style={{ borderColor: "#e7e5e4", background: "#fafaf9" }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="拖动 AI 浮层"
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onKeyDown={onHandleKeyDown}
          className="flex-1 h-full flex items-center px-3 cursor-grab active:cursor-grabbing touch-none focus-visible:outline-2 focus-visible:outline-orange-700"
          style={{ color: "#1c1917" }}
        >
          <span className="text-xs font-semibold">
          AI 助手
          </span>
        </div>
        <button
          type="button"
          aria-label="收起"
          onClick={collapse}
          className="w-9 h-9 mr-1 rounded-md flex items-center justify-center"
          style={{ color: "#78716c" }}
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 flex flex-col p-3 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto mb-2 space-y-1.5 pr-0.5">
          {lines.length === 0 && (
            <p className="text-[11px] leading-5" style={{ color: "#a8a29e" }}>
              {mode === "cinema"
                ? "只改当前 Reel 的场景、表演或文字镜头，不会动剧本项目。"
                : "选中对白或动作，写下指令后发送。只会改选区内的节点，不会生成整本。"}
            </p>
          )}
          {lines.map((line, index) => (
            <p
              key={`${line.role}-${index}`}
              className="text-[11px] leading-5 whitespace-pre-wrap"
              style={{ color: line.role === "user" ? "#1c1917" : "#57534e" }}
            >
              {line.role === "user" ? "你：" : "AI："}
              {line.text}
            </p>
          ))}
          {sending && (
            <p className="text-[11px] inline-flex items-center gap-1" style={{ color: "#c2410c" }}>
              <Loader2 size={11} className="animate-spin" />
              正在按选区修订…
            </p>
          )}
          <div ref={linesEndRef} />
        </div>
        <textarea
          ref={promptRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="写一条指令… 选区会随消息送出"
          aria-label="AI 指令"
          disabled={sending}
          className="h-24 w-full shrink-0 resize-none rounded-lg px-3 py-2 text-sm focus:outline-none disabled:opacity-60"
          style={{
            background: "#fafaf9",
            color: "#1c1917",
            border: "1px solid #e7e5e4",
          }}
        />
        {mode === "cinema" && (
          <div className="mb-2 flex gap-1" role="group" aria-label="Cinema 作用域">
            {(
              [
                { id: "scene" as const, label: "场景" },
                { id: "performance" as const, label: "表演" },
                { id: "shots" as const, label: "镜头" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCinemaTarget(item.id)}
                className="px-2 py-1 rounded-md text-[10px]"
                style={{
                  color: cinemaTarget === item.id ? "#c2410c" : "#78716c",
                  background: cinemaTarget === item.id ? "rgba(194, 65, 12, 0.08)" : "#f5f5f4",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[10px] truncate" style={{ color: "#a8a29e" }}>
            {scopeLabel}
          </p>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim() || sending}
            className="h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-30"
            style={{
              background: text.trim() && !sending ? "#c2410c" : "#e7e5e4",
              color: text.trim() && !sending ? "#ffffff" : "#78716c",
            }}
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} strokeWidth={2} />}
            发送
          </button>
        </div>
      </div>

      {(["e", "s", "se"] as const).map((axis) => (
        <div
          key={axis}
          role="separator"
          aria-label={axis === "e" ? "调整 AI 宽度" : axis === "s" ? "调整 AI 高度" : "调整 AI 大小"}
          aria-orientation={axis === "e" ? "vertical" : "horizontal"}
          onPointerDown={(event) => onResizeStart(event, axis)}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          className={`absolute touch-none ${axis === "e" ? "right-0 top-10 bottom-4 w-2 cursor-ew-resize" : axis === "s" ? "left-0 right-4 bottom-0 h-2 cursor-ns-resize" : "right-0 bottom-0 w-4 h-4 cursor-se-resize"}`}
        >
          {axis === "se" && <span className="absolute right-1.5 bottom-1.5 w-2 h-2" style={{ borderRight: "1.5px solid #a8a29e", borderBottom: "1.5px solid #a8a29e" }} />}
        </div>
      ))}
    </div>
    </>
  );
}
