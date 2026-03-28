/**
 * GenerationJobsProvider - 客户端包装组件
 * 用于在服务端组件中安全地使用客户端 Context
 */
"use client";

import { GenerationJobsProvider } from "@/lib/hooks/useGenerationJobs";
import { QueueDock } from "@/components/generation/QueueDock";
import { ClientWrapper } from "./client-wrapper";

export function GenerationJobsProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GenerationJobsProvider>
      <ClientWrapper>
        {children}
        <QueueDock />
      </ClientWrapper>
    </GenerationJobsProvider>
  );
}

