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
        <header className="px-8 lg:px-16 pt-16 pb-8">
          <div className="max-w-6xl mx-auto">
            <h1
              className="text-3xl lg:text-4xl"
              style={{
                fontFamily: "var(--font-noto-sans-sc), sans-serif",
                color: "var(--ink-black)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
              }}
            >
              我的项目
            </h1>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto px-8 lg:px-16 py-6 w-full">
          <ProjectsGrid initialProjects={initialProjects} />
        </main>
      </div>
    </div>
  );
}

export function ProjectsPageClient({ initialProjects }: ProjectsPageClientProps) {
  return (
    <Suspense
      fallback={
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
      }
    >
      <ProjectsPageContent initialProjects={initialProjects} />
    </Suspense>
  );
}
