"use client";

import { Loader2 } from "lucide-react";
import type { PipelineStep } from "@/lib/types/chat";

const STEP_LABELS: Record<PipelineStep, string> = {
  clarification: '分析需求',
  script: '生成台本',
  characters: '提取角色',
  locations: '提取场景',
  storyboard: '生成分镜',
};

interface ProgressMessageProps {
  step: PipelineStep;
  detail?: string;
}

export function ProgressMessage({ step, detail }: ProgressMessageProps) {
  return (
    <div className="flex items-start gap-2 text-sm text-stone-500">
      <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5 text-orange-500" />
      <div>
        <span className="font-medium text-stone-700">
          {STEP_LABELS[step]}中...
        </span>
        {detail && (
          <p className="text-xs text-stone-400 mt-0.5">{detail}</p>
        )}
      </div>
    </div>
  );
}
