"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject } from "@/lib/api/projects";

export default function DefaultContentSlot() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getProject(id)
      .then((project) => {
        if (cancelled) return;
        router.replace(project.type === "cinema" ? `/projects/${id}/reels` : `/projects/${id}/screenplay`);
      })
      .catch(() => {
        if (!cancelled) router.replace(`/projects/${id}/screenplay`);
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return null;
}
