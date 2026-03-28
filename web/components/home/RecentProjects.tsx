"use client";

import { useEffect, useState } from "react";
import { type Project, listProjects } from "@/lib/api/projects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";

export function RecentProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  if (loading) {
    return (
      <div className="ink-reveal ink-reveal-5">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2
              className="text-xl ink-display"
              style={{ color: "var(--ink-black)" }}
            >
              最近项目
            </h2>
            <p
              className="text-xs mt-1 ink-ui"
              style={{ color: "var(--ink-light)" }}
            >
              Recent projects
            </p>
          </div>
        </div>
        <div className="flex gap-5 overflow-x-auto pb-4 ink-scroll">
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

  return (
    <div className="ink-reveal ink-reveal-5">
      {/* Section header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2
            className="text-xl ink-display"
            style={{ color: "var(--ink-black)" }}
          >
            最近项目
          </h2>
          <p
            className="text-xs mt-1 ink-ui"
            style={{ color: "var(--ink-light)" }}
          >
            Recent projects
          </p>
        </div>
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-xs ink-ui transition-colors hover:text-[var(--ink-black)]"
          style={{ color: "var(--ink-light)" }}
        >
          查看全部
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
        </Link>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-5 overflow-x-auto pb-4 ink-scroll">
        {/* New project card */}
        <Link href="/projects" className="flex-shrink-0">
          <div
            className="w-60 h-44 rounded-xl border-2 border-dashed flex items-center justify-center transition-all duration-300 hover:border-[var(--ink-light)] group cursor-pointer"
            style={{
              borderColor: "rgba(26, 26, 24, 0.08)",
              background: "rgba(248, 245, 239, 0.4)",
            }}
          >
            <div className="text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 transition-all duration-300 group-hover:scale-110"
                style={{ background: "var(--rice-warm)" }}
              >
                <Plus
                  className="w-4 h-4"
                  style={{ color: "var(--ink-wash)" }}
                  strokeWidth={1.5}
                />
              </div>
              <p
                className="text-sm ink-ui"
                style={{ color: "var(--ink-light)" }}
              >
                新建项目
              </p>
            </div>
          </div>
        </Link>

        {/* Project cards */}
        {projects.map((project) => (
          <div key={project.id} className="flex-shrink-0 w-60">
            <ProjectCard project={project} />
          </div>
        ))}

        {/* Empty state */}
        {projects.length === 0 && (
          <div className="flex-shrink-0 w-full text-center py-16">
            <p
              className="text-sm ink-ui"
              style={{ color: "var(--ink-light)" }}
            >
              还没有项目，点击上方卡片创建第一个项目吧
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
