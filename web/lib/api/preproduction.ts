import { api } from "./client";
import { firstEpisodeId } from "./planning";

export { firstEpisodeId };

export interface SceneRecord {
  id: string;
  heading: string;
  locationName: string | null;
  sortOrder: number;
}

export interface ShotRecord {
  id?: string;
  sceneId?: string;
  sceneHeading: string;
  description: string;
  camera: string;
  design: string;
  stale?: boolean;
  images?: unknown;
  sortOrder?: number;
}

export async function listScenes(projectId: string, episodeId: string) {
  return api<{ scenes: SceneRecord[] }>(`/api/projects/${projectId}/episodes/${episodeId}/scenes`, {
    noCache: true,
  });
}

export async function listShots(projectId: string, episodeId: string) {
  return api<{ shots: ShotRecord[] }>(`/api/projects/${projectId}/episodes/${episodeId}/shots`, {
    noCache: true,
  });
}

export async function putShots(projectId: string, episodeId: string, shots: ShotRecord[]) {
  return api<{ shots: ShotRecord[] }>(`/api/projects/${projectId}/episodes/${episodeId}/shots`, {
    method: "PUT",
    body: { shots },
    noCache: true,
  });
}

export async function exportFdx(projectId: string, episodeId: string) {
  return api<{ filename: string; xml: string }>(
    `/api/projects/${projectId}/episodes/${episodeId}/export/fdx`,
    { noCache: true }
  );
}

export async function importFdx(xml: string, name?: string) {
  return api<{ id: string; name: string; episodeId: string }>("/api/projects/import-fdx", {
    method: "POST",
    body: { xml, name },
    noCache: true,
  });
}

export async function listProjectAssets(projectId: string) {
  return api<{
    assets: Array<{ id: string; kind: string; url: string; createdAt: string }>;
    tasks: Array<{
      id: string;
      kind: string;
      status: string;
      prompt: string;
      resultUrl: string | null;
      createdAt: string;
    }>;
  }>(`/api/projects/${projectId}/assets`, { noCache: true });
}
