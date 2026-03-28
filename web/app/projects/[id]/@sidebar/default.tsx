"use client";
/**
 * 项目侧栏导航 - 常驻组件
 */
import { useParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";
import { getProject, updateProject } from "@/lib/api/projects";
import { useToast } from "@/components/ui/Toast";

export default function ProjectSidebarSlot() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const projectId = params?.id;
  const [projectName, setProjectName] = useState("加载中...");
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // 根据当前路径确定活跃的菜单项
  const getActiveMenuItem = () => {
    if (!pathname) return undefined;
    
    if (pathname.includes('/input')) return 'input';
    if (pathname.includes('/scripts')) return 'script';
    if (pathname.includes('/characters')) return 'characters';
    if (pathname.includes('/locations')) return 'locations';
    if (pathname.includes('/storyboard')) return 'storyboard';
    
    return undefined;
  };

  useEffect(() => {
    // 从 API 读取项目名称
    async function loadProjectName() {
      if (!projectId) return;

      try {
        const project = await getProject(projectId);
        setProjectName(project.name || "未命名项目");
      } catch (err) {
        console.error("Failed to load project:", err);
        // Fallback to a generated name
        setProjectName(`项目 ${projectId.slice(0, 8)}`);
      } finally {
        setLoading(false);
      }
    }

    loadProjectName();
  }, [projectId]);

  const handleProjectNameChange = async (newName: string) => {
    if (!projectId || !newName.trim()) return;

    // Optimistic update
    const oldName = projectName;
    setProjectName(newName);

    try {
      await updateProject(projectId, { name: newName });
      showToast("项目名称已更新", "success");
    } catch (err) {
      console.error("Failed to update project name:", err);
      // Revert on error
      setProjectName(oldName);
      showToast("更新项目名称失败", "error");
    }
  };

  if (!projectId) return null;

  return (
    <ProjectSidebar 
      currentProjectId={projectId}
      projectName={loading ? "加载中..." : projectName}
      activeMenuItem={getActiveMenuItem()}
      onProjectNameChange={handleProjectNameChange}
    />
  );
}

