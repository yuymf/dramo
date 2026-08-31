"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { listProjectAssets } from "@/lib/api/preproduction";

export default function TasksPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const [loading, setLoading] = useState(true);
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
        <h1 className="m-0 text-[15px] font-semibold tracking-wide">任务</h1>
        <p className="text-xs text-[var(--at-text-tertiary)]">分镜图走 SD 池，成片走独立视频编码器</p>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-[var(--at-text-secondary)] max-w-md mx-auto text-center py-16">
            还没有任务。在 Reel 里生成分镜图或成片后会出现在这里。
          </p>
        ) : (
          <ul className="max-w-3xl mx-auto space-y-2">
            {tasks.map((task) => (
              <li key={task.id} className="rounded-lg border border-[var(--at-border)] px-3 py-2 text-sm">
                {task.kind} · {task.status} · {task.prompt}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
