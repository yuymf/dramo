/**
 * 项目工作区：轨 + 项目面板 + 中央画布 + AI 浮层。
 */
import type { ReactNode } from "react";
import { ProjectLayoutClient } from "./ProjectLayoutClient";

interface ProjectLayoutProps {
  children: ReactNode;
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  return <ProjectLayoutClient>{children}</ProjectLayoutClient>;
}
