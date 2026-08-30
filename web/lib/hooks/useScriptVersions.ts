import { useState, useCallback } from 'react';
import { api } from '@/lib/api/client';

interface ScriptVersion {
  id: string;
  createdAt: string;
  snapshot?: string;
  summary?: string;
  version?: number;
  author?: string;
}

export function useScriptVersions(projectId: string, scriptId: string) {
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ data: ScriptVersion[] }>(
        `/api/projects/${projectId}/script/versions`
      );
      setVersions(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const revertToVersion = useCallback(async (versionId: string) => {
    await api(`/api/projects/${projectId}/script/versions/${versionId}/revert`, {
      method: 'POST',
    });
    await fetchVersions();
  }, [projectId, fetchVersions]);

  // scriptId is accepted for future use (e.g., per-script version filtering)
  void scriptId;

  return { versions, loading, fetchVersions, revertToVersion };
}
