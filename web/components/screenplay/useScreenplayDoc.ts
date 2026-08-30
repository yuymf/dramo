"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import {
  EMPTY_COVER,
  type Cover,
  type ScreenplayDoc,
  type ScreenplayFormat,
  type ScreenplayNode,
} from "@/lib/types/screenplay";
import { createNode } from "./nodeMeta";
import {
  SCREENPLAY_FLUSH_EVENT,
  SCREENPLAY_REVISED_EVENT,
  type ScreenplayFlushDetail,
} from "./scope";

export type SaveStatus = "idle" | "loading" | "dirty" | "saving" | "saved" | "error";

export interface ProjectEpisode {
  id: string;
  name?: string;
  sortOrder?: number;
}

export interface ProjectDetail {
  id: string;
  name: string;
  format?: ScreenplayFormat;
  episodes?: ProjectEpisode[];
}

interface UseScreenplayDocResult {
  project: ProjectDetail | null;
  episodeId: string | null;
  format: ScreenplayFormat;
  title: string;
  cover: Cover;
  nodes: ScreenplayNode[];
  doc: ScreenplayDoc;
  status: SaveStatus;
  error: string | null;
  ready: boolean;
  setCover: (cover: Cover) => void;
  setNodes: (nodes: ScreenplayNode[]) => void;
  setTitle: (title: string) => void;
}

const DEBOUNCE_MS = 800;

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

function normalizeCover(cover: Cover | null | undefined): Cover {
  return {
    title: cover?.title ?? "",
    author: cover?.author ?? "",
    contact: cover?.contact ?? "",
    draftDate: cover?.draftDate ?? "",
  };
}

function normalizeNodes(nodes: ScreenplayNode[] | null | undefined): ScreenplayNode[] {
  if (nodes && nodes.length > 0) return nodes;
  return [createNode("action")];
}

export function useScreenplayDoc(projectId: string | undefined): UseScreenplayDocResult {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [format, setFormat] = useState<ScreenplayFormat>("hollywood");
  const [title, setTitleState] = useState("");
  const [cover, setCoverState] = useState<Cover>(EMPTY_COVER);
  const [nodes, setNodesState] = useState<ScreenplayNode[]>([createNode("action")]);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);
  const payloadRef = useRef({ title, cover, nodes, episodeId, projectId });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  payloadRef.current = { title, cover, nodes, episodeId, projectId };

  const putNow = useCallback(async () => {
    const current = payloadRef.current;
    if (!current.projectId || !current.episodeId || !hydratedRef.current) return;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setStatus("saving");
    try {
      await api<ScreenplayDoc>(
        `/api/projects/${current.projectId}/episodes/${current.episodeId}/screenplay`,
        {
          method: "PUT",
          body: {
            title: current.title,
            cover: current.cover,
            nodes: current.nodes,
          },
          noCache: true,
        }
      );
      setStatus("saved");
      setError(null);
    } catch (err) {
      dirtyRef.current = true;
      setStatus("error");
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (!hydratedRef.current) return;
    dirtyRef.current = true;
    setStatus("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void putNow();
    }, DEBOUNCE_MS);
  }, [putNow]);

  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    dirtyRef.current = false;
    setReady(false);
    if (timerRef.current) clearTimeout(timerRef.current);

    async function load() {
      if (!projectId) {
        setStatus("error");
        setError("缺少项目");
        return;
      }
      setStatus("loading");
      setError(null);
      try {
        const projectRes = unwrap(
          await api<ProjectDetail | { data: ProjectDetail }>(`/api/projects/${projectId}`, {
            noCache: true,
          })
        );
        const eid = pickEpisodeId(projectRes);
        if (!eid) {
          throw new Error("项目还没有集数");
        }
        const docRes = unwrap(
          await api<ScreenplayDoc | { data: ScreenplayDoc }>(
            `/api/projects/${projectId}/episodes/${eid}/screenplay`,
            { noCache: true }
          )
        );
        if (cancelled) return;
        setProject(projectRes);
        setEpisodeId(eid);
        setFormat(projectRes.format ?? docRes.format ?? "hollywood");
        setTitleState(docRes.title || projectRes.name || "");
        setCoverState(normalizeCover(docRes.cover));
        setNodesState(normalizeNodes(docRes.nodes));
        setStatus("idle");
        hydratedRef.current = true;
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载失败");
        setStatus("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hydratedRef.current && dirtyRef.current) {
        void putNow();
      }
    };
  }, [projectId, putNow]);

  useEffect(() => {
    const onFlush = (event: Event) => {
      const detail = (event as CustomEvent<ScreenplayFlushDetail>).detail;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void putNow().finally(() => {
        detail?.done?.();
      });
    };

    const onRevised = (event: Event) => {
      const doc = (event as CustomEvent<ScreenplayDoc>).detail;
      if (!doc || typeof doc !== "object") return;
      const current = payloadRef.current;
      if (doc.episodeId && current.episodeId && doc.episodeId !== current.episodeId) {
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      dirtyRef.current = false;
      if (doc.title) setTitleState(doc.title);
      setCoverState(normalizeCover(doc.cover));
      setNodesState(normalizeNodes(doc.nodes));
      if (doc.format) setFormat(doc.format);
      setStatus("saved");
      setError(null);
    };

    window.addEventListener(SCREENPLAY_FLUSH_EVENT, onFlush);
    window.addEventListener(SCREENPLAY_REVISED_EVENT, onRevised);
    return () => {
      window.removeEventListener(SCREENPLAY_FLUSH_EVENT, onFlush);
      window.removeEventListener(SCREENPLAY_REVISED_EVENT, onRevised);
    };
  }, [putNow]);

  const setCover = useCallback(
    (next: Cover) => {
      setCoverState(next);
      if (next.title && next.title !== title) {
        setTitleState(next.title);
      }
      scheduleSave();
    },
    [scheduleSave, title]
  );

  const setNodes = useCallback(
    (next: ScreenplayNode[]) => {
      setNodesState(next.length > 0 ? next : [createNode("action")]);
      scheduleSave();
    },
    [scheduleSave]
  );

  const setTitle = useCallback(
    (next: string) => {
      setTitleState(next);
      setCoverState((prev) => (prev.title === next ? prev : { ...prev, title: next }));
      scheduleSave();
    },
    [scheduleSave]
  );

  return {
    project,
    episodeId,
    format,
    title,
    cover,
    nodes,
    doc: {
      id: episodeId ?? "",
      episodeId: episodeId ?? "",
      title,
      format,
      cover,
      nodes,
      updatedAt: "",
    },
    status,
    error,
    ready,
    setCover,
    setNodes,
    setTitle,
  };
}

export function saveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case "loading":
      return "加载中…";
    case "dirty":
      return "未保存";
    case "saving":
      return "保存中…";
    case "saved":
      return "已保存";
    case "error":
      return "保存失败";
    default:
      return "";
  }
}
