"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ScreenplayEditor } from "./ScreenplayEditor";
import { PageTimeline } from "./PageTimeline";
import { ExportSlot } from "./ExportSlot";
import { formatLabel } from "./nodeMeta";
import { saveStatusLabel, useScreenplayDoc } from "./useScreenplayDoc";
import { firstEpisodeId, getDoctor, requestMicroContinue, type DoctorNote } from "@/lib/api/assist";
import { addComment, listComments } from "@/lib/api/collab";
import { Button } from "@/components/ui/button";
import "./screenplay.css";

export function ScreenplayView() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const { format, nodes, status, error, ready, setNodes, doc, episodeId } = useScreenplayDoc(projectId);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [notes, setNotes] = useState<DoctorNote[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [comments, setComments] = useState<Array<{ id: string; body: string; user: { email: string } }>>([]);
  const [commentDraft, setCommentDraft] = useState("");

  const active = nodes.find((node) => node.id === activeNodeId);
  const emptyActive = !!active && !active.text.trim();

  useEffect(() => {
    setSuggestion(null);
    if (!projectId || !emptyActive || !activeNodeId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSuggesting(true);
        try {
          const eid = episodeId || (await firstEpisodeId(projectId));
          const result = await requestMicroContinue(
            projectId,
            eid,
            activeNodeId,
            nodes.map((node) => ({ id: node.id, text: node.text }))
          );
          if (!cancelled) setSuggestion(result.suggestion);
        } catch {
          if (!cancelled) setSuggestion(null);
        } finally {
          if (!cancelled) setSuggesting(false);
        }
      })();
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeNodeId, emptyActive, episodeId, projectId]);

  useEffect(() => {
    if (!projectId || !activeNodeId) {
      setComments([]);
      return;
    }
    void listComments(projectId, { anchorType: "screenplay", anchorId: activeNodeId }).then((doc) => {
      setComments(doc.comments);
    });
  }, [projectId, activeNodeId]);

  const runDoctor = async () => {
    if (!projectId) return;
    try {
      const eid = episodeId || (await firstEpisodeId(projectId));
      const result = await getDoctor(projectId, eid);
      setNotes(result.notes);
    } catch {
      setNotes([{ id: "err", priority: "med", area: "theme", title: "诊断失败", body: "稍后再试" }]);
    }
  };

  const submitComment = async () => {
    if (!projectId || !activeNodeId || !commentDraft.trim()) return;
    await addComment(projectId, {
      anchorType: "screenplay",
      anchorId: activeNodeId,
      body: commentDraft.trim(),
      episodeId: episodeId ?? undefined,
    });
    setCommentDraft("");
    const doc = await listComments(projectId, { anchorType: "screenplay", anchorId: activeNodeId });
    setComments(doc.comments);
  };

  const acceptSuggestion = () => {
    if (!activeNodeId || !suggestion) return;
    setNodes(
      nodes.map((node) => (node.id === activeNodeId ? { ...node, text: suggestion } : node))
    );
    setSuggestion(null);
  };

  if (!ready && status === "loading") {
    return (
      <div className="sp-workspace">
        <div className="sp-loading">正在打开剧本…</div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="sp-workspace">
        <div className="sp-error">{error ?? "无法加载剧本"}</div>
      </div>
    );
  }

  return (
    <div className={`sp-workspace sp-format-${format}`}>
      <header className="sp-toolbar">
        <div className="sp-toolbar-title">
          <h1>剧本</h1>
          <span className="sp-toolbar-meta">{formatLabel(format)}</span>
          <span className="sp-hint">Enter 新行 · Tab 切换类型 · Backspace 删空行</span>
        </div>
        <div className="sp-toolbar-actions">
          <span className="sp-save-status">{saveStatusLabel(status)}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void runDoctor()}>
            剧本医生
          </Button>
          <ExportSlot doc={doc} />
        </div>
      </header>
      {notes ? (
        <aside className="px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)] text-sm">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="font-medium">诊断（只读，不改稿）</p>
            <button type="button" className="text-xs text-[var(--at-text-tertiary)]" onClick={() => setNotes(null)}>
              关闭
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="text-[var(--at-text-secondary)]">这一集暂时没有优先笔记。</p>
          ) : (
            <ul className="space-y-1.5">
              {notes.map((note) => (
                <li key={note.id}>
                  <span className="text-[11px] mr-2 text-[var(--at-accent)]">{note.area}</span>
                  {note.title}
                  {note.body ? <span className="text-[var(--at-text-tertiary)]"> · {note.body}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </aside>
      ) : null}
      {emptyActive && (suggesting || suggestion) ? (
        <div className="px-5 py-2 border-b border-[var(--at-border)] text-sm flex items-center gap-3">
          <span className="text-[var(--at-text-secondary)]">
            {suggesting ? "微续写…" : suggestion}
          </span>
          {suggestion ? (
            <Button type="button" size="sm" variant="accent" onClick={acceptSuggestion}>
              采纳
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="sp-body">
        <div className="sp-stage">
          <div className="sp-paper">
            <ScreenplayEditor
              nodes={nodes}
              format={format}
              onChange={setNodes}
              activeNodeId={activeNodeId}
              onActiveNodeIdChange={setActiveNodeId}
            />
          </div>
        </div>
        <PageTimeline nodes={nodes} activeNodeId={activeNodeId} />
      </div>
      {activeNodeId && projectId ? (
        <aside className="px-5 py-3 border-t border-[var(--at-border)] bg-[var(--at-surface)]">
          <p className="text-xs font-medium mb-2">本段评论</p>
          <ul className="space-y-1 mb-2">
            {comments.map((item) => (
              <li key={item.id} className="text-xs">
                <span style={{ color: "#78716c" }}>{item.user.email}：</span>
                {item.body}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              aria-label="节点评论"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitComment();
                }
              }}
              className="flex-1 rounded-md border px-2 py-1 text-xs"
              placeholder="Viewer 可评不可改稿"
            />
            <Button type="button" size="sm" onClick={() => void submitComment()}>
              发表评论
            </Button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
