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
  castingNotes?: string | null;
  storyPlace?: string | null;
  shootPlace?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntityListResponse {
  data: DerivedEntity[];
}

export interface GenerationTask {
  id: string;
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
  return patchEntity(kind, projectId, entityId, { description });
}

export async function patchEntity(
  kind: DerivedEntityKind,
  projectId: string,
  entityId: string,
  body: {
    description?: string | null;
    castingNotes?: string | null;
    storyPlace?: string | null;
    shootPlace?: string | null;
  }
): Promise<DerivedEntity> {
  return api<DerivedEntity>(patchPath(kind, projectId, entityId), {
    method: "PATCH",
    body,
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

export async function getGenerationTask(taskId: string): Promise<GenerationTask> {
  return api<GenerationTask>(`/api/tasks/${taskId}`, {
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

export function taskId(task: GenerationTask): string {
  return task.id;
}

export function isTerminalStatus(status: TaskStatus | string): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}

export interface ProjectAssetImage {
  id: string;
  url: string;
  createdAt: string;
}

export interface ProjectAssets {
  characters: Array<{
    id: string;
    name: string;
    images: ProjectAssetImage[];
  }>;
  locations: Array<{
    id: string;
    name: string;
    images: ProjectAssetImage[];
  }>;
}

export async function getProjectAssets(projectId: string): Promise<ProjectAssets> {
  const [characters, locations] = await Promise.all([
    listDerivedEntities("character", projectId).catch(() => [] as DerivedEntity[]),
    listDerivedEntities("location", projectId).catch(() => [] as DerivedEntity[]),
  ]);

  const toImages = (images: unknown): ProjectAssetImage[] =>
    imageUrls(images).map((url, index) => ({ id: `${index}`, url, createdAt: "" }));

  return {
    characters: characters.map((row) => ({
      id: row.id,
      name: row.name,
      images: toImages(row.images),
    })),
    locations: locations.map((row) => ({
      id: row.id,
      name: row.name,
      images: toImages(row.images),
    })),
  };
}
