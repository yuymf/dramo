"use client";

import { useMemo } from "react";
import type { ScreenplayNode } from "@/lib/types/screenplay";
import { cn } from "@/lib/utils";
import { estimatePages } from "./pageEstimate";
import "./screenplay.css";

export interface PageTimelineProps {
  nodes: ScreenplayNode[];
  activeNodeId?: string | null;
}

interface PageTick {
  page: number;
  scene: string;
}

export function PageTimeline({ nodes, activeNodeId }: PageTimelineProps) {
  const { totalPages, pageOfNode } = useMemo(() => estimatePages(nodes), [nodes]);

  const currentPage = useMemo(() => {
    const index = nodes.findIndex((node) => node.id === activeNodeId);
    if (index < 0) return 1;
    return pageOfNode[index] ?? 1;
  }, [activeNodeId, nodes, pageOfNode]);

  const ticks = useMemo<PageTick[]>(() => {
    const byPage = new Map<number, string>();
    nodes.forEach((node, index) => {
      const page = pageOfNode[index] ?? 1;
      if (!byPage.has(page) && node.type === "scene_heading" && node.text.trim()) {
        byPage.set(page, node.text.trim());
      }
    });
    return Array.from({ length: totalPages }, (_, i) => {
      const page = i + 1;
      return { page, scene: byPage.get(page) ?? "" };
    });
  }, [nodes, pageOfNode, totalPages]);

  const scrollToPage = (page: number) => {
    const index = pageOfNode.findIndex((p) => p === page);
    if (index < 0) return;
    const node = nodes[index];
    document.getElementById(`sp-node-${node.id}`)?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  };

  return (
    <aside className="sp-timeline" aria-label="页数轴">
      <h2>页数轴</h2>
      <p className="sp-timeline-summary">
        当前行约第 <strong>{currentPage}</strong> 页
        <br />
        共 {totalPages} 页 · 约 {totalPages} 分钟
      </p>
      <ol className="sp-timeline-list">
        {ticks.map((tick) => (
          <li key={tick.page}>
            <button
              type="button"
              className={cn("sp-timeline-item", tick.page === currentPage && "is-current")}
              onClick={() => scrollToPage(tick.page)}
            >
              <span className="sp-timeline-item-title">第 {tick.page} 页</span>
              {tick.scene ? (
                <span className="sp-timeline-item-scene">{tick.scene}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
