"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FolderOpen, Home, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/home", icon: Home, label: "主页" },
  { href: "/projects", icon: FolderOpen, label: "项目" },
  { href: "/library", icon: BookOpen, label: "公开库" },
  { href: "/settings", icon: Settings, label: "设置" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-[72px] flex-shrink-0 flex flex-col items-center py-8 border-r sticky top-0 h-[100dvh]"
      style={{
        borderColor: "var(--at-border)",
        background: "var(--at-surface)",
      }}
    >
      <Link href="/home" className="mb-10" aria-label="DRAMO 主页">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: "var(--ink-black)",
            color: "var(--rice-paper)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          D
        </div>
      </Link>

      <nav className="flex flex-col items-center gap-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href === "/projects" && pathname?.startsWith("/projects"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "w-14 flex flex-col items-center gap-1 py-3 rounded-xl",
                isActive
                  ? "text-[var(--ink-black)]"
                  : "text-[var(--ink-light)] hover:text-[var(--ink-wash)] hover:bg-[var(--rice-warm)]"
              )}
            >
              <Icon
                className="w-[18px] h-[18px]"
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span
                className={cn(
                  "text-[10px] tracking-wide",
                  isActive && "font-medium"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
