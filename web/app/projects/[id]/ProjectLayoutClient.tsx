"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

interface ProjectLayoutClientProps {
  children: React.ReactNode;
}

function ProjectLayoutContent({ children }: ProjectLayoutClientProps) {
  const params = useParams<{ id: string }>();
  const projectId = params?.id as string;

  if (!projectId) {
    return <div className="h-dvh" style={{ background: "#fafaf9" }}>{children}</div>;
  }

  return <WorkspaceShell projectId={projectId}>{children}</WorkspaceShell>;
}

export function ProjectLayoutClient({ children }: ProjectLayoutClientProps) {
  return (
    <Suspense fallback={<div className="flex min-h-dvh" style={{ background: "#fafaf9" }}>{children}</div>}>
      <ProjectLayoutContent>{children}</ProjectLayoutContent>
    </Suspense>
  );
}
