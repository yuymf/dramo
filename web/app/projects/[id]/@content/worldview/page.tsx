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

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const doc = await getWorldview(projectId);
      setRules(doc.rules);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "加载世界观失败", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await putWorldview(projectId, rules);
      setRules(saved.rules);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存世界观失败", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="m-0 text-[15px] font-semibold tracking-wide">世界观</h1>
          <span className="text-xs text-[var(--at-text-tertiary)]">扁平规则，AI 未获授权不得改</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => setRules((prev) => [...prev, { key: "", value: "" }])}
          >
            <Plus className="w-3.5 h-3.5" />
            添加规则
          </Button>
          <Button type="button" size="sm" variant="accent" disabled={loading || saving} onClick={() => void persist()}>
            {saving ? "保存中…" : "保存世界观"}
          </Button>
        </div>
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
                key={`rule-${index}`}
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
                  className="flex-1 rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--at-accent)]"
                />
                <button
                  type="button"
                  aria-label={`删除规则 ${index + 1}`}
                  className="text-[var(--at-text-tertiary)] hover:text-[var(--at-error)]"
                  onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
