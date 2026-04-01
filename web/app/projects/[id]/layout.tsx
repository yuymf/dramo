/**
 * 项目混合路由布局 - 并行路由架构
 * 侧栏常驻 + 主内容区深链接切换
 */
import type { ReactNode } from "react";
import { ProjectLayoutClient } from "./ProjectLayoutClient";

interface ProjectLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  content: ReactNode;
  params: Promise<{ id: string }>;
}

export default function ProjectLayout({
  sidebar,
  content,
}: ProjectLayoutProps) {
  return (
    <ProjectLayoutClient>
      <div className="flex h-screen overflow-hidden bg-[var(--at-bg)]">
        {/* 并行路由：侧栏常驻 */}
        {sidebar}
        
        {/* 并行路由：主内容区（深链接切换）- 保持布局，仅调整背景 */}
        <div className="flex-1 relative" style={{ zIndex: 1 }}>
          {content}
        </div>
      </div>
    </ProjectLayoutClient>
  );
}

