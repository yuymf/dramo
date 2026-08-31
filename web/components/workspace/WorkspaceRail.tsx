"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Compass,
  FileText,
  Globe,
  Layers,
  ListTree,
  MapPin,
  Mic2,
  MoreHorizontal,
  Package,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DimId =
  | "screenplay"
  | "outline"
  | "beats"
  | "characters"
  | "locations"
  | "props"
  | "worldview"
  | "knowledge"
  | "advisors"
  | "cold-start"
  | "spoken";

const PRIMARY: Array<{
  id: DimId;
  label: string;
  href: (projectId: string) => string;
  icon: typeof FileText;
}> = [
  { id: "screenplay", label: "剧本", href: (id) => `/projects/${id}/screenplay`, icon: FileText },
  { id: "outline", label: "大纲", href: (id) => `/projects/${id}/outline`, icon: ListTree },
  { id: "beats", label: "Beats", href: (id) => `/projects/${id}/beats`, icon: Layers },
  { id: "characters", label: "角色", href: (id) => `/projects/${id}/characters`, icon: Users },
  { id: "locations", label: "地点", href: (id) => `/projects/${id}/locations`, icon: MapPin },
  { id: "props", label: "道具", href: (id) => `/projects/${id}/props`, icon: Package },
];

function activeDim(pathname: string | null): DimId | null {
  if (!pathname) return null;
  if (pathname.includes("/spoken")) return "spoken";
  if (pathname.includes("/worldview")) return "worldview";
  if (pathname.includes("/knowledge")) return "knowledge";
  if (pathname.includes("/advisors")) return "advisors";
  if (pathname.includes("/cold-start")) return "cold-start";
  if (pathname.includes("/characters")) return "characters";
  if (pathname.includes("/locations")) return "locations";
  if (pathname.includes("/props")) return "props";
  if (pathname.includes("/outline")) return "outline";
  if (pathname.includes("/beats")) return "beats";
  if (
    pathname.includes("/screenplay") ||
    pathname.includes("/cover") ||
    pathname.includes("/scripts")
  ) {
    return "screenplay";
  }
  return null;
}

interface WorkspaceRailProps {
  projectId: string;
}

export function WorkspaceRail({ projectId }: WorkspaceRailProps) {
  const pathname = usePathname();
  const current = activeDim(pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreActive =
    current === "spoken" ||
    current === "worldview" ||
    current === "knowledge" ||
    current === "advisors" ||
    current === "cold-start";

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <nav
      aria-label="工作区维度"
      className="relative z-20 h-full w-14 shrink-0 flex flex-col border-r overflow-visible"
      style={{
        background: "#fafaf9",
        borderColor: "#e7e5e4",
      }}
    >
      <div className="flex-1 flex flex-col items-center gap-1 pt-3">
        {PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <Link
              key={item.id}
              href={item.href(projectId)}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "w-12 flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] leading-none",
                active ? "font-semibold" : "font-medium"
              )}
              style={{
                color: active ? "#c2410c" : "#78716c",
                background: active ? "rgba(194, 65, 12, 0.08)" : "transparent",
              }}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div ref={moreRef} className="relative flex flex-col items-center pb-3">
        {moreOpen && (
          <div
            role="menu"
            className="absolute left-[calc(100%+8px)] bottom-2 z-30 w-36 rounded-lg border py-1"
            style={{
              background: "#ffffff",
              borderColor: "#e7e5e4",
              boxShadow: "0 8px 24px rgba(28, 25, 23, 0.08)",
            }}
          >
            <p
              className="px-3 pt-1.5 pb-1 text-[10px] tracking-wide"
              style={{ color: "#a8a29e" }}
            >
              更多
            </p>
            {(
              [
                { id: "worldview" as const, href: "worldview", label: "世界观", icon: Globe },
                { id: "knowledge" as const, href: "knowledge", label: "知识库", icon: BookOpen },
                { id: "advisors" as const, href: "advisors", label: "顾问", icon: Compass },
                { id: "cold-start" as const, href: "cold-start", label: "冷启动", icon: Sparkles },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = current === item.id;
              return (
                <Link
                  key={item.id}
                  href={`/projects/${projectId}/${item.href}`}
                  role="menuitem"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs"
                  style={{
                    color: active ? "#c2410c" : "#44403c",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <Icon size={14} strokeWidth={1.5} />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href={`/projects/${projectId}/spoken`}
              role="menuitem"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs"
              style={{
                color: current === "spoken" ? "#c2410c" : "#44403c",
                fontWeight: current === "spoken" ? 600 : 400,
              }}
            >
              <Mic2 size={14} strokeWidth={1.5} />
              口播
            </Link>
          </div>
        )}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          title="更多"
          onClick={() => setMoreOpen((v) => !v)}
          className="w-12 flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] leading-none font-medium"
          style={{
            color: moreActive || moreOpen ? "#c2410c" : "#78716c",
            background:
              moreActive || moreOpen ? "rgba(194, 65, 12, 0.08)" : "transparent",
          }}
        >
          <MoreHorizontal size={16} strokeWidth={1.5} />
          <span>更多</span>
        </button>
      </div>
    </nav>
  );
}
