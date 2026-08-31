"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject } from "@/lib/api/projects";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";

  useEffect(() => {
    if (!id) return;
    void getProject(id)
      .then((project) => {
        router.replace(project.type === "cinema" ? `/projects/${id}/reels` : `/projects/${id}/screenplay`);
      })
      .catch(() => router.replace(`/projects/${id}/screenplay`));
  }, [id, router]);

  return null;
}
