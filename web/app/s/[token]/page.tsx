"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { resolveShareToken } from "@/lib/api/collab";

export default function ShareTokenPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  useEffect(() => {
    const token = params?.token;
    if (!token) return;
    void resolveShareToken(token)
      .then((doc) => {
        router.replace(doc.type === "cinema" ? `/projects/${doc.projectId}/reels` : `/projects/${doc.projectId}/screenplay`);
      })
      .catch(() => router.replace("/login"));
  }, [params, router]);

  return <p className="p-8 text-sm">正在打开分享…</p>;
}
