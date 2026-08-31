"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getProject } from "@/lib/api/projects";
import type { ProjectType } from "@/lib/types/screenplay";
import { FloatingAI, type FloatingAISendPayload } from "./FloatingAI";
import { ProjectPanel } from "./ProjectPanel";
import { WorkspaceRail } from "./WorkspaceRail";

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

export function WorkspaceShell({
  projectId,
  children,
  scopeNodeIds = [],
  onSend,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [projectType, setProjectType] = useState<ProjectType>("script");

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
      className="h-dvh w-full flex overflow-hidden"
      style={{ background: "#fafaf9" }}
    >
      <WorkspaceRail projectId={projectId} projectType={projectType} />
      <ProjectPanel projectId={projectId} />
      <div className="relative flex-1 min-w-0 overflow-hidden">
        <div className="h-full overflow-auto">{children}</div>
        <FloatingAI
          projectId={projectId}
          scopeNodeIds={scopeNodeIds}
          onSend={onSend}
          mode={projectType === "cinema" ? "cinema" : "script"}
        />
      </div>
    </div>
  );
}
