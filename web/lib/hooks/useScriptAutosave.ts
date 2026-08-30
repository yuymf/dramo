import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api/client';

type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

interface UseScriptAutosaveOptions {
  projectId: string;
  debounceMs?: number;
}

interface ScriptContent {
  scenes: unknown;
  acts?: unknown;
}

export function useScriptAutosave({ projectId, debounceMs = 1500 }: UseScriptAutosaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (content: ScriptContent) => {
    if (!projectId) return;
    setSaveStatus('saving');
    try {
      await api(`/api/projects/${projectId}/script/content`, {
        method: 'PATCH',
        body: {
          scenes: content.scenes,
          acts: content.acts,
        },
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [projectId]);

  const scheduleSave = useCallback((content: ScriptContent) => {
    setSaveStatus('unsaved');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(content), debounceMs);
  }, [save, debounceMs]);

  const saveNow = useCallback((content: ScriptContent) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    return save(content);
  }, [save]);

  return { saveStatus, scheduleSave, saveNow };
}
