"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { getWorldview, putWorldview, type WorldviewRule } from "@/lib/api/planning";

export default function WorldviewPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { showToast } = useToast();
  const [rules, setRules] = useState<WorldviewRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const doc = await getWorldview(projectId);
        if (!cancelled) setRules(doc.rules);
      } catch (err) {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : "加载世界观失败", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, showToast]);

  const persist = useCallback(
    async (next: WorldviewRule[]) => {
      if (saving) return;
      setSaving(true);
      try {
        const saved = await putWorldview(projectId, next);
        setRules(saved.rules);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "保存世界观失败", "error");
      } finally {
        setSaving(false);
      }
    },
    [projectId, saving, showToast]
  );

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="m-0 text-[15px] font-semibold tracking-wide">世界观</h1>
          <span className="text-xs text-[var(--at-text-tertiary)]">扁平规则，AI 未获授权不得改</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="accent"
          onClick={() => setRules((prev) => [...prev, { key: "", value: "" }])}
        >
          <Plus className="w-3.5 h-3.5" />
          添加规则
        </Button>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-[var(--at-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : rules.length === 0 ? (
          <p className="max-w-md mx-auto text-center text-sm text-[var(--at-text-secondary)] py-20">
            还没有规则。写下这个世界不能被改写的前提。
          </p>
        ) : (
          <ul className="max-w-3xl mx-auto space-y-3">
            {rules.map((rule, index) => (
              <li
                key={`${rule.key}-${index}`}
                className="rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] p-4 flex gap-3"
              >
                <input
                  aria-label={`规则名 ${index + 1}`}
                  value={rule.key}
                  placeholder="规则名"
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, key: e.target.value } : row))
                    )
                  }
                  onBlur={() => void persist(rules)}
                  className="w-36 shrink-0 rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--at-accent)]"
                />
                <input
                  aria-label={`规则内容 ${index + 1}`}
                  value={rule.value}
                  placeholder="规则内容"
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, value: e.target.value } : row))
                    )
                  }
                  onBlur={() => void persist(rules)}
                  className="flex-1 rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--at-accent)]"
                />
                <button
                  type="button"
                  aria-label={`删除规则 ${index + 1}`}
                  className="text-[var(--at-text-tertiary)] hover:text-[var(--at-error)]"
                  onClick={() => {
                    const next = rules.filter((_, i) => i !== index);
                    setRules(next);
                    void persist(next);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {saving ? (
          <p className="max-w-3xl mx-auto mt-3 text-[11px] text-[var(--at-text-tertiary)]">保存中…</p>
        ) : null}
      </div>
    </div>
  );
}
