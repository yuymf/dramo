"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getProject } from "@/lib/api/projects";
import type { ProjectType } from "@/lib/types/screenplay";
import { FloatingAI, type FloatingAISendPayload } from "./FloatingAI";
import { ProjectPanel } from "./ProjectPanel";
import { WorkspaceRail } from "./WorkspaceRail";
import { WorkspaceExportTarget } from "./WorkspaceExportTarget";
import "./workspace.css";

export interface WorkspaceShellProps {
  projectId: string;
  children: ReactNode;
  scopeNodeIds?: string[];
  onSend?: (payload: FloatingAISendPayload) => void;
}

const SCRIPT_ONLY = [
  "/screenplay",
  "/cover",
  "/outline",
  "/beats",
  "/storyboard",
  "/locations",
  "/worldview",
  "/knowledge",
  "/advisors",
  "/cold-start",
];
const CINEMA_ONLY = ["/reels", "/tasks"];
const EMPTY_SCOPE_NODE_IDS: string[] = [];

export function WorkspaceShell({
  projectId,
  children,
  scopeNodeIds = EMPTY_SCOPE_NODE_IDS,
  onSend,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [projectType, setProjectType] = useState<ProjectType>("script");
  // ≤1024 (PLAN 1024×768): default collapsed so the canvas is not crushed.
  // Only applied on first mount / initial matchMedia; user toggle wins afterwards.
  const [panelOpen, setPanelOpen] = useState(true);
  const panelUserToggled = useRef(false);
  const [exportTarget, setExportTarget] = useState<HTMLDivElement | null>(null);
  const scriptWorkspace = projectType === "script" && !pathname?.includes("/spoken");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const applyInitial = () => {
      if (panelUserToggled.current) return;
      setPanelOpen(!mq.matches);
    };
    applyInitial();
  }, []);

  const togglePanel = () => {
    panelUserToggled.current = true;
    setPanelOpen((open) => !open);
  };

  useEffect(() => {
    let cancelled = false;
    void getProject(projectId)
      .then((project) => {
        if (cancelled) return;
        const type =
          project.type === "cinema" || project.type === "spoken" || project.type === "script"
            ? project.type
            : "script";
        setProjectType(type);
        const path = pathname ?? "";
        if (type === "cinema" && SCRIPT_ONLY.some((seg) => path.includes(seg))) {
          router.replace(`/projects/${projectId}/reels`);
        }
        if (type === "script" && CINEMA_ONLY.some((seg) => path.includes(seg))) {
          router.replace(`/projects/${projectId}/screenplay`);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId, pathname, router]);

  return (
    <div
      className={`h-dvh w-full flex overflow-hidden ${scriptWorkspace ? "workspace-theme" : ""}`}
      style={{ background: "var(--ws-canvas, #fafaf9)" }}
    >
      <WorkspaceExportTarget.Provider value={scriptWorkspace && panelOpen ? exportTarget : null}>
        <WorkspaceRail
          projectId={projectId}
          projectType={projectType}
          panelOpen={panelOpen}
          onTogglePanel={togglePanel}
        />
        <ProjectPanel projectId={projectId} visible={panelOpen} exportTargetRef={setExportTarget} />
        <div className="relative flex-1 min-w-0 overflow-hidden">
          <div className="h-full overflow-auto">{children}</div>
          <FloatingAI
            projectId={projectId}
            scopeNodeIds={scopeNodeIds}
            onSend={onSend}
            mode={projectType === "cinema" ? "cinema" : "script"}
          />
        </div>
      </WorkspaceExportTarget.Provider>
    </div>
  );
}
