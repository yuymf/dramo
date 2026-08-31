import { api } from "./client";

export type ShareMode = "invite" | "anyone_view" | "anyone_edit";

export async function getShare(projectId: string) {
  return api<{ shareToken: string; shareMode: ShareMode; sharePath: string; published: boolean; allowCopy: boolean }>(
    `/api/projects/${projectId}/share`,
    { noCache: true }
  );
}

export async function updateShare(projectId: string, shareMode: ShareMode) {
  return api(`/api/projects/${projectId}/share`, { method: "PATCH", body: { shareMode }, noCache: true });
}

export async function resolveShareToken(token: string) {
  return api<{ projectId: string; shareMode: ShareMode; type: string }>(`/api/share/${token}`, { noCache: true });
}

export async function listComments(projectId: string, query?: { anchorType?: string; anchorId?: string }) {
  const params = new URLSearchParams();
  if (query?.anchorType) params.set("anchorType", query.anchorType);
  if (query?.anchorId) params.set("anchorId", query.anchorId);
  const q = params.toString();
  return api<{ comments: Array<{ id: string; body: string; anchorId: string; user: { name: string | null; email: string } }> }>(
    `/api/projects/${projectId}/comments${q ? `?${q}` : ""}`,
    { noCache: true }
  );
}

export async function addComment(
  projectId: string,
  body: { anchorType: string; anchorId: string; body: string; episodeId?: string }
) {
  return api(`/api/projects/${projectId}/comments`, { method: "POST", body, noCache: true });
}

export async function listVersions(projectId: string) {
  return api<{ versions: Array<{ id: string; name: string | null; automatic: boolean; createdAt: string }> }>(
    `/api/projects/${projectId}/versions`,
    { noCache: true }
  );
}

export async function createVersion(projectId: string, name?: string) {
  return api(`/api/projects/${projectId}/versions`, { method: "POST", body: { name }, noCache: true });
}

export async function restoreVersion(projectId: string, versionId: string) {
  return api(`/api/projects/${projectId}/versions/${versionId}/restore`, { method: "POST", body: {}, noCache: true });
}

export async function publishProject(projectId: string, allowCopy = true) {
  return api(`/api/projects/${projectId}/publish`, { method: "POST", body: { allowCopy }, noCache: true });
}

export async function unpublishProject(projectId: string) {
  return api(`/api/projects/${projectId}/unpublish`, { method: "POST", body: {}, noCache: true });
}

export async function listLibrary() {
  return api<{ projects: Array<{ id: string; name: string; type: string; publishedAt: string | null; allowCopy: boolean }> }>(
    `/api/library`,
    { noCache: true }
  );
}

export async function getLibraryProject(projectId: string) {
  return api<{
    id: string;
    name: string;
    allowCopy: boolean;
    screenplay: { title: string; nodes: Array<{ id: string; type: string; text: string }> } | null;
  }>(`/api/library/${projectId}`, { noCache: true });
}

export async function copyLibraryProject(projectId: string) {
  return api<{ id: string }>(`/api/library/${projectId}/copy`, { method: "POST", body: {}, noCache: true });
}

export async function listDiscussions(projectId: string) {
  return api<{ discussions: Array<{ id: string; body: string; user: { name: string | null; email: string } }> }>(
    `/api/library/${projectId}/discussions`,
    { noCache: true }
  );
}

export async function addDiscussion(projectId: string, body: string) {
  return api(`/api/library/${projectId}/discussions`, { method: "POST", body: { body }, noCache: true });
}
