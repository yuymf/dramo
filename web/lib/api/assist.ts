import { api } from "./client";
import { firstEpisodeId } from "./planning";

export { firstEpisodeId };

export interface KnowledgeFile {
  id: string;
  projectId: string;
  name: string;
  filename: string;
  mime: string;
  text: string;
  createdAt: string;
}

export interface Advisor {
  id: string;
  name: string;
  summary: string;
}

export interface ColdStartDoc {
  gate: number;
  premise: {
    character: string;
    desire: string;
    obstacle: string;
    cost: string;
    format: string;
  };
  structure: { causality: string; ending: string };
  beatsNote: string;
  entitiesNote: string;
  writingNote: string;
}

export interface DoctorNote {
  id: string;
  priority: "high" | "med" | "low";
  area: "scene" | "character" | "conflict" | "theme";
  title: string;
  body: string;
}

export async function listKnowledge(projectId: string): Promise<KnowledgeFile[]> {
  const res = await api<{ data: KnowledgeFile[] }>(`/api/projects/${projectId}/knowledge`, {
    noCache: true,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createKnowledge(
  projectId: string,
  body: { name: string; filename: string; text: string; mime?: string }
): Promise<KnowledgeFile> {
  return api<KnowledgeFile>(`/api/projects/${projectId}/knowledge`, {
    method: "POST",
    body,
    noCache: true,
  });
}

export async function deleteKnowledge(projectId: string, fileId: string): Promise<void> {
  await api(`/api/projects/${projectId}/knowledge/${fileId}`, {
    method: "DELETE",
    noCache: true,
  });
}

export async function getAdvisor(projectId: string): Promise<{ advisors: Advisor[]; hired: Advisor | null }> {
  return api(`/api/projects/${projectId}/advisor`, { noCache: true });
}

export async function putAdvisor(
  projectId: string,
  id: string | null
): Promise<{ advisors: Advisor[]; hired: Advisor | null }> {
  return api(`/api/projects/${projectId}/advisor`, {
    method: "PUT",
    body: { id },
    noCache: true,
  });
}

export async function getColdStart(projectId: string, episodeId: string): Promise<ColdStartDoc> {
  return api(`/api/projects/${projectId}/episodes/${episodeId}/cold-start`, { noCache: true });
}

export async function putColdStart(
  projectId: string,
  episodeId: string,
  body: ColdStartDoc
): Promise<ColdStartDoc> {
  return api(`/api/projects/${projectId}/episodes/${episodeId}/cold-start`, {
    method: "PUT",
    body,
    noCache: true,
  });
}

export async function getDoctor(projectId: string, episodeId: string): Promise<{ notes: DoctorNote[] }> {
  return api(`/api/projects/${projectId}/episodes/${episodeId}/doctor`, { noCache: true });
}

export async function requestMicroContinue(
  projectId: string,
  episodeId: string,
  afterNodeId: string
): Promise<{ suggestion: string }> {
  return api(`/api/projects/${projectId}/episodes/${episodeId}/micro-continue`, {
    method: "POST",
    body: { afterNodeId },
    noCache: true,
  });
}
