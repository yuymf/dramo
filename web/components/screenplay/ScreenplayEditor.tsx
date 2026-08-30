"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { NodeType, ScreenplayFormat, ScreenplayNode } from "@/lib/types/screenplay";
import { cn } from "@/lib/utils";
import {
  NODE_TYPE_LABELS,
  createNode,
  nextNodeType,
  placeholderFor,
  typeAfterEnter,
} from "./nodeMeta";
import { dispatchScreenplayScope } from "./scope";
import "./screenplay.css";

export interface ScreenplayEditorProps {
  nodes: ScreenplayNode[];
  format: ScreenplayFormat;
  onChange: (nodes: ScreenplayNode[]) => void;
  activeNodeId?: string | null;
  onActiveNodeIdChange?: (id: string | null) => void;
}

function resizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function isComposingKey(event: KeyboardEvent) {
  return event.nativeEvent.isComposing || event.key === "Process";
}

function rangeIds(nodes: ScreenplayNode[], a: number, b: number): string[] {
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  return nodes.slice(start, end + 1).map((node) => node.id);
}

function caretAtVisualEdge(el: HTMLTextAreaElement, edge: "start" | "end"): boolean {
  if (el.selectionStart !== el.selectionEnd) return false;
  const value = el.value;
  const pos = el.selectionStart;
  if (edge === "start") {
    return value.slice(0, pos).indexOf("\n") === -1;
  }
  return value.slice(pos).indexOf("\n") === -1;
}

export function ScreenplayEditor({
  nodes,
  format,
  onChange,
  activeNodeId,
  onActiveNodeIdChange,
}: ScreenplayEditorProps) {
  const inputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdsRef = useRef<string[]>([]);
  const anchorIndexRef = useRef(0);

  const setActive = useCallback(
    (id: string | null) => {
      onActiveNodeIdChange?.(id);
    },
    [onActiveNodeIdChange]
  );

  const publishScope = useCallback((ids: string[]) => {
    selectedIdsRef.current = ids;
    setSelectedIds(ids);
    dispatchScreenplayScope(ids, "selection");
  }, []);

  useEffect(() => {
    return () => {
      dispatchScreenplayScope([]);
    };
  }, []);

  useLayoutEffect(() => {
    if (!pendingFocusId) return;
    const el = inputRefs.current[pendingFocusId];
    if (el) {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
      resizeTextarea(el);
    }
    setPendingFocusId(null);
  }, [pendingFocusId, nodes]);

  useLayoutEffect(() => {
    for (const node of nodes) {
      resizeTextarea(inputRefs.current[node.id] ?? null);
    }
  }, [nodes, format]);

  const updateNode = useCallback(
    (index: number, patch: Partial<ScreenplayNode>) => {
      onChange(nodes.map((node, i) => (i === index ? { ...node, ...patch } : node)));
    },
    [nodes, onChange]
  );

  const selectAt = useCallback(
    (index: number, mode: "replace" | "range" | "toggle") => {
      const node = nodes[index];
      if (!node) return;
      let nextIds: string[];
      if (mode === "range") {
        nextIds = rangeIds(nodes, anchorIndexRef.current, index);
      } else if (mode === "toggle") {
        const current = selectedIdsRef.current;
        nextIds = current.includes(node.id)
          ? current.filter((id) => id !== node.id)
          : [...current, node.id];
      } else {
        nextIds = [node.id];
        anchorIndexRef.current = index;
      }
      setActive(node.id);
      publishScope(nextIds);
    },
    [nodes, publishScope, setActive]
  );

  const insertAfter = useCallback(
    (index: number, type: NodeType) => {
      const created = createNode(type);
      const next = [...nodes];
      next.splice(index + 1, 0, created);
      onChange(next);
      setActive(created.id);
      publishScope([created.id]);
      setPendingFocusId(created.id);
    },
    [nodes, onChange, publishScope, setActive]
  );

  const removeAt = useCallback(
    (index: number) => {
      if (nodes.length <= 1) {
        const kept = { ...nodes[0], text: "" };
        onChange([kept]);
        setActive(kept.id);
        publishScope([kept.id]);
        setPendingFocusId(kept.id);
        return;
      }
      const next = nodes.filter((_, i) => i !== index);
      const focus = next[Math.max(0, index - 1)];
      onChange(next);
      setActive(focus.id);
      publishScope([focus.id]);
      setPendingFocusId(focus.id);
    },
    [nodes, onChange, publishScope, setActive]
  );

  const cycleType = useCallback(
    (index: number, direction: 1 | -1 = 1) => {
      const node = nodes[index];
      if (!node) return;
      updateNode(index, { type: nextNodeType(node.type, direction) });
      setPendingFocusId(node.id);
    },
    [nodes, updateNode]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
      if (isComposingKey(event)) return;
      const node = nodes[index];
      const el = event.currentTarget;

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        insertAfter(index, typeAfterEnter(node.type));
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        cycleType(index, event.shiftKey ? -1 : 1);
        return;
      }

      if (event.key === "Backspace" && node.text === "") {
        event.preventDefault();
        removeAt(index);
        return;
      }

      if (event.key === "ArrowUp" && caretAtVisualEdge(el, "start") && index > 0) {
        event.preventDefault();
        const prev = nodes[index - 1];
        setActive(prev.id);
        publishScope([prev.id]);
        setPendingFocusId(prev.id);
        return;
      }

      if (event.key === "ArrowDown" && caretAtVisualEdge(el, "end") && index < nodes.length - 1) {
        event.preventDefault();
        const next = nodes[index + 1];
        setActive(next.id);
        publishScope([next.id]);
        setPendingFocusId(next.id);
      }
    },
    [cycleType, insertAfter, nodes, publishScope, removeAt, setActive]
  );

  if (nodes.length === 0) {
    return (
      <div className={`sp-editor sp-format-${format}`}>
        <p className="sp-empty">还没有节点。按回车开始写。</p>
      </div>
    );
  }

  return (
    <div className={`sp-editor sp-format-${format}`} role="list" aria-label="剧本正文">
      {nodes.map((node, index) => {
        const isActive = (activeNodeId ?? selectedIds[0]) === node.id;
        const isSelected = selectedIds.includes(node.id);
        return (
          <div
            key={node.id}
            id={`sp-node-${node.id}`}
            role="listitem"
            className={cn(
              "sp-row",
              `sp-node-${node.type}`,
              isActive && "is-active",
              isSelected && "is-selected"
            )}
            onMouseDown={(event) => {
              if (event.shiftKey) selectAt(index, "range");
              else if (event.metaKey || event.ctrlKey) selectAt(index, "toggle");
              else selectAt(index, "replace");
            }}
          >
            <button
              type="button"
              className="sp-gutter"
              tabIndex={-1}
              title="Tab 切换类型"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                cycleType(index, 1);
              }}
            >
              {NODE_TYPE_LABELS[node.type]}
            </button>
            <textarea
              ref={(el) => {
                inputRefs.current[node.id] = el;
              }}
              className="sp-node-input"
              rows={1}
              spellCheck={node.type !== "scene_heading"}
              value={node.text}
              placeholder={placeholderFor(node.type, format)}
              aria-label={NODE_TYPE_LABELS[node.type]}
              onChange={(event) => {
                updateNode(index, { text: event.target.value });
                resizeTextarea(event.target);
              }}
              onFocus={() => {
                if (!selectedIdsRef.current.includes(node.id) || selectedIdsRef.current.length === 0) {
                  selectAt(index, "replace");
                } else {
                  setActive(node.id);
                }
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
            />
          </div>
        );
      })}
    </div>
  );
}
