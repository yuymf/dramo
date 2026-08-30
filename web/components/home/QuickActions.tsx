"use client";

import { useState } from "react";
import { createProject } from "@/lib/api/projects";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Film, Megaphone, Video, Clapperboard } from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  type?: string;
  icon: typeof Film;
}

const quickActions: QuickAction[] = [
  { id: "short_drama", label: "短片剧本", type: "short_drama", icon: Film },
  { id: "ad_copy", label: "广告文案", type: "ad_copy", icon: Megaphone },
  { id: "short_video", label: "短视频", type: "short_video", icon: Video },
  { id: "film", label: "电影剧本", type: "film", icon: Clapperboard },
];

interface QuickActionsProps {
  onActionClick?: (action: QuickAction) => void;
}

export function QuickActions({ onActionClick }: QuickActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const handleClick = async (action: QuickAction) => {
    if (onActionClick) {
      onActionClick(action);
      return;
    }

    setLoading(action.id);
    try {
      const project = await createProject(action.label);
      router.push(`/projects/${project.id}/scripts`);
      showToast(`已创建${action.label}项目`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "创建项目失败", "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-3 justify-center mt-10 ink-reveal ink-reveal-3">
      {quickActions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={() => handleClick(action)}
            disabled={loading !== null}
            className="ink-chip ink-ui"
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            {loading === action.id ? "创建中..." : action.label}
          </button>
        );
      })}
    </div>
  );
}
