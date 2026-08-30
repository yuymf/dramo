"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTranslation, type Locale } from "@/lib/i18n";
import { FileText, Users, MapPin, Film, FolderOpen } from "lucide-react";

interface ProjectSidebarProps {
  locale?: Locale;
  currentProjectId?: string;
  projectName?: string;
  activeMenuItem?: string;
  onProjectNameChange?: (newName: string) => void;
}

export function ProjectSidebar({
  locale = "zh",
  currentProjectId,
  projectName,
  activeMenuItem,
  onProjectNameChange,
}: ProjectSidebarProps) {
  const { t } = useTranslation(locale);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editProjectName, setEditProjectName] = useState(projectName || "");

  const projectMenuItems = useMemo(
    () => [
      { id: "script", label: t("script"), icon: FileText, href: `/projects/${currentProjectId}/scripts` },
      { id: "characters", label: t("characters"), icon: Users, href: `/projects/${currentProjectId}/characters` },
      { id: "locations", label: "地点", icon: MapPin, href: `/projects/${currentProjectId}/locations` },
      { id: "storyboard", label: t("storyboard"), icon: Film, href: `/projects/${currentProjectId}/storyboard` },
    ],
    [currentProjectId, t]
  );

  const commitName = () => {
    setIsEditingProjectName(false);
    if (editProjectName.trim() && editProjectName !== projectName) {
      onProjectNameChange?.(editProjectName.trim());
    } else {
      setEditProjectName(projectName || "");
    }
  };

  return (
    <aside
      className="w-[220px] h-[100dvh] flex flex-col border-r"
      style={{
        background: "var(--at-surface)",
        borderColor: "var(--at-border)",
      }}
    >
      <Link
        href="/home"
        className="h-14 px-4 flex items-center gap-2.5 border-b"
        style={{ borderColor: "var(--at-border)" }}
      >
        <span className="relative w-8 h-8 shrink-0">
          <Image
            src="/logo.jpg"
            alt=""
            fill
            sizes="32px"
            className="object-contain rounded"
          />
        </span>
        <span
          className="text-sm font-bold tracking-[0.08em]"
          style={{ color: "var(--ink-black)" }}
        >
          DRAMO
        </span>
      </Link>

      <div
        className="px-3 py-3 border-b"
        style={{ borderColor: "var(--at-border)" }}
      >
        <Link
          href="/projects"
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-[var(--rice-warm)]"
          style={{ color: "var(--ink-wash)" }}
        >
          <FolderOpen size={14} />
          <span>全部项目</span>
        </Link>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-4">
        <div className="mb-4">
          <div
            className="text-[10px] mb-2.5 px-2.5"
            style={{ color: "var(--ink-light)" }}
          >
            项目工作空间
          </div>
          {isEditingProjectName ? (
            <input
              type="text"
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setIsEditingProjectName(false);
                  setEditProjectName(projectName || "");
                }
              }}
              autoFocus
              className="w-full px-2.5 py-1.5 text-sm font-semibold bg-transparent focus:outline-none"
              style={{
                color: "var(--ink-black)",
                borderBottom: "1.5px solid var(--at-accent)",
              }}
            />
          ) : (
            <h3
              className="text-sm font-semibold px-2.5 py-1.5 rounded-lg cursor-text hover:bg-[var(--rice-warm)]"
              style={{ color: "var(--ink-black)" }}
              title="双击重命名"
              onDoubleClick={() => {
                setIsEditingProjectName(true);
                setEditProjectName(projectName || "");
              }}
            >
              <span className="truncate block">{projectName || t("projectName")}</span>
            </h3>
          )}
        </div>

        <nav className="space-y-1">
          {projectMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeMenuItem;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2.5 text-[13px] rounded-lg",
                  isActive
                    ? "bg-[var(--at-accent-light)] text-[var(--at-accent)] font-semibold"
                    : "text-[var(--ink-wash)] hover:bg-[var(--rice-warm)] hover:text-[var(--ink-black)]"
                )}
              >
                <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
