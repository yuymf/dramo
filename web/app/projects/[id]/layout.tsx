/**
 * 项目工作区：轨 + 项目面板 + 中央画布 + AI 浮层。
 * @sidebar 仅占并行路由槽，不再渲染 220px 模块列表。
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
      {content}
      {sidebar}
    </ProjectLayoutClient>
  );
}
