"use client";

import { Suspense, useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { AIChatProvider } from "@/app/ai-chat-provider";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

interface ProjectLayoutClientProps {
  children: React.ReactNode;
}

function PipelineTabListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleTabSwitch = (e: Event) => {
      const { tab } = (e as CustomEvent).detail as { tab?: string };
      if (!pathname || !tab) return;

      const match = pathname.match(/\/projects\/([^/]+)/);
      if (!match) return;
      const projectId = match[1];
      const dest =
        tab === "script" || tab === "scripts" ? "screenplay" : tab;
      router.push(`/projects/${projectId}/${dest}`);
    };

    window.addEventListener("pipeline-tab-switch", handleTabSwitch);
    return () => window.removeEventListener("pipeline-tab-switch", handleTabSwitch);
  }, [router, pathname]);

  return null;
}

function ProjectLayoutContent({ children }: ProjectLayoutClientProps) {
  const params = useParams<{ id: string }>();
  const projectId = params?.id as string;

  if (!projectId) {
    return <div className="h-dvh" style={{ background: "#fafaf9" }}>{children}</div>;
  }

  return (
    <AIChatProvider>
      <WorkspaceShell projectId={projectId}>{children}</WorkspaceShell>
      <PipelineTabListener />
    </AIChatProvider>
  );
}

export function ProjectLayoutClient({ children }: ProjectLayoutClientProps) {
  return (
    <Suspense fallback={<div className="flex min-h-dvh" style={{ background: "#fafaf9" }}>{children}</div>}>
      <ProjectLayoutContent>{children}</ProjectLayoutContent>
    </Suspense>
  );
}
