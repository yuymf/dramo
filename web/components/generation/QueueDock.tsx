/**
 * QueueDock - 固定在右下角的队列入口
 */
"use client";

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useGenerationJobs } from '@/lib/hooks/useGenerationJobs';
import { QueueDrawer } from './QueueDrawer';
import { cn } from '@/lib/utils';

export function QueueDock() {
  const { activeCount } = useGenerationJobs();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 仅在有进行中的任务时显示 Dock
  if (activeCount === 0) {
    return null;
  }

  return (
    <>
      {/* Dock Button */}
      <button
        onClick={() => setDrawerOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40",
          "bg-gradient-to-r from-orange-400 to-pink-500",
          "text-white rounded-full shadow-lg",
          "p-4 flex items-center gap-3",
          "hover:shadow-xl transition-all duration-200",
          "hover:scale-105"
        )}
        aria-label="打开生成队列"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="font-medium">生成中</span>
        {activeCount > 0 && (
          <span className="bg-white text-orange-500 rounded-full px-2.5 py-0.5 text-sm font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {/* Drawer */}
      <QueueDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}

