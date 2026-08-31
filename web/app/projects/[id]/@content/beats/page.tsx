"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import {
  firstEpisodeId,
  getBeatCoverage,
  getBeats,
  putBeats,
  type Beat,
} from "@/lib/api/planning";

function emptyBeat(): Beat {
  return { action: "", intent: "", outcome: "" };
}

export default function BeatsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { showToast } = useToast();
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refreshCoverage = useCallback(
    async (eid: string, current: Beat[]) => {
      try {
        const covered = await getBeatCoverage(projectId, eid);
        const byId = new Map(covered.beats.map((row) => [row.id, row.covered]));
        setBeats(
          current.map((beat) => ({
            ...beat,
            covered: beat.id ? byId.get(beat.id) : false,
          }))
        );
      } catch {
        setBeats(current);
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const eid = await firstEpisodeId(projectId);
        const doc = await getBeats(projectId, eid);
        if (cancelled) return;
        setEpisodeId(eid);
        await refreshCoverage(eid, doc.beats);
      } catch (err) {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : "加载 Beats 失败", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshCoverage, showToast]);

  const persist = useCallback(
    async (next: Beat[]) => {
      if (!episodeId || saving) return;
      setSaving(true);
      try {
        const saved = await putBeats(
          projectId,
          episodeId,
          next.map((beat) => ({
            id: beat.id,
            action: beat.action,
            intent: beat.intent,
            outcome: beat.outcome,
          }))
        );
        await refreshCoverage(episodeId, saved.beats);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "保存 Beats 失败", "error");
      } finally {
        setSaving(false);
      }
    },
    [episodeId, projectId, refreshCoverage, saving, showToast]
  );

  const updateField = (index: number, field: keyof Beat, value: string) => {
    setBeats((prev) => prev.map((beat, i) => (i === index ? { ...beat, [field]: value } : beat)));
  };

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="m-0 text-[15px] font-semibold tracking-wide">Beats</h1>
          <span className="text-xs text-[var(--at-text-tertiary)]">动作 / 意图 / 结果，对照正文看是否兑现</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="accent"
          onClick={() => setBeats((prev) => [...prev, emptyBeat()])}
        >
          <Plus className="w-3.5 h-3.5" />
          添加 Beat
        </Button>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-[var(--at-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : beats.length === 0 ? (
          <p className="max-w-md mx-auto text-center text-sm text-[var(--at-text-secondary)] py-20">
            还没有 Beat。先写下本集要发生的戏剧变化。
          </p>
        ) : (
          <ol className="max-w-3xl mx-auto space-y-4">
            {beats.map((beat, index) => (
              <li key={beat.id ?? `new-${index}`} className="rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-xs font-medium text-[var(--at-text-secondary)]">Beat {index + 1}</p>
                  <div className="flex items-center gap-2">
                    {beat.id ? (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          color: beat.covered ? "#166534" : "#9a3412",
                          background: beat.covered ? "#dcfce7" : "#ffedd5",
                        }}
                      >
                        {beat.covered ? "已兑现" : "未兑现"}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`删除 Beat ${index + 1}`}
                      className="text-[var(--at-text-tertiary)] hover:text-[var(--at-error)]"
                      onClick={() => {
                        const next = beats.filter((_, i) => i !== index);
                        setBeats(next);
                        void persist(next);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {(
                  [
                    ["action", "动作", "发生了什么"],
                    ["intent", "意图", "人物想要什么"],
                    ["outcome", "结果", "局面变成什么"],
                  ] as const
                ).map(([field, label, placeholder]) => (
                  <label key={field} className="block mt-2">
                    <span className="text-xs text-[var(--at-text-secondary)]">{label}</span>
                    <input
                      aria-label={`${label} ${index + 1}`}
                      value={beat[field] ?? ""}
                      placeholder={placeholder}
                      onChange={(e) => updateField(index, field, e.target.value)}
                      onBlur={() => void persist(beats)}
                      className="mt-1 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--at-accent)]"
                    />
                  </label>
                ))}
              </li>
            ))}
          </ol>
        )}
        {saving ? (
          <p className="max-w-3xl mx-auto mt-3 text-[11px] text-[var(--at-text-tertiary)]">保存中…</p>
        ) : null}
      </div>
    </div>
  );
}
