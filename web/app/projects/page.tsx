import { ProjectsPageClient } from "./ProjectsPageClient";

export const metadata = {
  title: "我的项目 - DRAMO",
  description: "管理你的剧本创作项目",
};

export default function ProjectsPage() {
  return <ProjectsPageClient initialProjects={[]} />;
}
