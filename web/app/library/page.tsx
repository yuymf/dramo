"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { listLibrary } from "@/lib/api/collab";

export default function LibraryPage() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; allowCopy: boolean }>>([]);

  useEffect(() => {
    void listLibrary().then((doc) => setProjects(doc.projects));
  }, []);

  return (
    <div className="min-h-screen flex rice-paper-bg">
      <AppSidebar />
      <main className="flex-1 px-8 lg:px-16 py-16">
        <h1 className="text-3xl font-bold mb-8" style={{ color: "var(--ink-black)" }}>
          公开库
        </h1>
        {projects.length === 0 ? (
          <p className="text-sm" style={{ color: "#78716c" }}>
            还没有人发布剧本。作者主动发布后才会出现在这里。
          </p>
        ) : (
          <ul className="max-w-3xl space-y-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/library/${project.id}`}
                  className="block rounded-xl border px-4 py-3"
                  style={{ borderColor: "#e7e5e4", background: "#fff" }}
                >
                  <span className="font-semibold">{project.name}</span>
                  <span className="block text-xs mt-1" style={{ color: "#a8a29e" }}>
                    {project.allowCopy ? "可复制到私有工作区" : "只读"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
