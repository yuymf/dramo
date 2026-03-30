"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTranslation, type Locale } from "@/lib/i18n";
import {
  FileText,
  PenLine,
  Users,
  MapPin,
  Film,
  FolderOpen,
  Plus,
  Search,
  ChevronRight,
} from "lucide-react";

interface ProjectSidebarProps {
  locale?: Locale;
  currentProjectId?: string;
  projectName?: string;
  activeMenuItem?: string;
  onProjectNameChange?: (newName: string) => void;
}

export function ProjectSidebar({ locale = "zh", currentProjectId, projectName, activeMenuItem, onProjectNameChange }: ProjectSidebarProps) {
  const { t } = useTranslation(locale);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editProjectName, setEditProjectName] = useState(projectName || "");

  const projectMenuItems = useMemo(() => [
    { id: "input", label: t("input"), icon: PenLine, href: `/projects/${currentProjectId}/input` },
    { id: "script", label: t("script"), icon: FileText, href: `/projects/${currentProjectId}/scripts` },
    { id: "characters", label: t("characters"), icon: Users, href: `/projects/${currentProjectId}/characters` },
    { id: "locations", label: "地点", icon: MapPin, href: `/projects/${currentProjectId}/locations` },
    { id: "storyboard", label: t("storyboard"), icon: Film, href: `/projects/${currentProjectId}/storyboard` },
  ], [currentProjectId, t]);

  return (
    <aside className="w-[220px] h-screen bg-[var(--at-surface)] border-r border-[var(--at-border)] flex flex-col">
      {/* Logo */}
      <Link href="/">
        <div className="h-[56px] px-5 flex items-center gap-2 border-b border-[var(--at-border-light)] cursor-pointer hover:bg-[var(--at-surface-hover)] transition-colors">
          <div className="relative w-8 h-8 shrink-0">
            <Image
              src="/logo.jpg"
              alt="Logo"
              fill
              sizes="32px"
              className="object-contain rounded"
            />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--at-text)]">
            DRAMO
          </span>
        </div>
      </Link>

      {/* Search + Actions */}
      <div className="px-3 py-3 space-y-1.5">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--at-text-tertiary)]" />
          <input
            type="text"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--at-border-light)] bg-[var(--at-surface-sunken)] text-[var(--at-text)] placeholder:text-[var(--at-text-tertiary)] focus:outline-none focus:border-[var(--at-border)] focus:bg-[var(--at-surface)] transition-all"
          />
        </div>
        <button className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--at-text-secondary)] rounded-lg hover:bg-[var(--at-surface-hover)] transition-colors">
          <FolderOpen size={14} />
          <span>{t("allProject")}</span>
        </button>
        <button className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--at-text-secondary)] rounded-lg hover:bg-[var(--at-surface-hover)] transition-colors">
          <Plus size={14} />
          <span>{t("newProject")}</span>
        </button>
      </div>

      {/* Project Name + Nav */}
      <div className="flex-1 overflow-hidden px-3">
        {/* Project header */}
        <div className="mb-3 mt-1">
          <div className="text-[10px] uppercase tracking-widest text-[var(--at-text-tertiary)] font-medium mb-2 px-2.5">
            项目
          </div>
          {isEditingProjectName ? (
            <input
              type="text"
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              onBlur={() => {
                setIsEditingProjectName(false);
                if (editProjectName.trim() && editProjectName !== projectName) {
                  onProjectNameChange?.(editProjectName.trim());
                } else {
                  setEditProjectName(projectName || "");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setIsEditingProjectName(false);
                  if (editProjectName.trim() && editProjectName !== projectName) {
                    onProjectNameChange?.(editProjectName.trim());
                  } else {
                    setEditProjectName(projectName || "");
                  }
                } else if (e.key === "Escape") {
                  setIsEditingProjectName(false);
                  setEditProjectName(projectName || "");
                }
              }}
              autoFocus
              className="w-full px-2.5 py-1 text-sm font-medium border-b-2 border-[var(--at-accent)] bg-transparent text-[var(--at-text)] focus:outline-none"
            />
          ) : (
            <h3
              className="text-sm font-medium text-[var(--at-text)] cursor-pointer px-2.5 py-1 rounded-lg hover:bg-[var(--at-surface-hover)] transition-colors flex items-center justify-between group"
              onDoubleClick={() => {
                setIsEditingProjectName(true);
                setEditProjectName(projectName || "");
              }}
            >
              <span className="truncate">{projectName || t("projectName")}</span>
              <ChevronRight size={12} className="text-[var(--at-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
          )}
        </div>

        {/* Nav items */}
        <nav className="space-y-0.5">
          {projectMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeMenuItem;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 text-[13px] rounded-lg transition-all duration-200 relative",
                  isActive
                    ? "bg-[var(--at-surface-active)] text-[var(--at-accent)] font-medium"
                    : "text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] hover:text-[var(--at-text)]"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--at-accent)]" />
                )}
                <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User section */}
      <div className="px-3 py-3 border-t border-[var(--at-border-light)]">
        <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--at-surface-hover)] transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--at-accent)] to-orange-400 flex items-center justify-center text-[11px] font-semibold text-white">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--at-text)] truncate">用户名</p>
            <p className="text-[10px] text-[var(--at-text-tertiary)] truncate">user@example.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
