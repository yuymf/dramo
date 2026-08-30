import { api } from "./client";
import type { AssetKind, TaskStatus } from "@/lib/types/screenplay";

export type DerivedEntityKind = "character" | "location";
export type ImageGenerationKind = Extract<AssetKind, "portrait" | "location">;

export interface DerivedEntity {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  images: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface EntityListResponse {
  data: DerivedEntity[];
}

export interface GenerationTask {
  id: string;
  jobId?: string;
  projectId: string;
  kind?: ImageGenerationKind;
  entityId?: string | null;
  prompt?: string;
  status: TaskStatus;
  progress?: number;
  resultUrl?: string | null;
  error?: { message?: string } | string | null;
  createdAt?: string;
  updatedAt?: string;
}

const kindPath: Record<DerivedEntityKind, "characters" | "locations"> = {
  character: "characters",
  location: "locations",
};

export function listPath(kind: DerivedEntityKind, projectId: string): string {
  return `/api/projects/${projectId}/${kindPath[kind]}`;
}

export function patchPath(
  kind: DerivedEntityKind,
  projectId: string,
  entityId: string
): string {
  return `${listPath(kind, projectId)}/${entityId}`;
}

export async function listDerivedEntities(
  kind: DerivedEntityKind,
  projectId: string
): Promise<DerivedEntity[]> {
  const res = await api<EntityListResponse | DerivedEntity[]>(listPath(kind, projectId), {
    noCache: true,
  });
  if (Array.isArray(res)) return res;
  return Array.isArray(res?.data) ? res.data : [];
}

export async function patchEntityDescription(
  kind: DerivedEntityKind,
  projectId: string,
  entityId: string,
  description: string
): Promise<DerivedEntity> {
  return api<DerivedEntity>(patchPath(kind, projectId, entityId), {
    method: "PATCH",
    body: { description },
    noCache: true,
  });
}

export async function createEntityImage(params: {
  projectId: string;
  kind: ImageGenerationKind;
  entityId: string;
  prompt: string;
  aspectRatio?: string;
}): Promise<GenerationTask> {
  return api<GenerationTask>("/api/images/generations", {
    method: "POST",
    body: params,
    noCache: true,
  });
}

export async function getGenerationTask(jobId: string): Promise<GenerationTask> {
  return api<GenerationTask>(`/api/jobs/${jobId}`, {
    method: "GET",
    noCache: true,
  });
}

export function imageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const urls: string[] = [];
  for (const item of images) {
    if (typeof item === "string" && item) {
      urls.push(item);
      continue;
    }
    if (item && typeof item === "object" && "url" in item) {
      const url = (item as { url: unknown }).url;
      if (typeof url === "string" && url) urls.push(url);
    }
  }
  return urls;
}

export function buildEntityPrompt(name: string, description: string | null | undefined): string {
  const desc = description?.trim();
  return desc ? `${name.trim()}，${desc}` : name.trim();
}

export function taskJobId(task: GenerationTask): string {
  return task.jobId || task.id;
}

export function isTerminalStatus(status: TaskStatus | string): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}
