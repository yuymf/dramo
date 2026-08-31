"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
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
  const episodeIdRef = useRef<string | null>(null);
  const linesEndRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);

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

  const resolveOrigin = useCallback(() => {
    const el = panelRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) {
      return { x: 16, y: 16 };
    }
    if (pos) return pos;
    return {
      x: Math.max(8, parent.clientWidth - size.w - 16),
      y: Math.max(8, parent.clientHeight - size.h - 16),
    };
  }, [pos, size.h, size.w]);

  const onDragStart = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const origin = resolveOrigin();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: origin.x,
      origY: origin.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onDragMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const parent = panelRef.current?.offsetParent as HTMLElement | null;
    const nextX = drag.origX + (e.clientX - drag.startX);
    const nextY = drag.origY + (e.clientY - drag.startY);
    const maxX = Math.max(8, (parent?.clientWidth ?? 800) - (collapsed ? 88 : size.w) - 8);
    const maxY = Math.max(8, (parent?.clientHeight ?? 600) - (collapsed ? 40 : size.h) - 8);
    setPos({
      x: Math.min(Math.max(8, nextX), maxX),
      y: Math.min(Math.max(8, nextY), maxY),
    });
  };

  const onDragEnd = (e: ReactPointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const onResizeStart = (e: ReactPointerEvent) => {
    setPos(resolveOrigin());
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origW: size.w,
      origH: size.h,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const onResizeMove = (e: ReactPointerEvent) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    const parent = panelRef.current?.offsetParent as HTMLElement | null;
    const origin = resolveOrigin();
    const maxW = Math.max(MIN_W, (parent?.clientWidth ?? 800) - origin.x - 8);
    const maxH = Math.max(MIN_H, (parent?.clientHeight ?? 600) - origin.y - 8);
    setSize({
      w: Math.min(Math.max(MIN_W, resize.origW + (e.clientX - resize.startX)), maxW),
      h: Math.min(Math.max(MIN_H, resize.origH + (e.clientY - resize.startY)), maxH),
    });
  };

  const onResizeEnd = (e: ReactPointerEvent) => {
    if (resizeRef.current?.pointerId === e.pointerId) {
      resizeRef.current = null;
    }
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

  const positionStyle: CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: 16, bottom: 16 };

  const scopeLabel =
    mode === "cinema"
      ? `Cinema · ${cinemaTarget === "scene" ? "场景" : cinemaTarget === "shots" ? "镜头" : "表演"}`
      : scope.nodeIds.length > 0
        ? `${scope.type === "scene" ? "本场" : "选区"} ${scope.nodeIds.length} 个节点`
        : "未选中节点";

  if (collapsed) {
    return (
      <button
        ref={panelRef}
        type="button"
        aria-label="展开 AI 浮层"
        onClick={() => setCollapsed(false)}
        className="absolute z-20 h-10 px-3.5 rounded-lg text-sm font-medium"
        style={{
          ...positionStyle,
          background: "#ffffff",
          color: "#c2410c",
          border: "1px solid #e7e5e4",
          boxShadow: "0 4px 16px rgba(28, 25, 23, 0.08)",
        }}
      >
        AI
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="absolute z-20 flex flex-col overflow-hidden rounded-xl"
      style={{
        ...positionStyle,
        width: size.w,
        height: size.h,
        background: "#ffffff",
        border: "1px solid #e7e5e4",
        boxShadow: "0 12px 40px rgba(28, 25, 23, 0.10)",
      }}
    >
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className="flex items-center justify-between px-3 h-10 shrink-0 cursor-grab active:cursor-grabbing border-b select-none"
        style={{ borderColor: "#e7e5e4", background: "#fafaf9" }}
      >
        <span className="text-xs font-semibold" style={{ color: "#1c1917" }}>
          AI 助手
        </span>
        <button
          type="button"
          aria-label="收起"
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 rounded-md flex items-center justify-center"
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

      <div
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        aria-label="调整大小"
        className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize"
      >
        <span
          className="absolute right-1.5 bottom-1.5 w-2 h-2"
          style={{
            borderRight: "1.5px solid #a8a29e",
            borderBottom: "1.5px solid #a8a29e",
          }}
        />
      </div>
    </div>
  );
}
