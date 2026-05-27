"use client";

import { Square } from "lucide-react";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { cn } from "@/lib/utils";

export function StopButton() {
  const { pipelineStatus, abortController } = usePipelineStore();
  const isRunning = pipelineStatus === 'running';

  if (!isRunning) return null;

  const handleStop = () => {
    abortController?.abort();
    usePipelineStore.getState().setPipelineStatus('paused');
  };

  return (
    <button
      onClick={handleStop}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
        "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
      )}
    >
      <Square size={12} fill="currentColor" />
      停止生成
    </button>
  );
}
