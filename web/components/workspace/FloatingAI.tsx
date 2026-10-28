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
import { usePathname } from "next/navigation";
import { Grip, Loader2, Minus, Send } from "lucide-react";
import { api } from "@/lib/api/client";
import { assistReel } from "@/lib/api/cinema";
import { firstEpisodeId } from "@/lib/api/planning";
import type { CinemaAssistTarget } from "@/lib/types/cinema";
import type { ScreenplayDoc, ScreenplayNode } from "@/lib/types/screenplay";
import type { DerivedEntityKind } from "@/lib/api/entities";
import { entityRevisedEvent, entityScopeEvent, requestEntityScope } from "@/components/entities/scope";
import {
  SCREENPLAY_SCOPE_EVENT,
  dispatchScreenplayRevised,
  requestScreenplayScope,
  requestScreenplayFlush,
  type ScreenplayScopeDetail,
  type ScreenplayScopeType,
} from "@/components/screenplay/scope";
import {
  BEAT_SCOPE_EVENT,
  OUTLINE_SCOPE_EVENT,
  dispatchBeatRevised,
  dispatchOutlineRevised,
  requestBeatFlush,
  requestBeatScope,
  requestOutlineFlush,
  requestOutlineScope,
  type BeatScopeDetail,
  type OutlineScopeDetail,
} from "@/components/planning/scope";

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

type PlanningPageKind = "script" | "outline" | "beats" | DerivedEntityKind;

interface ScriptPendingProposal {
  kind: "script";
  instruction: string;
  scope: { type: ScreenplayScopeType; nodeIds: string[] };
  replacements: ScreenplayNode[];
  proposalText: string;
  lineIndex: number;
}

interface OutlinePendingProposal {
  kind: "outline";
  instruction: string;
  scope: { type: "paragraph"; index: number };
  revisedText: string;
  proposalText: string;
  lineIndex: number;
}

interface BeatPendingProposal {
  kind: "beats";
  instruction: string;
  scope: { type: "beat"; beatId: string };
  revised: { action: string; intent: string; outcome: string };
  proposalText: string;
  lineIndex: number;
}

interface EntityPendingProposal {
  kind: DerivedEntityKind;
  id: string;
  diff: Array<{ field: string; before: string | null; after: string }>;
  proposalText: string;
}

type PendingProposal = ScriptPendingProposal | OutlinePendingProposal | BeatPendingProposal | EntityPendingProposal;

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
  const pathname = usePathname() ?? "";
  const pageKind: PlanningPageKind = pathname.includes("/outline")
    ? "outline"
    : pathname.includes("/beats")
      ? "beats"
      : pathname.includes("/characters")
        ? "character"
        : pathname.includes("/locations")
          ? "location"
      : "script";
  const [collapsed, setCollapsed] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [cinemaTarget, setCinemaTarget] = useState<CinemaAssistTarget>("performance");
  const [cinemaReelId, setCinemaReelId] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);
  /** User-chosen revise scope mode: 选区 vs 本场. Editor always publishes seed selection ids. */
  const [scopeMode, setScopeMode] = useState<ScreenplayScopeType>("selection");
  const [scope, setScope] = useState<ScreenplayScopeDetail>({
    type: "selection",
    nodeIds: scopeNodeIds,
  });
  const [outlineIndex, setOutlineIndex] = useState<number | null>(null);
  const [beatId, setBeatId] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const entityIdRef = useRef<string | null>(null);
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
    setScope((prev) => ({ ...prev, type: scopeMode }));
  }, [scopeMode]);

  useEffect(() => {
    const onScope = (event: Event) => {
      const detail = (event as CustomEvent<ScreenplayScopeDetail>).detail;
      if (!detail) return;
      // Editor publishes focused/selected seed ids; FloatingAI owns 选区|本场 mode.
      const nodeIds = Array.isArray(detail.nodeIds)
        ? detail.nodeIds.filter((id) => typeof id === "string" && id.trim())
        : [];
      setScope((prev) => ({
        type: scopeMode,
        // Keep last known seed if republish is empty (e.g. focus moved to AI panel).
        nodeIds: nodeIds.length > 0 ? nodeIds : prev.nodeIds,
      }));
    };
    window.addEventListener(SCREENPLAY_SCOPE_EVENT, onScope);
    return () => window.removeEventListener(SCREENPLAY_SCOPE_EVENT, onScope);
  }, [scopeMode]);

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
    const onOutline = (event: Event) => {
      const detail = (event as CustomEvent<OutlineScopeDetail>).detail;
      if (!detail || typeof detail.index !== "number") return;
      setOutlineIndex(detail.index);
    };
    window.addEventListener(OUTLINE_SCOPE_EVENT, onOutline);
    return () => window.removeEventListener(OUTLINE_SCOPE_EVENT, onOutline);
  }, []);

  useEffect(() => {
    const onBeat = (event: Event) => {
      const detail = (event as CustomEvent<BeatScopeDetail>).detail;
      if (!detail) return;
      setBeatId(typeof detail.beatId === "string" && detail.beatId.trim() ? detail.beatId : null);
    };
    window.addEventListener(BEAT_SCOPE_EVENT, onBeat);
    return () => window.removeEventListener(BEAT_SCOPE_EVENT, onBeat);
  }, []);

  useEffect(() => {
    if (pageKind !== "character" && pageKind !== "location") return;
    const onEntity = (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      const nextId = typeof id === "string" && id.trim() ? id : null;
      if (entityIdRef.current !== nextId) setPendingProposal(null);
      entityIdRef.current = nextId;
      setEntityId(nextId);
    };
    window.addEventListener(entityScopeEvent(pageKind), onEntity);
    requestEntityScope(pageKind);
    return () => window.removeEventListener(entityScopeEvent(pageKind), onEntity);
  }, [pageKind]);

  useEffect(() => {
    // Clear cross-page pending proposal when navigating.
    setPendingProposal(null);
    entityIdRef.current = null;
    setEntityId(null);
    if (pageKind === "outline") requestOutlineScope();
    if (pageKind === "beats") requestBeatScope();
    if (pageKind === "character" || pageKind === "location") requestEntityScope(pageKind);
  }, [pageKind]);

  useEffect(() => {
    linesEndRef.current?.scrollIntoView({ block: "end" });
  }, [lines, sending, pendingProposal]);

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

  const requestPageScope = () => {
    if (pageKind === "outline") requestOutlineScope();
    else if (pageKind === "beats") requestBeatScope();
    else if (pageKind === "character" || pageKind === "location") requestEntityScope(pageKind);
    else requestScreenplayScope();
  };

  const restore = () => {
    requestPageScope();
    setFrame((previous) => fitFrame(previous ?? currentFrame(), getBounds()));
    setCollapsed(false);
    window.requestAnimationFrame(() => promptRef.current?.focus());
  };

  const onDragStart = (e: ReactPointerEvent) => {
    rememberEditor();
    requestPageScope();
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
    requestPageScope();
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

    if (pendingProposal) {
      setLines((prev) => [
        ...prev,
        { role: "assistant", text: "请先接受或拒绝当前修订提案" },
      ]);
      return;
    }

    if (pageKind === "character" || pageKind === "location") {
      if (!entityId) {
        setLines((prev) => [...prev, { role: "assistant", text: "请先选择角色/地点" }]);
        return;
      }
      setText("");
      setSending(true);
      setLines((prev) => [...prev, { role: "user", text: next }]);
      try {
        const proposal = unwrap(await api<{
          scope: { type: DerivedEntityKind; id: string };
          diff: EntityPendingProposal["diff"];
          proposalText: string;
        }>(`/api/projects/${projectId}/entities/${pageKind}/${entityId}/revise/preview`, {
          method: "POST", body: { instruction: next }, noCache: true, timeoutMs: 120_000,
        }));
        const proposalText = proposal.proposalText || "（无改动）";
        setLines((prev) => [...prev, { role: "assistant", text: `修订提案（尚未写入）：\n${proposalText}` }]);
        setPendingProposal({ kind: pageKind, id: entityId, diff: proposal.diff, proposalText });
        onSend?.({ projectId, text: next, scopeNodeIds: [] });
      } catch (err) {
        setPendingProposal(null);
        setLines((prev) => [...prev, { role: "assistant", text: err instanceof Error ? err.message : "修订失败" }]);
      } finally {
        setSending(false);
      }
      return;
    }

    if (pageKind === "outline") {
      if (outlineIndex === null || outlineIndex < 0) {
        setLines((prev) => [...prev, { role: "assistant", text: "请先把光标放在大纲段落内" }]);
        return;
      }
      setText("");
      setSending(true);
      setLines((prev) => [...prev, { role: "user", text: next }]);
      try {
        await requestOutlineFlush();
        const episodeId = await resolveEpisodeId();
        const proposal = unwrap(
          await api<
            | {
                instruction: string;
                scope: { type: "paragraph"; index: number };
                revisedText: string;
                proposalText: string;
              }
            | {
                data: {
                  instruction: string;
                  scope: { type: "paragraph"; index: number };
                  revisedText: string;
                  proposalText: string;
                };
              }
          >(`/api/projects/${projectId}/episodes/${episodeId}/outline/revise`, {
            method: "POST",
            body: {
              instruction: next,
              scope: { type: "paragraph", index: outlineIndex },
            },
            noCache: true,
            timeoutMs: 120_000,
          })
        );
        const proposalText =
          typeof proposal.proposalText === "string" && proposal.proposalText.trim()
            ? proposal.proposalText
            : "（提案为空）";
        setLines((prev) => [...prev, { role: "assistant", text: `修订提案（尚未写入）：\n${proposalText}` }]);
        setPendingProposal({
          kind: "outline",
          instruction: proposal.instruction ?? next,
          scope: {
            type: "paragraph",
            index:
              typeof proposal.scope?.index === "number" ? proposal.scope.index : outlineIndex,
          },
          revisedText: typeof proposal.revisedText === "string" ? proposal.revisedText : "",
          proposalText,
          lineIndex: -1,
        });
        onSend?.({ projectId, text: next, scopeNodeIds: [] });
      } catch (err) {
        const message = err instanceof Error ? err.message : "修订失败";
        setPendingProposal(null);
        setLines((prev) => [...prev, { role: "assistant", text: message }]);
      } finally {
        setSending(false);
      }
      return;
    }

    if (pageKind === "beats") {
      if (!beatId) {
        setLines((prev) => [...prev, { role: "assistant", text: "请先保存该 Beat" }]);
        return;
      }
      setText("");
      setSending(true);
      setLines((prev) => [...prev, { role: "user", text: next }]);
      try {
        await requestBeatFlush();
        const episodeId = await resolveEpisodeId();
        const proposal = unwrap(
          await api<
            | {
                instruction: string;
                scope: { type: "beat"; beatId: string };
                revised: { action: string; intent: string; outcome: string };
                proposalText: string;
              }
            | {
                data: {
                  instruction: string;
                  scope: { type: "beat"; beatId: string };
                  revised: { action: string; intent: string; outcome: string };
                  proposalText: string;
                };
              }
          >(`/api/projects/${projectId}/episodes/${episodeId}/beats/revise`, {
            method: "POST",
            body: {
              instruction: next,
              scope: { type: "beat", beatId },
            },
            noCache: true,
            timeoutMs: 120_000,
          })
        );
        const proposalText =
          typeof proposal.proposalText === "string" && proposal.proposalText.trim()
            ? proposal.proposalText
            : "（提案为空）";
        setLines((prev) => [...prev, { role: "assistant", text: `修订提案（尚未写入）：\n${proposalText}` }]);
        setPendingProposal({
          kind: "beats",
          instruction: proposal.instruction ?? next,
          scope: {
            type: "beat",
            beatId:
              typeof proposal.scope?.beatId === "string" && proposal.scope.beatId.trim()
                ? proposal.scope.beatId
                : beatId,
          },
          revised:
            proposal.revised && typeof proposal.revised === "object"
              ? {
                  action: String(proposal.revised.action ?? ""),
                  intent: String(proposal.revised.intent ?? ""),
                  outcome: String(proposal.revised.outcome ?? ""),
                }
              : { action: "", intent: "", outcome: "" },
          proposalText,
          lineIndex: -1,
        });
        onSend?.({ projectId, text: next, scopeNodeIds: [] });
      } catch (err) {
        const message = err instanceof Error ? err.message : "修订失败";
        setPendingProposal(null);
        setLines((prev) => [...prev, { role: "assistant", text: message }]);
      } finally {
        setSending(false);
      }
      return;
    }

    // Freeze scope at submit — Accept/Reject must not re-expand after float drag/focus steal.
    const frozenScope: { type: ScreenplayScopeType; nodeIds: string[] } = {
      type: scopeMode,
      nodeIds: [...scope.nodeIds],
    };

    if (frozenScope.nodeIds.length === 0) {
      const hint =
        frozenScope.type === "scene"
          ? "请先把光标放在某一场内"
          : "请先在剧本里选中要改的句子";
      setLines((prev) => [...prev, { role: "assistant", text: hint }]);
      return;
    }

    setText("");
    setSending(true);
    setLines((prev) => [...prev, { role: "user", text: next }]);

    try {
      await requestScreenplayFlush();
      const episodeId = await resolveEpisodeId();
      // Preview only — do not write until Accept.
      const proposal = unwrap(
        await api<
          | {
              instruction: string;
              scope: { type: ScreenplayScopeType; nodeIds: string[] };
              replacements: ScreenplayNode[];
              proposalText: string;
            }
          | {
              data: {
                instruction: string;
                scope: { type: ScreenplayScopeType; nodeIds: string[] };
                replacements: ScreenplayNode[];
                proposalText: string;
              };
            }
        >(`/api/projects/${projectId}/episodes/${episodeId}/screenplay/revise`, {
          method: "POST",
          body: {
            instruction: next,
            // Prefer server expand as source of truth: send seed ids + type=scene.
            // selection: exact frozen nodeIds — no silent expand.
            scope: { type: frozenScope.type, nodeIds: frozenScope.nodeIds },
          },
          noCache: true,
          timeoutMs: 120_000,
        })
      );

      const proposalText =
        typeof proposal.proposalText === "string" && proposal.proposalText.trim()
          ? proposal.proposalText
          : "（提案为空）";
      const assistantLine = `修订提案（尚未写入）：\n${proposalText}`;

      // Snapshot only — never re-read live scopeMode/nodeIds on Accept.
      const snappedType: ScreenplayScopeType =
        frozenScope.type === "scene" || proposal.scope?.type === "scene"
          ? "scene"
          : "selection";
      const snappedNodeIds =
        snappedType === "scene" &&
        Array.isArray(proposal.scope?.nodeIds) &&
        proposal.scope.nodeIds.length > 0
          ? proposal.scope.nodeIds
          : frozenScope.nodeIds;

      setLines((prev) => [...prev, { role: "assistant", text: assistantLine }]);
      setPendingProposal({
        kind: "script",
        instruction: proposal.instruction ?? next,
        scope: {
          type: snappedType,
          nodeIds: snappedNodeIds,
        },
        replacements: Array.isArray(proposal.replacements) ? proposal.replacements : [],
        proposalText,
        lineIndex: -1,
      });
      onSend?.({ projectId, text: next, scopeNodeIds: frozenScope.nodeIds });
    } catch (err) {
      const message = err instanceof Error ? err.message : "修订失败";
      setPendingProposal(null);
      setLines((prev) => [...prev, { role: "assistant", text: message }]);
    } finally {
      setSending(false);
    }
  };

  const acceptProposal = async () => {
    if (!pendingProposal || sending) return;
    setSending(true);
    try {
      if (pendingProposal.kind === "character" || pendingProposal.kind === "location") {
        if (pendingProposal.id !== entityId) throw new Error("当前选择已变化，请重新预览");
        if (pendingProposal.diff.length > 0) {
          await api(`/api/projects/${projectId}/entities/${pendingProposal.kind}/${pendingProposal.id}/revise/accept`, {
            method: "POST", body: { diff: pendingProposal.diff }, noCache: true,
          });
          window.dispatchEvent(new Event(entityRevisedEvent(pendingProposal.kind)));
        }
        setPendingProposal(null);
        setLines((prev) => [...prev, { role: "assistant", text: "已接受提案并写回当前实体" }]);
        return;
      }
      const episodeId = await resolveEpisodeId();
      if (pendingProposal.kind === "outline") {
        await requestOutlineFlush();
        const doc = unwrap(
          await api<{ markdown: string } | { data: { markdown: string } }>(
            `/api/projects/${projectId}/episodes/${episodeId}/outline/revise/accept`,
            {
              method: "POST",
              body: {
                scope: pendingProposal.scope,
                revisedText: pendingProposal.revisedText,
              },
              noCache: true,
              timeoutMs: 60_000,
            }
          )
        );
        dispatchOutlineRevised(doc.markdown);
        setPendingProposal(null);
        setLines((prev) => [
          ...prev,
          { role: "assistant", text: "已接受提案并写回当前段落" },
        ]);
        return;
      }
      if (pendingProposal.kind === "beats") {
        await requestBeatFlush();
        const doc = unwrap(
          await api<
            | { beats: BeatPendingProposal["revised"][] }
            | { data: { beats: Array<{ id?: string; action: string; intent: string; outcome: string }> } }
          >(`/api/projects/${projectId}/episodes/${episodeId}/beats/revise/accept`, {
            method: "POST",
            body: {
              scope: pendingProposal.scope,
              revised: pendingProposal.revised,
            },
            noCache: true,
            timeoutMs: 60_000,
          })
        );
        const beats = Array.isArray((doc as { beats?: unknown }).beats)
          ? (doc as { beats: Array<{ id?: string; action: string; intent: string; outcome: string }> }).beats
          : [];
        dispatchBeatRevised(beats);
        setPendingProposal(null);
        setLines((prev) => [
          ...prev,
          { role: "assistant", text: "已接受提案并写回当前 Beat" },
        ]);
        return;
      }

      if (pendingProposal.kind !== "script") throw new Error("修订范围已变化，请重新预览");

      const flushed = await requestScreenplayFlush();
      const doc = unwrap(
        await api<ScreenplayDoc | { data: ScreenplayDoc }>(
          `/api/projects/${projectId}/episodes/${episodeId}/screenplay/revise/accept`,
          {
            method: "POST",
            body: {
              replacements: pendingProposal.replacements,
              scope: pendingProposal.scope,
              baseUpdatedAt: flushed.updatedAt,
            },
            noCache: true,
            timeoutMs: 60_000,
          }
        )
      );
      dispatchScreenplayRevised(doc);
      const count = Array.isArray(doc.nodes) ? doc.nodes.length : 0;
      setPendingProposal(null);
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `已接受提案并写回${pendingProposal.scope.type === "scene" ? "本场" : "选区"}（全文 ${count} 个节点）`,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "接受修订失败";
      setLines((prev) => [...prev, { role: "assistant", text: message }]);
    } finally {
      setSending(false);
    }
  };

  const rejectProposal = () => {
    if (sending) return;
    setPendingProposal(null);
    setLines((prev) => [...prev, { role: "assistant", text: "已拒绝提案，草稿未改动" }]);
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
      : pageKind === "outline"
        ? outlineIndex !== null && outlineIndex >= 0
          ? `当前段落 · 第 ${outlineIndex + 1} 段`
          : "当前段落 · 未定位"
        : pageKind === "beats"
          ? beatId
            ? "当前 Beat"
            : "当前 Beat · 未保存"
          : pageKind === "character" || pageKind === "location"
            ? entityId ? `当前${pageKind === "character" ? "角色" : "地点"}` : "角色/地点 · 未选择"
          : scope.nodeIds.length > 0
            ? `${scopeMode === "scene" ? "本场" : "选区"} ${scope.nodeIds.length} 个节点`
            : scopeMode === "scene"
              ? "本场 · 未定位"
              : "未选中节点";

  return (
    <>
      <button
        type="button"
        aria-label="展开 AI 浮层"
        title="展开 AI 浮层"
        onPointerDownCapture={() => { rememberEditor(); requestPageScope(); }}
        onClick={restore}
        className="absolute z-20 h-10 px-3.5 rounded-lg text-sm font-medium"
        style={{
          ...restoreStyle,
          display: collapsed ? "block" : "none",
          background: "var(--ws-surface, #ffffff)",
          color: "var(--ws-action-text, #c2410c)",
          border: "1px solid var(--ws-border, #e7e5e4)",
          boxShadow: "var(--ws-shadow)",
        }}
      >
        AI
      </button>
    <div
      ref={panelRef}
      onPointerDownCapture={() => { rememberEditor(); requestPageScope(); }}
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
        background: "var(--ws-surface, #ffffff)",
        border: "1px solid var(--ws-border, #e7e5e4)",
        boxShadow: "var(--ws-shadow, 0 12px 40px rgba(28, 25, 23, 0.10))",
      }}
    >
      <div
        className="flex items-center justify-between h-11 shrink-0 border-b select-none"
        style={{ borderColor: "var(--ws-border, #e7e5e4)", background: "var(--ws-surface, #ffffff)" }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="拖动 AI 浮层"
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          title="拖动 AI 浮层；方向键移动"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onKeyDown={onHandleKeyDown}
          className="flex-1 h-full flex items-center gap-2 px-3 cursor-grab active:cursor-grabbing touch-none focus-visible:outline-2 focus-visible:outline-orange-700"
          style={{ color: "var(--ws-text, #1c1917)" }}
        >
          <Grip size={16} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--ws-secondary)" }} />
          <span className="text-base font-semibold">AI 助手</span>
          <span className="text-xs font-normal" style={{ color: "var(--ws-muted)" }}>拖动</span>
        </div>
        <button
          type="button"
          aria-label="收起"
          title="收起 AI 浮层"
          onClick={collapse}
          className="w-9 h-9 mr-1 rounded-md flex items-center justify-center"
          style={{ color: "var(--ws-secondary, #78716c)" }}
        >
          <Minus size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 flex flex-col p-3 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto mb-2 space-y-1.5 pr-0.5">
          {lines.length === 0 && (
            <p className="text-[11px] leading-5" style={{ color: "var(--ws-muted, #a8a29e)" }}>
              {mode === "cinema"
                ? "只改当前 Reel 的场景、表演或文字镜头，不会动剧本项目。"
                : pageKind === "outline"
                  ? "把光标放在要改的段落内，写下指令。预览不写大纲，接受后只改当前段落。"
                  : pageKind === "beats"
                    ? "先保存并聚焦一个 Beat，写下指令。预览不写 Beats，接受后只改当前 Beat。"
                    : pageKind === "character" || pageKind === "location"
                      ? "先选择一个角色或地点，写下指令。预览不写入，接受后只改当前实体。"
                    : "选中对白或动作，或切换「本场」后把光标放在某一场内，写下指令。预览不写稿，接受后才改对应范围。"}
            </p>
          )}
          {lines.map((line, index) => (
            <p
              key={`${line.role}-${index}`}
              className="ws-chat-line text-[11px] leading-5 whitespace-pre-wrap"
              style={{ color: line.role === "user" ? "var(--ws-text, #1c1917)" : "var(--ws-secondary, #57534e)" }}
            >
              {line.role === "user" ? "你：" : "AI："}
              {line.text}
            </p>
          ))}
          {sending && !pendingProposal && (
            <p className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--ws-action-text, #c2410c)" }}>
              <Loader2 size={11} className="animate-spin" />
              正在生成修订提案…
            </p>
          )}
          {pendingProposal && mode === "script" && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                data-testid="ai-revise-accept"
                onClick={() => void acceptProposal()}
                disabled={sending}
                className="h-7 px-2.5 rounded-md text-[11px] font-medium disabled:opacity-40"
                style={{ background: "var(--ws-accent, #c2410c)", color: "#ffffff" }}
              >
                接受
              </button>
              <button
                type="button"
                data-testid="ai-revise-reject"
                onClick={rejectProposal}
                disabled={sending}
                className="h-7 px-2.5 rounded-md text-[11px] font-medium disabled:opacity-40"
                style={{
                  background: "var(--ws-canvas, #fafaf9)",
                  color: "var(--ws-secondary, #57534e)",
                  border: "1px solid var(--ws-border, #e7e5e4)",
                }}
              >
                拒绝
              </button>
            </div>
          )}
          <div ref={linesEndRef} />
        </div>
        {mode === "script" && pageKind === "script" && (
          <div
            className="mb-2 flex gap-1 shrink-0"
            role="radiogroup"
            aria-label="修订范围"
            data-testid="ai-scope-mode"
          >
            {(
              [
                { id: "selection" as const, label: "选区", aria: "按选区修订" },
                { id: "scene" as const, label: "本场", aria: "按本场修订" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={scopeMode === item.id}
                aria-label={item.aria}
                data-testid={`ai-scope-${item.id}`}
                onClick={() => {
                  setScopeMode(item.id);
                  setScope((prev) => ({ ...prev, type: item.id }));
                  requestPageScope();
                }}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium"
                style={{
                  color: scopeMode === item.id ? "#c2410c" : "#78716c",
                  background:
                    scopeMode === item.id ? "rgba(194, 65, 12, 0.08)" : "#f5f5f4",
                  border:
                    scopeMode === item.id
                      ? "1px solid rgba(194, 65, 12, 0.35)"
                      : "1px solid transparent",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
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
          placeholder={
            pageKind === "outline"
              ? "写一条指令… 将修订当前段落"
              : pageKind === "beats"
                ? "写一条指令… 将修订当前 Beat"
                : pageKind === "character" || pageKind === "location"
                  ? `写一条指令… 将修订当前${pageKind === "character" ? "角色" : "地点"}`
                : scopeMode === "scene"
                  ? "写一条指令… 将修订当前场所在节点"
                  : "写一条指令… 选区会随消息送出"
          }
          aria-label="AI 指令"
          disabled={sending}
          className="h-24 w-full shrink-0 resize-none rounded-lg px-3 py-2 text-sm focus:outline-none disabled:opacity-60"
          style={{
            background: "var(--ws-canvas, #fafaf9)",
            color: "var(--ws-text, #1c1917)",
            border: "1px solid var(--ws-border, #e7e5e4)",
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
          <p className="text-[10px] truncate" style={{ color: "var(--ws-muted, #a8a29e)" }}>
            {scopeLabel}
          </p>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim() || sending || !!pendingProposal}
            className="h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-30"
            style={{
              background: text.trim() && !sending && !pendingProposal ? "var(--ws-accent, #c2410c)" : "var(--ws-border, #e7e5e4)",
              color: text.trim() && !sending && !pendingProposal ? "#ffffff" : "var(--ws-secondary, #78716c)",
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
          {axis === "se" && <span className="absolute right-1.5 bottom-1.5 w-2 h-2" style={{ borderRight: "1.5px solid var(--ws-muted, #a8a29e)", borderBottom: "1.5px solid var(--ws-muted, #a8a29e)" }} />}
        </div>
      ))}
    </div>
    </>
  );
}
