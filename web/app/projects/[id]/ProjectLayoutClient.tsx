"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { AIChatProvider } from "@/app/ai-chat-provider";
import { ChatPanel } from "@/components/chat/ChatPanel";

interface ProjectLayoutClientProps {
  children: React.ReactNode;
}

function PipelineTabListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleTabSwitch = (e: Event) => {
      const { tab } = (e as CustomEvent).detail;
      if (!pathname) return;

      const match = pathname.match(/\/projects\/([^/]+)/);
      if (match) {
        const projectId = match[1];
        router.push(`/projects/${projectId}/${tab}`);
      }
    };

    window.addEventListener('pipeline-tab-switch', handleTabSwitch);
    return () => window.removeEventListener('pipeline-tab-switch', handleTabSwitch);
  }, [router, pathname]);

  return null;
}

function ProjectLayoutContent({ children }: ProjectLayoutClientProps) {
  const params = useParams<{ id: string }>();
  const projectId = params?.id as string;

  return (
    <AIChatProvider>
      <div className="h-screen overflow-hidden">
        <PanelGroup orientation="horizontal" className="h-full">
        {/* Content area */}
        <Panel defaultSize={72} minSize={50}>
          {children}
        </Panel>

        {/* Resize handle */}
        <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-orange-200/50 active:bg-orange-300/50 transition-colors cursor-col-resize relative group">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-stone-200 group-hover:bg-orange-300 transition-colors" />
        </PanelResizeHandle>

        {/* Chat panel */}
        <Panel defaultSize={28} minSize={18} collapsible collapsedSize={0}>
          {projectId && <ChatPanel projectId={projectId} />}
        </Panel>
        </PanelGroup>
      </div>

      <PipelineTabListener />
    </AIChatProvider>
  );
}

export function ProjectLayoutClient({ children }: ProjectLayoutClientProps) {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-[var(--at-bg)]">{children}</div>}>
      <ProjectLayoutContent>{children}</ProjectLayoutContent>
    </Suspense>
  );
}
