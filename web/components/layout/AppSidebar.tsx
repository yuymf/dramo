"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderOpen, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/home",
      icon: Home,
      label: "主页",
      labelEn: "Home",
    },
    {
      href: "/projects",
      icon: FolderOpen,
      label: "项目",
      labelEn: "Projects",
    },
    {
      href: "/settings",
      icon: Settings,
      label: "设置",
      labelEn: "Settings",
    },
    {
      href: "/profile",
      icon: User,
      label: "我的",
      labelEn: "Profile",
    },
  ];

  return (
    <aside
      className="w-[72px] flex-shrink-0 flex flex-col items-center py-8 border-r sticky top-0 h-screen"
      style={{
        borderColor: "rgba(26, 26, 24, 0.06)",
        background: "var(--rice-paper)",
      }}
    >
      {/* Logo mark */}
      <div className="mb-10">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: "var(--ink-black)",
            color: "var(--rice-paper)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            fontFamily: "'Courier New', monospace",
          }}
        >
          D
        </div>
      </div>

      {/* Navigation */}
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
                "group relative w-14 flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-300",
                isActive
                  ? "ink-nav-active"
                  : "hover:bg-[var(--rice-warm)]"
              )}
              title={item.label}
            >
              <Icon
                className={cn(
                  "w-[18px] h-[18px] transition-colors duration-300",
                  isActive
                    ? "text-[var(--ink-black)]"
                    : "text-[var(--ink-light)] group-hover:text-[var(--ink-wash)]"
                )}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span
                className={cn(
                  "text-[10px] tracking-wide transition-colors duration-300",
                  isActive
                    ? "text-[var(--ink-black)] font-medium"
                    : "text-[var(--ink-light)] group-hover:text-[var(--ink-wash)]"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom accent */}
      <div
        className="w-5 h-px"
        style={{ background: "rgba(26, 26, 24, 0.1)" }}
      />
    </aside>
  );
}
