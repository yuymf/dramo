import { api } from './client';

export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  scripts?: Array<{
    id: string;
    title?: string;
    status?: string;
  }>;
};

export type ProjectListResponse = {
  data: Project[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
};

export async function listProjects(page = 1, limit = 50): Promise<ProjectListResponse> {
  return api<ProjectListResponse>(`/api/projects?page=${page}&limit=${limit}`, {
    noCache: true, // 禁用缓存，确保获取最新数据
  });
}

export async function createProject(name: string): Promise<Project> {
  return api<Project>(`/api/projects`, {
    method: 'POST',
    body: { name },
  });
}

export async function getProject(projectId: string): Promise<Project> {
  return api<Project>(`/api/projects/${projectId}`, {
    cacheTtlMs: 5000, // Cache for 5 seconds
  });
}

export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, 'name' | 'description'>>
): Promise<Project> {
  return api<Project>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: updates,
    noCache: true,
  });
}



