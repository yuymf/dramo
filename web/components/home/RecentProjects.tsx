"use client";

import { useEffect, useState } from "react";
import { type Project, listProjects } from "@/lib/api/projects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function RecentProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await listProjects(1, 10);
        if (response.data && Array.isArray(response.data)) {
          const sorted = [...response.data].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setProjects(sorted);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  if (loading) {
    return (
      <div>
        <h2
          className="text-xl mb-8"
          style={{
            fontFamily: "var(--font-noto-sans-sc), sans-serif",
            color: "var(--ink-black)",
            fontWeight: 600,
          }}
        >
          最近项目
        </h2>
        <div className="flex gap-5 overflow-x-auto pb-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-60 h-44 rounded-xl animate-pulse"
              style={{ background: "var(--rice-warm)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <p className="text-sm" style={{ color: "var(--ink-light)" }}>
        项目列表暂时读不出来，稍后在「项目」里再看一次。
      </p>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2
          className="text-xl"
          style={{
            fontFamily: "var(--font-noto-sans-sc), sans-serif",
            color: "var(--ink-black)",
            fontWeight: 600,
          }}
        >
          最近项目
        </h2>
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--ink-black)]"
          style={{ color: "var(--ink-light)" }}
        >
          查看全部
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
        </Link>
      </div>

      <div className="flex gap-5 overflow-x-auto pb-4 ink-scroll">
        {projects.map((project) => (
          <div key={project.id} className="flex-shrink-0 w-60">
            <ProjectCard project={project} />
          </div>
        ))}
      </div>
    </div>
  );
}
