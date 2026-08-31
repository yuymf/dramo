"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { getAdvisor, putAdvisor, type Advisor } from "@/lib/api/assist";

export default function AdvisorsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { showToast } = useToast();
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [hired, setHired] = useState<Advisor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function load() {
      try {
        const doc = await getAdvisor(projectId);
        if (cancelled) return;
        setAdvisors(doc.advisors);
        setHired(doc.hired);
      } catch (err) {
        if (!cancelled) showToast(err instanceof Error ? err.message : "加载顾问失败", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, showToast]);

  const hire = async (id: string | null) => {
    try {
      const doc = await putAdvisor(projectId, id);
      setHired(doc.hired);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "更新顾问失败", "error");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="m-0 text-[15px] font-semibold tracking-wide">顾问</h1>
          <span className="text-xs text-[var(--at-text-tertiary)]">项目至多雇一个内置方法论，顾问不能自己雇自己</span>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-[var(--at-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <ul className="max-w-3xl mx-auto space-y-3">
            {advisors.map((item) => {
              const active = hired?.id === item.id;
              return (
                <li key={item.id} className="rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">{item.name}</h2>
                      <p className="mt-1 text-sm text-[var(--at-text-secondary)]">{item.summary}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? "outline" : "accent"}
                      onClick={() => void hire(active ? null : item.id)}
                    >
                      {active ? "解聘" : "雇用"}
                    </Button>
                  </div>
                  {active ? (
                    <p className="mt-3 text-[11px] text-[var(--at-accent)]">当前顾问</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
