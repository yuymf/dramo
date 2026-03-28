"use client";

import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ProjectsGrid } from "@/components/projects/ProjectsGrid";
import { type Project } from "@/lib/api/projects";

interface ProjectsPageClientProps {
  initialProjects: Project[];
}

function ProjectsPageContent({ initialProjects }: ProjectsPageClientProps) {
  return (
    <div className="min-h-screen flex rice-paper-bg">
      <AppSidebar />

      <div className="flex-1 flex flex-col relative z-10">
        {/* Page header */}
        <header className="px-8 lg:px-16 pt-16 pb-10">
          <div className="max-w-6xl mx-auto">
            <p
              className="text-xs tracking-widest uppercase mb-3 ink-ui"
              style={{ color: "var(--ink-light)", letterSpacing: "0.2em" }}
            >
              My Projects
            </p>
            <h1
              className="text-3xl lg:text-4xl ink-display"
              style={{ color: "var(--ink-black)" }}
            >
              我的项目
            </h1>
            <p
              className="mt-3 text-sm ink-body"
              style={{ color: "var(--ink-light)" }}
            >
              管理你的剧本创作项目，开始你的创作之旅
            </p>
          </div>
        </header>

        {/* Divider */}
        <div className="max-w-6xl mx-auto px-8 lg:px-16 w-full">
          <div className="ink-divider" style={{ margin: 0 }} />
        </div>

        {/* Project grid */}
        <main className="flex-1 max-w-6xl mx-auto px-8 lg:px-16 py-10 w-full">
          <ProjectsGrid initialProjects={initialProjects} />
        </main>
      </div>
    </div>
  );
}

export function ProjectsPageClient({ initialProjects }: ProjectsPageClientProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex rice-paper-bg">
        <AppSidebar />
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div
            className="w-5 h-5 border-[1.5px] rounded-full animate-spin"
            style={{
              borderColor: "rgba(26, 26, 24, 0.08)",
              borderTopColor: "var(--ink-wash)",
            }}
          />
        </div>
      </div>
    }>
      <ProjectsPageContent initialProjects={initialProjects} />
    </Suspense>
  );
}
