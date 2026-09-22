"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { createKnowledge, deleteKnowledge, listKnowledge, type KnowledgeFile } from "@/lib/api/assist";

export default function KnowledgePage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { showToast } = useToast();
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("note.txt");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setFiles(await listKnowledge(projectId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "加载知识库失败", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".txt") && !lower.endsWith(".md") && !lower.endsWith(".markdown")) {
      showToast("PDF / DOCX 请先复制正文，或上传 TXT / Markdown", "info");
    }
    setFilename(file.name);
    if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ""));
    setText(await file.text());
  };

  const save = async () => {
    if (saving) return;
    const title = name.trim() || filename;
    if (!text.trim()) {
      showToast("正文不能为空", "error");
      return;
    }
    setSaving(true);
    try {
      const created = await createKnowledge(projectId, { name: title, filename, text });
      setFiles((prev) => [created, ...prev]);
      setName("");
      setText("");
      setFilename("note.txt");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存资料失败", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="m-0 text-[15px] font-semibold tracking-wide">知识库</h1>
          <span className="text-xs text-[var(--at-text-tertiary)]">AI 先看目录再按需读，不整库注入</span>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <section className="rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] p-5 space-y-3">
            <input
              aria-label="资料名称"
              value={name}
              placeholder="资料名称"
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm"
            />
            <input
              aria-label="上传文本文件"
              type="file"
              accept=".txt,.md,.markdown,.pdf,.docx,text/plain,text/markdown"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
            <textarea
              aria-label="资料正文"
              value={text}
              rows={8}
              placeholder="粘贴 TXT / Markdown，或从 PDF / DOCX 复制的正文"
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm"
            />
            <Button type="button" size="sm" variant="accent" disabled={saving} onClick={() => void save()}>
              {saving ? "保存中…" : "加入知识库"}
            </Button>
          </section>
          {loading ? (
            <div className="flex items-center justify-center h-24 gap-2 text-sm text-[var(--at-text-secondary)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载中…
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-[var(--at-text-secondary)] text-center py-10">还没有资料。</p>
          ) : (
            <ul className="space-y-3">
              {files.map((file) => (
                <li key={file.id} className="rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">{file.name}</h2>
                      <p className="text-[11px] text-[var(--at-text-tertiary)]">{file.filename}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`删除 ${file.name}`}
                      onClick={async () => {
                        await deleteKnowledge(projectId, file.id);
                        setFiles((prev) => prev.filter((row) => row.id !== file.id));
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[var(--at-text-tertiary)]" />
                    </button>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap text-[var(--at-text-secondary)] line-clamp-6">
                    {file.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
