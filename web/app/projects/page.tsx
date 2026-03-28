import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ProjectsPageClient } from "./ProjectsPageClient";
import { type Project } from "@/lib/api/projects";
import { authOptions } from "@/lib/auth/options";

export const metadata = {
  title: "我的项目 - DRAMO",
  description: "管理你的剧本创作项目",
};

async function getProjects(): Promise<Project[]> {
  const session = await getServerSession(authOptions);
  const token = session?.backendToken;

  if (!token) {
    console.log("[Projects SSR] No session token found, returning empty array");
    return [];
  }

  const backendUrl =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:12321";
  
  try {
    console.log("[Projects SSR] Fetching projects with session token");
    const response = await fetch(`${backendUrl}/api/projects?page=1&limit=50`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("[Projects SSR] Failed to fetch projects:", response.status);
      return [];
    }

    const data = await response.json();
    console.log("[Projects SSR] Got projects:", data.data?.length || 0);
    return data.data || [];
  } catch (error) {
    console.warn("[Projects SSR] Failed to fetch projects:", error);
    return [];
  }
}

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?redirect=/projects");
  }

  const initialProjects = await getProjects();

  return <ProjectsPageClient initialProjects={initialProjects} />;
}

