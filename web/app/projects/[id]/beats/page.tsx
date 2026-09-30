"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  BEAT_FLUSH_EVENT,
  BEAT_REVISED_EVENT,
  BEAT_SCOPE_REQUEST_EVENT,
  dispatchBeatScope,
  type BeatRevisedDetail,
  type FlushDetail,
} from "@/components/planning/scope";

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
  const [activeBeatId, setActiveBeatId] = useState<string | null>(null);
  const beatsRef = useRef(beats);
  const episodeIdRef = useRef(episodeId);
  const savingRef = useRef(saving);
  const activeBeatIdRef = useRef(activeBeatId);

  useEffect(() => {
    beatsRef.current = beats;
  }, [beats]);
  useEffect(() => {
    episodeIdRef.current = episodeId;
  }, [episodeId]);
  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);
  useEffect(() => {
    activeBeatIdRef.current = activeBeatId;
  }, [activeBeatId]);

  const loadCoverage = useCallback(
    async (eid: string, current: Beat[]) => {
      const covered = await getBeatCoverage(projectId, eid);
      const byId = new Map(covered.beats.map((row) => [row.id, row.covered]));
      return current.map((beat) => ({
        ...beat,
        covered: beat.id ? Boolean(byId.get(beat.id)) : false,
      }));
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
        setBeats(await loadCoverage(eid, doc.beats));
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
  }, [loadCoverage, projectId, showToast]);

  const persist = async () => {
    if (!episodeId || saving) return;
    setSaving(true);
    try {
      const saved = await putBeats(
        projectId,
        episodeId,
        beats.map((beat) => ({
          id: beat.id,
          action: beat.action,
          intent: beat.intent,
          outcome: beat.outcome,
        }))
      );
      setBeats(await loadCoverage(episodeId, saved.beats));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存 Beats 失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const focusBeat = useCallback((beatId: string | undefined) => {
    const id = beatId ?? null;
    setActiveBeatId(id);
    dispatchBeatScope(id);
  }, []);

  useEffect(() => {
    const onRequest = () => {
      dispatchBeatScope(activeBeatIdRef.current);
    };
    const onRevised = (event: Event) => {
      const detail = (event as CustomEvent<BeatRevisedDetail>).detail;
      if (!detail || !Array.isArray(detail.beats)) return;
      const eid = episodeIdRef.current;
      if (!eid) {
        setBeats(detail.beats);
        return;
      }
      void loadCoverage(eid, detail.beats)
        .then(setBeats)
        .catch(() => setBeats(detail.beats));
    };
    const onFlush = (event: Event) => {
      const detail = (event as CustomEvent<FlushDetail>).detail;
      const done = detail?.done;
      void (async () => {
        try {
          const eid = episodeIdRef.current;
          if (eid && !savingRef.current) {
            setSaving(true);
            try {
              const saved = await putBeats(
                projectId,
                eid,
                beatsRef.current.map((beat) => ({
                  id: beat.id,
                  action: beat.action,
                  intent: beat.intent,
                  outcome: beat.outcome,
                }))
              );
              setBeats(await loadCoverage(eid, saved.beats));
            } finally {
              setSaving(false);
            }
          }
        } catch (err) {
          showToast(err instanceof Error ? err.message : "保存 Beats 失败", "error");
        } finally {
          done?.();
        }
      })();
    };
    window.addEventListener(BEAT_SCOPE_REQUEST_EVENT, onRequest);
    window.addEventListener(BEAT_REVISED_EVENT, onRevised);
    window.addEventListener(BEAT_FLUSH_EVENT, onFlush);
    return () => {
      window.removeEventListener(BEAT_SCOPE_REQUEST_EVENT, onRequest);
      window.removeEventListener(BEAT_REVISED_EVENT, onRevised);
      window.removeEventListener(BEAT_FLUSH_EVENT, onFlush);
    };
  }, [loadCoverage, projectId, showToast]);

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-4 py-2 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="m-0 text-base font-semibold tracking-wide">Beats</h1>
          <span className="text-xs text-[var(--at-text-tertiary)]">动作 / 意图 / 结果，对照正文看是否兑现</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => setBeats((prev) => [...prev, emptyBeat()])}
          >
            <Plus className="w-3.5 h-3.5" />
            添加 Beat
          </Button>
          <Button type="button" size="sm" variant="accent" disabled={loading || saving} onClick={() => void persist()}>
            {saving ? "保存中…" : "保存 Beats"}
          </Button>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-4 py-4">
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
          <ol className="max-w-3xl mx-auto space-y-3">
            {beats.map((beat, index) => (
              <li key={beat.id ?? `new-${index}`} className="rounded-lg border border-[var(--at-border)] bg-[var(--at-surface)] p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-xs font-medium text-[var(--at-text-secondary)]">Beat {index + 1}</p>
                  <div className="flex items-center gap-2">
                    {beat.id ? (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          color: "var(--at-text-secondary)",
                          background: "var(--at-surface-sunken)",
                        }}
                      >
                        {beat.covered ? "已兑现" : "未兑现"}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`删除 Beat ${index + 1}`}
                      title={`删除 Beat ${index + 1}`}
                      className="text-[var(--at-text-tertiary)] hover:text-[var(--at-error)]"
                      onClick={() => setBeats((prev) => prev.filter((_, i) => i !== index))}
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
                      onFocus={() => focusBeat(beat.id)}
                      onChange={(e) =>
                        setBeats((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, [field]: e.target.value } : row))
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--at-accent)]"
                    />
                  </label>
                ))}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
