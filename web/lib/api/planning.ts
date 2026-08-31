import { api } from "./client";
import { getProject } from "./projects";

export interface OutlineDoc {
  markdown: string;
}

export interface Beat {
  id?: string;
  action: string;
  intent: string;
  outcome: string;
  sortOrder?: number;
  covered?: boolean;
}

export interface BeatsDoc {
  beats: Beat[];
}

export interface PropRecord {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  holder: string | null;
  continuity: string | null;
  images: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface WorldviewRule {
  key: string;
  value: string;
}

export async function firstEpisodeId(projectId: string): Promise<string> {
  const project = await getProject(projectId);
  const first = [...(project.episodes ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  )[0];
  if (!first?.id) {
    throw new Error("项目还没有集");
  }
  return first.id;
}

export async function getOutline(projectId: string, episodeId: string): Promise<OutlineDoc> {
  return api<OutlineDoc>(`/api/projects/${projectId}/episodes/${episodeId}/outline`, {
    noCache: true,
  });
}

export async function putOutline(
  projectId: string,
  episodeId: string,
  markdown: string
): Promise<OutlineDoc> {
  return api<OutlineDoc>(`/api/projects/${projectId}/episodes/${episodeId}/outline`, {
    method: "PUT",
    body: { markdown },
    noCache: true,
  });
}

export async function getBeats(projectId: string, episodeId: string): Promise<BeatsDoc> {
  return api<BeatsDoc>(`/api/projects/${projectId}/episodes/${episodeId}/beats`, {
    noCache: true,
  });
}

export async function putBeats(
  projectId: string,
  episodeId: string,
  beats: Array<Pick<Beat, "id" | "action" | "intent" | "outcome">>
): Promise<BeatsDoc> {
  return api<BeatsDoc>(`/api/projects/${projectId}/episodes/${episodeId}/beats`, {
    method: "PUT",
    body: { beats },
    noCache: true,
  });
}

export async function getBeatCoverage(projectId: string, episodeId: string): Promise<BeatsDoc> {
  return api<BeatsDoc>(`/api/projects/${projectId}/episodes/${episodeId}/beats/coverage`, {
    noCache: true,
  });
}

export async function listProps(projectId: string): Promise<PropRecord[]> {
  const res = await api<{ data: PropRecord[] } | PropRecord[]>(`/api/projects/${projectId}/props`, {
    noCache: true,
  });
  if (Array.isArray(res)) return res;
  return Array.isArray(res.data) ? res.data : [];
}

export async function patchProp(
  projectId: string,
  propId: string,
  body: { description?: string | null; holder?: string | null; continuity?: string | null }
): Promise<PropRecord> {
  return api<PropRecord>(`/api/projects/${projectId}/props/${propId}`, {
    method: "PATCH",
    body,
    noCache: true,
  });
}

export async function getWorldview(projectId: string): Promise<{ rules: WorldviewRule[] }> {
  return api<{ rules: WorldviewRule[] }>(`/api/projects/${projectId}/worldview`, {
    noCache: true,
  });
}

export async function putWorldview(
  projectId: string,
  rules: WorldviewRule[]
): Promise<{ rules: WorldviewRule[] }> {
  return api<{ rules: WorldviewRule[] }>(`/api/projects/${projectId}/worldview`, {
    method: "PUT",
    body: { rules },
    noCache: true,
  });
}
