"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { type Project, listProjects } from "@/lib/api/projects";
import { ProjectCard } from "./ProjectCard";
import { NewProjectDialog } from "./NewProjectDialog";

interface ProjectsGridProps {
  initialProjects: Project[];
}

export function ProjectsGrid({ initialProjects }: ProjectsGridProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      if (initialProjects.length > 0) {
        return;
      }

      setLoading(true);
      try {
        const response = await listProjects(1, 50);
        if (response.data && Array.isArray(response.data)) {
          setProjects(response.data);
        } else {
          console.warn('[ProjectsGrid] Invalid response format:', response);
          setProjects([]);
        }
      } catch (error) {
        console.error('[ProjectsGrid] Failed to fetch projects:', error);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [initialProjects]);

  const handleProjectCreated = (_projectId: string) => {
    void _projectId;
    setDialogOpen(false);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* New project tile */}
        <button
          onClick={() => setDialogOpen(true)}
          className="group"
        >
          <div
            className="h-full rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer hover:border-[var(--ink-light)]"
            style={{
              borderColor: "rgba(26, 26, 24, 0.08)",
              background: "rgba(248, 245, 239, 0.3)",
            }}
          >
            <div className="flex flex-col items-center justify-center p-8 min-h-[260px]">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: "var(--rice-warm)" }}
              >
                <Plus
                  className="w-5 h-5"
                  style={{ color: "var(--ink-wash)" }}
                  strokeWidth={1.5}
                />
              </div>
              <h3
                className="text-base font-medium mb-1"
                style={{ color: "var(--ink-wash)" }}
              >
                新建项目
              </h3>
            </div>
          </div>
        </button>

        {/* Project cards */}
        {projects.map((project, i) => (
          <div
            key={project.id}
            className="ink-reveal"
            style={{ animationDelay: `${(i + 1) * 0.06}s` }}
          >
            <ProjectCard project={project} />
          </div>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-16 text-center">
          <div
            className="w-5 h-5 border-[1.5px] rounded-full animate-spin mx-auto"
            style={{
              borderColor: "rgba(26, 26, 24, 0.08)",
              borderTopColor: "var(--ink-wash)",
            }}
          />
        </div>
      )}

      {/* New project dialog */}
      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleProjectCreated}
      />
    </>
  );
}
