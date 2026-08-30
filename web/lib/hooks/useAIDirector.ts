import { useState, useCallback } from 'react';

interface DirectorSuggestion {
  type: 'pacing' | 'character' | 'conflict';
  suggestion: string;
  sceneIndex: number;
  severity: 'low' | 'medium' | 'high';
}

export function useAIDirector(projectId: string, scriptId: string) {
  const [suggestions, setSuggestions] = useState<DirectorSuggestion[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (scriptContext: unknown) => {
    setIsStreaming(true);
    setError(null);
    setSuggestions([]);

    try {
      const res = await fetch(`/api/projects/${projectId}/scripts/${scriptId}/director`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptContext }),
      });

      if (!res.ok) {
        throw new Error(`Director analysis failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5));
              if (data?.type) setSuggestions((prev) => [...prev, data as DirectorSuggestion]);
            } catch { /* skip malformed lines */ }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, scriptId]);

  return { suggestions, isStreaming, error, analyze };
}
