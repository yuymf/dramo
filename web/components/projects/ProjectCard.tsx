"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { type Project } from "@/lib/api/projects";
import { getProjectAssets } from "@/lib/utils/exporter";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCover() {
      if (project.id.startsWith('demo-') || project.id.startsWith('proj_demo_')) {
        setLoading(false);
        return;
      }

      try {
        const assets = await getProjectAssets(project.id);
        const allImages = [
          ...assets.characters.flatMap((c) => c.images),
          ...assets.locations.flatMap((l) => l.images),
        ];

        if (allImages.length > 0) {
          allImages.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setCoverUrl(allImages[0].url);
        }
      } catch (err) {
        console.error("Failed to load project cover:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCover();
  }, [project.id]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString("en", { month: "short" });
    const year = date.getFullYear().toString().slice(-2);
    return `${day} ${month} '${year}`;
  };

  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <div className="ink-card overflow-hidden">
        {/* Cover area — 16:9 */}
        <div
          className="relative w-full pb-[56.25%] overflow-hidden"
          style={{ background: "var(--rice-warm)" }}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-5 h-5 border-[1.5px] rounded-full animate-spin"
                style={{
                  borderColor: "rgba(26, 26, 24, 0.08)",
                  borderTopColor: "var(--ink-wash)",
                }}
              />
            </div>
          ) : coverUrl ? (
            <Image
              src={coverUrl}
              alt={project.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 25vw"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-2xl font-semibold tracking-[0.15em] ink-display"
                style={{ color: "var(--ink-light)", opacity: 0.3 }}
              >
                DRAMO
              </span>
            </div>
          )}

          {/* Subtle gradient overlay at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
            style={{
              background: "linear-gradient(to top, rgba(253, 250, 244, 0.6) 0%, transparent 100%)",
            }}
          />
        </div>

        {/* Project info */}
        <div className="p-4">
          <h3
            className="text-[15px] font-medium mb-1 truncate ink-body"
            style={{ color: "var(--ink-black)", lineHeight: 1.4 }}
          >
            {project.name}
          </h3>
          <p
            className="text-xs ink-ui"
            style={{ color: "var(--ink-light)" }}
          >
            {formatDate(project.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}
