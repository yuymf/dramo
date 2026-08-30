import { api } from './client';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/**
 * List all chat sessions for a project.
 */
export async function listSessions(projectId: string): Promise<ChatSession[]> {
  const res = await api<{ data: ChatSession[] }>(
    `/api/chat/${projectId}/sessions`
  );
  return res.data || [];
}

/**
 * Create a new chat session.
 */
export async function createSession(
  projectId: string,
  title?: string
): Promise<ChatSession> {
  const res = await api<{ data: ChatSession }>(
    `/api/chat/${projectId}/sessions`,
    {
      method: 'POST',
      body: title ? { title } : {},
    }
  );
  return res.data;
}

/**
 * Rename a chat session.
 */
export async function renameSession(
  projectId: string,
  sessionId: string,
  title: string
): Promise<ChatSession> {
  const res = await api<{ data: ChatSession }>(
    `/api/chat/${projectId}/sessions/${sessionId}`,
    {
      method: 'PATCH',
      body: { title },
    }
  );
  return res.data;
}

/**
 * Delete a chat session (and its messages).
 */
export async function deleteSession(
  projectId: string,
  sessionId: string
): Promise<void> {
  await api(`/api/chat/${projectId}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

