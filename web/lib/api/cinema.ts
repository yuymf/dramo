import { api } from "./client";
import type { CinemaAssistTarget, ReelDoc, ReelShot } from "@/lib/types/cinema";

export async function listReels(projectId: string, episodeId: string): Promise<{ reels: ReelDoc[] }> {
  return api<{ reels: ReelDoc[] }>(`/api/projects/${projectId}/episodes/${episodeId}/reels`, {
    noCache: true,
  });
}

export async function createReel(
  projectId: string,
  episodeId: string,
  body?: { name?: string; previousReelId?: string }
): Promise<ReelDoc> {
  return api<ReelDoc>(`/api/projects/${projectId}/episodes/${episodeId}/reels`, {
    method: "POST",
    body: body ?? {},
    noCache: true,
  });
}

export async function getReel(projectId: string, reelId: string): Promise<ReelDoc> {
  return api<ReelDoc>(`/api/projects/${projectId}/reels/${reelId}`, { noCache: true });
}

export async function patchReel(
  projectId: string,
  reelId: string,
  body: {
    name?: string;
    sceneText?: string;
    performance?: string;
    shots?: ReelShot[];
    previousReelId?: string | null;
  }
): Promise<ReelDoc> {
  return api<ReelDoc>(`/api/projects/${projectId}/reels/${reelId}`, {
    method: "PATCH",
    body,
    noCache: true,
  });
}

export async function generateStoryboard(projectId: string, reelId: string): Promise<ReelDoc> {
  return api<ReelDoc>(`/api/projects/${projectId}/reels/${reelId}/storyboard`, {
    method: "POST",
    body: {},
    noCache: true,
  });
}

export async function generateReelImages(projectId: string, reelId: string): Promise<ReelDoc> {
  return api<ReelDoc>(`/api/projects/${projectId}/reels/${reelId}/images`, {
    method: "POST",
    body: {},
    noCache: true,
    timeoutMs: 180_000,
  });
}

export async function generateFilm(projectId: string, reelId: string): Promise<ReelDoc> {
  return api<ReelDoc>(`/api/projects/${projectId}/reels/${reelId}/films`, {
    method: "POST",
    body: {},
    noCache: true,
    timeoutMs: 180_000,
  });
}

export async function assistReel(
  projectId: string,
  reelId: string,
  body: { target: CinemaAssistTarget; instruction: string }
): Promise<{ reel: ReelDoc; applied: boolean; message: string }> {
  return api(`/api/projects/${projectId}/reels/${reelId}/assist`, {
    method: "POST",
    body,
    noCache: true,
    timeoutMs: 120_000,
  });
}
