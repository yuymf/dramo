"use client";

import type { ReactNode } from "react";
import { FloatingAI, type FloatingAISendPayload } from "./FloatingAI";
import { ProjectPanel } from "./ProjectPanel";
import { WorkspaceRail } from "./WorkspaceRail";

export interface WorkspaceShellProps {
  projectId: string;
  children: ReactNode;
  scopeNodeIds?: string[];
  onSend?: (payload: FloatingAISendPayload) => void;
}

export function WorkspaceShell({
  projectId,
  children,
  scopeNodeIds = [],
  onSend,
}: WorkspaceShellProps) {
  return (
    <div
      className="h-dvh w-full flex overflow-hidden"
      style={{ background: "#fafaf9" }}
    >
      <WorkspaceRail projectId={projectId} />
      <ProjectPanel projectId={projectId} />
      <div className="relative flex-1 min-w-0 overflow-hidden">
        <div className="h-full overflow-auto">{children}</div>
        <FloatingAI
          projectId={projectId}
          scopeNodeIds={scopeNodeIds}
          onSend={onSend}
        />
      </div>
    </div>
  );
}
