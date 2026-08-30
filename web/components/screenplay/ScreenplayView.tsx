"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ScreenplayEditor } from "./ScreenplayEditor";
import { PageTimeline } from "./PageTimeline";
import { ExportSlot } from "./ExportSlot";
import { formatLabel } from "./nodeMeta";
import { saveStatusLabel, useScreenplayDoc } from "./useScreenplayDoc";
import "./screenplay.css";

export function ScreenplayView() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const { format, nodes, status, error, ready, setNodes, doc } = useScreenplayDoc(projectId);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  if (!ready && status === "loading") {
    return (
      <div className="sp-workspace">
        <div className="sp-loading">正在打开剧本…</div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="sp-workspace">
        <div className="sp-error">{error ?? "无法加载剧本"}</div>
      </div>
    );
  }

  return (
    <div className={`sp-workspace sp-format-${format}`}>
      <header className="sp-toolbar">
        <div className="sp-toolbar-title">
          <h1>剧本</h1>
          <span className="sp-toolbar-meta">{formatLabel(format)}</span>
          <span className="sp-hint">Enter 新行 · Tab 切换类型 · Backspace 删空行</span>
        </div>
        <div className="sp-toolbar-actions">
          <span className="sp-save-status">{saveStatusLabel(status)}</span>
          <ExportSlot doc={doc} />
        </div>
      </header>
      <div className="sp-body">
        <div className="sp-stage">
          <div className="sp-paper">
            <ScreenplayEditor
              nodes={nodes}
              format={format}
              onChange={setNodes}
              activeNodeId={activeNodeId}
              onActiveNodeIdChange={setActiveNodeId}
            />
          </div>
        </div>
        <PageTimeline nodes={nodes} activeNodeId={activeNodeId} />
      </div>
    </div>
  );
}
