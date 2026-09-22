"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { firstEpisodeId, getColdStart, putColdStart, type ColdStartDoc } from "@/lib/api/assist";

const GATES = [
  { id: 1, title: "前提", hint: "人物、欲望、阻力、代价、格式" },
  { id: 2, title: "结构", hint: "大纲因果与结局承诺" },
  { id: 3, title: "Beat", hint: "反转与加压" },
  { id: 4, title: "实体", hint: "去重、关系、地点" },
  { id: 5, title: "开写", hint: "一次只写一小撮场次" },
] as const;

const EMPTY: ColdStartDoc = {
  gate: 1,
  premise: { character: "", desire: "", obstacle: "", cost: "", format: "" },
  structure: { causality: "", ending: "" },
  beatsNote: "",
  entitiesNote: "",
  writingNote: "",
};

export default function ColdStartPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { showToast } = useToast();
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [doc, setDoc] = useState<ColdStartDoc>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function load() {
      try {
        const eid = await firstEpisodeId(projectId);
        const next = await getColdStart(projectId, eid);
        if (cancelled) return;
        setEpisodeId(eid);
        setDoc(next);
      } catch (err) {
        if (!cancelled) showToast(err instanceof Error ? err.message : "加载冷启动失败", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, showToast]);

  const persist = async (next: ColdStartDoc) => {
    if (!episodeId || saving) return;
    setSaving(true);
    try {
      setDoc(await putColdStart(projectId, episodeId, next));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存冷启动失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const gate = doc.gate;

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <h1 className="m-0 text-[15px] font-semibold tracking-wide">冷启动</h1>
        <p className="mt-1 text-xs text-[var(--at-text-tertiary)]">五关可停可回退，不跳进生成完整台本</p>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-[var(--at-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            <ol className="flex flex-wrap gap-2">
              {GATES.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-full text-xs"
                    style={{
                      background: gate === item.id ? "rgba(194,65,12,0.12)" : "#f5f5f4",
                      color: gate === item.id ? "#c2410c" : "#78716c",
                      fontWeight: gate === item.id ? 600 : 400,
                    }}
                    onClick={() => setDoc((prev) => ({ ...prev, gate: item.id }))}
                  >
                    {item.id}. {item.title}
                  </button>
                </li>
              ))}
            </ol>
            <p className="text-sm text-[var(--at-text-secondary)]">{GATES[gate - 1]?.hint}</p>
            {gate === 1 ? (
              <div className="space-y-2">
                {(
                  [
                    ["character", "人物"],
                    ["desire", "欲望"],
                    ["obstacle", "阻力"],
                    ["cost", "代价"],
                    ["format", "格式"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="text-xs text-[var(--at-text-secondary)]">{label}</span>
                    <input
                      aria-label={label}
                      value={doc.premise[field]}
                      onChange={(e) =>
                        setDoc((prev) => ({
                          ...prev,
                          premise: { ...prev.premise, [field]: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>
            ) : null}
            {gate === 2 ? (
              <div className="space-y-2">
                <label className="block">
                  <span className="text-xs">因果</span>
                  <textarea
                    aria-label="因果"
                    rows={4}
                    value={doc.structure.causality}
                    onChange={(e) =>
                      setDoc((prev) => ({
                        ...prev,
                        structure: { ...prev.structure, causality: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs">结局承诺</span>
                  <textarea
                    aria-label="结局承诺"
                    rows={3}
                    value={doc.structure.ending}
                    onChange={(e) =>
                      setDoc((prev) => ({
                        ...prev,
                        structure: { ...prev.structure, ending: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm"
                  />
                </label>
              </div>
            ) : null}
            {gate === 3 ? (
              <textarea
                aria-label="Beat 笔记"
                rows={6}
                value={doc.beatsNote}
                onChange={(e) => setDoc((prev) => ({ ...prev, beatsNote: e.target.value }))}
                className="w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm"
              />
            ) : null}
            {gate === 4 ? (
              <textarea
                aria-label="实体笔记"
                rows={6}
                value={doc.entitiesNote}
                onChange={(e) => setDoc((prev) => ({ ...prev, entitiesNote: e.target.value }))}
                className="w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm"
              />
            ) : null}
            {gate === 5 ? (
              <textarea
                aria-label="开写笔记"
                rows={6}
                value={doc.writingNote}
                onChange={(e) => setDoc((prev) => ({ ...prev, writingNote: e.target.value }))}
                className="w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm"
              />
            ) : null}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={gate <= 1}
                onClick={() => setDoc((prev) => ({ ...prev, gate: Math.max(1, prev.gate - 1) }))}
              >
                上一关
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={gate >= 5}
                onClick={() => setDoc((prev) => ({ ...prev, gate: Math.min(5, prev.gate + 1) }))}
              >
                下一关
              </Button>
              <Button type="button" variant="accent" size="sm" disabled={saving} onClick={() => void persist(doc)}>
                {saving ? "保存中…" : "保存进度"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
