import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api/client';

type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

interface UseScriptAutosaveOptions {
  scriptId: string;
  debounceMs?: number;
}

export function useScriptAutosave({ scriptId, debounceMs = 1500 }: UseScriptAutosaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (content: string) => {
    setSaveStatus('saving');
    try {
      await api(`/api/scripts/${scriptId}`, {
        method: 'PATCH',
        body: JSON.stringify({ scenes: content }),
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [scriptId]);

  const scheduleSave = useCallback((content: string) => {
    setSaveStatus('unsaved');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(content), debounceMs);
  }, [save, debounceMs]);

  const saveNow = useCallback((content: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    return save(content);
  }, [save]);

  return { saveStatus, scheduleSave, saveNow };
}
