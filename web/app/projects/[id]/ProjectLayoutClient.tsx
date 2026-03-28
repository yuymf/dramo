"use client";

import { Suspense, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AIChatProvider, useAIChat } from "@/app/ai-chat-provider";
import { AIChatDrawer } from "@/components/projects/AIChatDrawer";
import { AIChatTriggerButton } from "@/components/projects/AIChatTriggerButton";

interface ProjectLayoutClientProps {
  children: React.ReactNode;
}

function AutoOpenChat() {
  const searchParams = useSearchParams();
  const { openDrawer } = useAIChat();

  useEffect(() => {
    // 检测URL参数openChat=true，自动展开抽屉
    const openChat = searchParams?.get("openChat");
    if (openChat === "true") {
      // 延迟一点展开，让页面先渲染完成，动画更流畅
      const timer = setTimeout(() => {
        openDrawer();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchParams, openDrawer]);

  return null;
}

function ProjectLayoutContent({ children }: ProjectLayoutClientProps) {
  const params = useParams<{ id: string }>();
  const projectId = params?.id as string;

  return (
    <AIChatProvider>
      {children}
      {/* AI助手抽屉 - 只在有projectId时渲染 */}
      {projectId && (
        <>
          <AIChatDrawer projectId={projectId} />
          <Suspense fallback={null}>
            <AutoOpenChat />
          </Suspense>
        </>
      )}
      {/* 右下角触发按钮 */}
      <AIChatTriggerButton />
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

