"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { listProjectAssets } from "@/lib/api/preproduction";

export default function AssetsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Array<{ id: string; kind: string; url: string }>>([]);
  const [tasks, setTasks] = useState<
    Array<{ id: string; kind: string; status: string; prompt: string; resultUrl: string | null }>
  >([]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function load() {
      try {
        const doc = await listProjectAssets(projectId);
        if (cancelled) return;
        setAssets(doc.assets);
        setTasks(doc.tasks);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <h1 className="m-0 text-[15px] font-semibold tracking-wide">资产</h1>
        <p className="text-xs text-[var(--at-text-tertiary)]">任务和可回写的输出分开，刷新不会自动再派单</p>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            <section>
              <h2 className="text-sm font-semibold mb-2">任务</h2>
              {tasks.length === 0 ? (
                <p className="text-sm text-[var(--at-text-secondary)]">还没有出图任务。</p>
              ) : (
                <ul className="space-y-2">
                  {tasks.map((task) => (
                    <li key={task.id} className="rounded-lg border border-[var(--at-border)] px-3 py-2 text-sm">
                      {task.kind} · {task.status} · {task.prompt}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="text-sm font-semibold mb-2">资产库</h2>
              {assets.length === 0 ? (
                <p className="text-sm text-[var(--at-text-secondary)]">还没有资产。</p>
              ) : (
                <ul className="grid grid-cols-3 gap-2">
                  {assets.map((asset) => (
                    <li key={asset.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.url} alt={asset.kind} className="h-24 w-full object-cover rounded-lg" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
