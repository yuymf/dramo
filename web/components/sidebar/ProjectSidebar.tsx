"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTranslation, type Locale } from "@/lib/i18n";
import {
  FileText,
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
    { id: "script", label: t("script"), icon: FileText, href: `/projects/${currentProjectId}/scripts` },
    { id: "characters", label: t("characters"), icon: Users, href: `/projects/${currentProjectId}/characters` },
    { id: "locations", label: "地点", icon: MapPin, href: `/projects/${currentProjectId}/locations` },
    { id: "storyboard", label: t("storyboard"), icon: Film, href: `/projects/${currentProjectId}/storyboard` },
  ], [currentProjectId, t]);

  return (
    <aside className="w-[220px] h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50/50 border-r border-stone-200/40 flex flex-col relative overflow-hidden">
      {/* 背景纹理 - 优雅的纸质效果 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(234,179,8,0.03)_0%,transparent_50%)]"></div>
      </div>

      {/* 内容容器 */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Logo */}
        <Link href="/">
          <div className="h-[56px] px-4 flex items-center gap-2.5 border-b border-stone-200/50 cursor-pointer hover:bg-stone-100/30 transition-colors group">
            <div className="relative w-8 h-8 shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Image
                src="/logo.jpg"
                alt="Dramo Logo"
                fill
                sizes="32px"
                className="object-contain rounded"
              />
            </div>
            <span className="text-sm font-bold tracking-wide text-stone-900 group-hover:text-orange-700 transition-colors" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", letterSpacing: '0.08em', fontStyle: 'italic' }}>
              DRAMO
            </span>
          </div>
        </Link>

      {/* Search + Actions */}
      <div className="px-3 py-3 space-y-1.5 border-b border-stone-200/30">
        <div className="relative group">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-stone-600 transition-colors" />
          <input
            type="text"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-white/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-400/50 focus:bg-white focus:ring-1 focus:ring-orange-200/50 transition-all"
          />
        </div>
        <Link
          href="/projects"
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-stone-600 rounded-lg hover:bg-stone-100/50 hover:text-stone-900 transition-all duration-200 group"
        >
          <FolderOpen size={14} className="group-hover:scale-110 transition-transform" />
          <span>{t("allProject")}</span>
        </Link>
        <Link
          href="/projects"
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-stone-600 rounded-lg hover:bg-stone-100/50 hover:text-stone-900 transition-all duration-200 group"
        >
          <Plus size={14} className="group-hover:scale-110 transition-transform" />
          <span>{t("newProject")}</span>
        </Link>
      </div>

      {/* Project Name + Nav */}
      <div className="flex-1 overflow-hidden px-3 py-4">
        {/* Project header */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-2.5 px-2.5">
            项目工作空间
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
              className="w-full px-2.5 py-1.5 text-sm font-semibold border-b-2 border-orange-500 bg-transparent text-stone-900 focus:outline-none rounded-sm"
            />
          ) : (
            <h3
              className="text-sm font-semibold text-stone-900 cursor-pointer px-2.5 py-1.5 rounded-lg hover:bg-stone-100/50 transition-colors flex items-center justify-between group"
              onDoubleClick={() => {
                setIsEditingProjectName(true);
                setEditProjectName(projectName || "");
              }}
            >
              <span className="truncate">{projectName || t("projectName")}</span>
              <ChevronRight size={14} className="text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
          )}
        </div>

        {/* Nav items */}
        <nav className="space-y-1">
          {projectMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeMenuItem;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2.5 text-[13px] rounded-lg transition-all duration-200 relative group",
                  isActive
                    ? "bg-gradient-to-r from-orange-50 to-orange-50/50 text-orange-700 font-semibold shadow-sm"
                    : "text-stone-600 hover:bg-stone-100/60 hover:text-stone-900"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-sm" />
                )}
                <Icon size={16} strokeWidth={isActive ? 2 : 1.5} className="group-hover:scale-110 transition-transform" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User section */}
      <div className="px-3 py-3 border-t border-stone-200/30 bg-gradient-to-t from-stone-50/50 to-transparent">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-stone-100/50 transition-colors cursor-pointer group">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm group-hover:shadow-md transition-shadow">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-stone-900 truncate">用户名</p>
            <p className="text-[10px] text-stone-400 truncate">user@example.com</p>
          </div>
        </div>
      </div>
      </div>
    </aside>
  );
}
