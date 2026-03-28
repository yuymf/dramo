/**
 * Script Version History - Display and manage script version history
 */
"use client";

import { useState, useEffect } from "react";
import { History, RotateCcw, Loader2, Clock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { ScriptVersion } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface ScriptVersionHistoryProps {
  projectId: string;
  onRevert?: () => void;
}

export function ScriptVersionHistory({
  projectId,
  onRevert,
}: ScriptVersionHistoryProps) {
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    async function loadVersions() {
      if (!projectId) return;

      try {
        const res = await api<{ data: ScriptVersion[] }>(
          `/api/projects/${projectId}/script/versions`
        );
        setVersions(res.data);
      } catch (err) {
        console.error("Failed to load version history:", err);
        showToast((err as Error).message, "error");
      } finally {
        setLoading(false);
      }
    }

    loadVersions();
  }, [projectId, showToast]);

  const handleRevert = async (versionId: string) => {
    if (!confirm("确定要回滚到此版本吗？当前未保存的修改将丢失。")) {
      return;
    }

    setRevertingId(versionId);

    try {
      await api(
        `/api/projects/${projectId}/script/versions/${versionId}/revert`,
        {
          method: "POST",
        }
      );

      showToast("已回滚到选定版本", "success");
      onRevert?.();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setRevertingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center text-slate-400 italic text-sm py-8">
        <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
        <p>暂无历史版本</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-[var(--brand-500)]" />
        <h2 className="text-lg font-semibold jp-serif">版本历史</h2>
        <span className="text-xs text-slate-500">共 {versions.length} 个版本</span>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {versions.map((version, index) => (
            <div
              key={version.id}
              className={cn(
                "p-3 border rounded-lg transition-all",
                index === 0
                  ? "border-[var(--brand-300)] bg-[var(--brand-50)]"
                  : "border-slate-200 bg-white hover:shadow-sm"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {index === 0 && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-[var(--brand-500)] text-white rounded">
                        当前版本
                      </span>
                    )}
                    <h3 className="font-medium text-sm jp-serif">
                      版本 {versions.length - index}
                    </h3>
                  </div>

                  {version.summary && (
                    <p className="text-sm text-slate-600 mb-2">{version.summary}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(version.createdAt).toLocaleString("zh-CN")}
                    </div>
                    {version.author && (
                      <div className="flex items-center gap-1">
                        <span>作者：{version.author}</span>
                      </div>
                    )}
                  </div>
                </div>

                {index !== 0 && (
                  <Button
                    onClick={() => handleRevert(version.id)}
                    disabled={revertingId === version.id}
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                  >
                    {revertingId === version.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4 mr-1" />
                        回滚
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

