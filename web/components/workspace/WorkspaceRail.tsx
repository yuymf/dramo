"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, MapPin, Mic2, MoreHorizontal, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type DimId = "screenplay" | "characters" | "locations" | "spoken";

const PRIMARY: Array<{
  id: DimId;
  label: string;
  href: (projectId: string) => string;
  icon: typeof FileText;
}> = [
  { id: "screenplay", label: "剧本", href: (id) => `/projects/${id}/screenplay`, icon: FileText },
  { id: "characters", label: "角色", href: (id) => `/projects/${id}/characters`, icon: Users },
  { id: "locations", label: "地点", href: (id) => `/projects/${id}/locations`, icon: MapPin },
];

function activeDim(pathname: string | null): DimId | null {
  if (!pathname) return null;
  if (pathname.includes("/spoken")) return "spoken";
  if (pathname.includes("/characters")) return "characters";
  if (pathname.includes("/locations")) return "locations";
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
            color: current === "spoken" || moreOpen ? "#c2410c" : "#78716c",
            background:
              current === "spoken" || moreOpen
                ? "rgba(194, 65, 12, 0.08)"
                : "transparent",
          }}
        >
          <MoreHorizontal size={16} strokeWidth={1.5} />
          <span>更多</span>
        </button>
      </div>
    </nav>
  );
}
