import { api } from './client';
import type { CinemaSettings } from '@/lib/types/cinema';
import type { ProjectType, ScreenplayFormat } from '@/lib/types/screenplay';

export type Project = {
  id: string;
  name: string;
  description?: string;
  type?: ProjectType;
  format?: ScreenplayFormat;
  cinemaSettings?: CinemaSettings;
  createdAt: string;
  updatedAt: string;
  episodes?: Array<{
    id: string;
    name: string;
    sortOrder?: number;
  }>;
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

export type CreateProjectOptions = {
  type?: ProjectType;
  format?: ScreenplayFormat;
  cinemaSettings?: CinemaSettings;
};

export async function listProjects(page = 1, limit = 50): Promise<ProjectListResponse> {
  return api<ProjectListResponse>(`/api/projects?page=${page}&limit=${limit}`, {
    noCache: true, // 禁用缓存，确保获取最新数据
  });
}

export async function createProject(
  name: string,
  options?: CreateProjectOptions
): Promise<Project> {
  return api<Project>(`/api/projects`, {
    method: 'POST',
    body: {
      name,
      type: options?.type ?? 'script',
      format: options?.format ?? 'hollywood',
      cinemaSettings: options?.cinemaSettings,
    },
  });
}

export async function getProject(projectId: string): Promise<Project> {
  return api<Project>(`/api/projects/${projectId}`, {
    cacheTtlMs: 5000, // Cache for 5 seconds
  });
}

export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'format' | 'cinemaSettings'>>
): Promise<Project> {
  return api<Project>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: updates,
    noCache: true,
  });
}
