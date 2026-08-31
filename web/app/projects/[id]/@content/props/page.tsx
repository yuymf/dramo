"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { listProps, patchProp, type PropRecord } from "@/lib/api/planning";

export default function PropsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { showToast } = useToast();
  const [props, setProps] = useState<PropRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    try {
      setProps(await listProps(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载道具失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="m-0 text-[15px] font-semibold tracking-wide">道具</h1>
          <span className="text-xs text-[var(--at-text-tertiary)]">正文里的 #道具名 会推导到这里</span>
        </div>
        <span className="text-xs font-medium text-[var(--at-accent)] bg-[var(--at-accent-light)] px-2 py-0.5 rounded-full">
          {props.length}
        </span>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-[var(--at-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : error ? (
          <div className="max-w-xl mx-auto text-center py-16">
            <p className="text-sm text-[var(--at-error)]">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
              重试
            </Button>
          </div>
        ) : props.length === 0 ? (
          <p className="max-w-md mx-auto text-center text-sm text-[var(--at-text-secondary)] py-20">
            去剧本页或 Reel 表演写下 #道具名 后回到这里
          </p>
        ) : (
          <ul className="max-w-3xl mx-auto space-y-4">
            {props.map((item) => (
              <li key={item.id}>
                <PropCard
                  item={item}
                  projectId={projectId}
                  onPatched={(next) =>
                    setProps((prev) => prev.map((row) => (row.id === next.id ? next : row)))
                  }
                  showToast={showToast}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PropCard({
  item,
  projectId,
  onPatched,
  showToast,
}: {
  item: PropRecord;
  projectId: string;
  onPatched: (next: PropRecord) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [description, setDescription] = useState(item.description ?? "");
  const [holder, setHolder] = useState(item.holder ?? "");
  const [continuity, setContinuity] = useState(item.continuity ?? "");

  const persist = async (field: "description" | "holder" | "continuity", value: string) => {
    const current = item[field] ?? "";
    if (value === current) return;
    try {
      const next = await patchProp(projectId, item.id, { [field]: value });
      onPatched(next);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存道具失败", "error");
    }
  };

  return (
    <article className="rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] p-5">
      <h2 className="text-base font-semibold truncate">{item.name}</h2>
      {(
        [
          ["description", "描述", description, setDescription],
          ["holder", "持有者", holder, setHolder],
          ["continuity", "连贯要求", continuity, setContinuity],
        ] as const
      ).map(([field, label, value, setter]) => (
        <label key={field} className="block mt-3">
          <span className="text-xs text-[var(--at-text-secondary)]">{label}</span>
          <input
            aria-label={`${item.name}${label}`}
            value={value}
            onChange={(e) => setter(e.target.value)}
            onBlur={() => void persist(field, value)}
            className="mt-1 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--at-accent)]"
          />
        </label>
      ))}
    </article>
  );
}
