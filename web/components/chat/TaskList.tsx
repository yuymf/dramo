"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import type { PipelineTask, PipelineTaskStatus } from "@/lib/types/chat";

const STATUS_ICONS: Record<PipelineTaskStatus, string> = {
  pending: '○',
  in_progress: '🔄',
  completed: '✅',
  paused: '⏸',
  failed: '❌',
  skipped: '⏭',
};

interface TaskListProps {
  onTaskClick?: (step: string) => void;
}

export function TaskList({ onTaskClick }: TaskListProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { tasks, pipelineStatus } = usePipelineStore();

  if (tasks.length === 0 || pipelineStatus === 'idle') {
    return null;
  }

  return (
    <div className="border-b border-stone-200/50 bg-stone-50/50">
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-stone-600 hover:bg-stone-100/50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span>📋</span>
          <span>任务列表</span>
        </div>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 space-y-1">
          {tasks.map((task: PipelineTask) => (
            <button
              key={task.id}
              onClick={() => onTaskClick?.(task.step)}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left",
                task.status === 'in_progress'
                  ? "bg-orange-50 text-orange-700 font-medium"
                  : task.status === 'completed'
                  ? "text-stone-500"
                  : task.status === 'failed'
                  ? "text-red-500"
                  : "text-stone-400",
                "hover:bg-stone-100/50"
              )}
            >
              <span className="shrink-0">{STATUS_ICONS[task.status]}</span>
              <span>{task.label}</span>
              {task.status === 'in_progress' && (
                <span className="ml-auto text-[10px] text-orange-500">← 当前</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
