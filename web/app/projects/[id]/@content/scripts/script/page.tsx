"use client";
/**
 * 台本式模式页面
 * 当前仅作为 mode 标识，复用父级编辑器
 */
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { PageLoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export default function ScriptModePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  useEffect(() => {
    // 台本式默认模式，重定向到父路由
    if (projectId) {
      router.replace(`/projects/${projectId}/scripts`);
    }
  }, [projectId, router]);

  return <PageLoadingSkeleton />;
}

