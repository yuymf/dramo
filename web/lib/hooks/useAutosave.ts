/**
 * Autosave hook for draft persistence to localStorage
 */
import { useEffect, useRef } from "react";
import { saveJSON } from "@/lib/storage/local";

interface UseAutosaveOptions<T> {
  data: T | null;
  key: string;
  interval?: number;
  onSave?: (timestamp: number) => void;
}

export function useAutosave<T>({
  data,
  key,
  interval = 10000,
  onSave,
}: UseAutosaveOptions<T>) {
  const dataRef = useRef(data);
  const lastSavedRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    function save() {
      if (!dataRef.current) return;

      const currentData = JSON.stringify(dataRef.current);
      if (currentData === lastSavedRef.current) return;

      saveJSON(key, dataRef.current);
      lastSavedRef.current = currentData;
      const now = Date.now();
      if (onSaveRef.current) onSaveRef.current(now);
    }

    timerRef.current = setInterval(save, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [key, interval]);
}
