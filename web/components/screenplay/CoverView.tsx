"use client";

import { useParams } from "next/navigation";
import { CoverEditor } from "./CoverEditor";
import { ExportSlot } from "./ExportSlot";
import { formatLabel } from "./nodeMeta";
import { saveStatusLabel, useScreenplayDoc } from "./useScreenplayDoc";
import "./screenplay.css";

export function CoverView() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const { format, cover, status, error, ready, setCover, doc } = useScreenplayDoc(projectId);

  if (!ready && status === "loading") {
    return (
      <div className="sp-workspace">
        <div className="sp-loading">正在打开封面…</div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="sp-workspace">
        <div className="sp-error">{error ?? "无法加载封面"}</div>
      </div>
    );
  }

  return (
    <div className={`sp-workspace sp-format-${format}`}>
      <header className="sp-toolbar">
        <div className="sp-toolbar-title">
          <h1>封面</h1>
          <span className="sp-toolbar-meta">{formatLabel(format)}</span>
        </div>
        <div className="sp-toolbar-actions">
          <span className="sp-save-status">{saveStatusLabel(status)}</span>
          <ExportSlot doc={doc} />
        </div>
      </header>
      <div className="sp-body">
        <div className="sp-stage">
          <div className="sp-paper">
            <CoverEditor cover={cover} format={format} onChange={setCover} />
          </div>
        </div>
      </div>
    </div>
  );
}
