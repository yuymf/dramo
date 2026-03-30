"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api/client";

interface TaskData {
  taskId: string;
  status: string;
  progress: number;
  result: unknown;
  error: { code: string; message: string; retryable: boolean } | null;
  createdAt: string;
  updatedAt: string;
  estimatedSeconds: number | null;
}

interface UseTaskPollingOptions {
  /** Polling interval in milliseconds (default: 3000) */
  intervalMs?: number;
  /** Whether polling is enabled (default: true when taskId is provided) */
  enabled?: boolean;
}

interface UseTaskPollingResult {
  /** Current task status */
  status: string | null;
  /** Progress percentage (0-100) */
  progress: number;
  /** Task result when completed */
  result: unknown;
  /** Error info when failed */
  error: { code: string; message: string; retryable: boolean } | null;
  /** Whether we're still polling */
  isPolling: boolean;
  /** Estimated total seconds */
  estimatedSeconds: number | null;
  /** Stop polling manually */
  stopPolling: () => void;
}

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export function useTaskPolling(
  taskId: string | null,
  options?: UseTaskPollingOptions
): UseTaskPollingResult {
  const { intervalMs = 3000, enabled = true } = options ?? {};

  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<{ code: string; message: string; retryable: boolean } | null>(null);
  const [estimatedSeconds, setEstimatedSeconds] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  const stopPolling = useCallback(() => {
    stoppedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!taskId || !enabled) {
      stopPolling();
      return;
    }

    // Reset state for new task
    stoppedRef.current = false;
    setStatus(null);
    setProgress(0);
    setResult(null);
    setError(null);
    setEstimatedSeconds(null);
    setIsPolling(true);

    const poll = async () => {
      if (stoppedRef.current) return;

      try {
        const data = await api<TaskData>(`/api/tasks/${taskId}`, {
          timeoutMs: 10000,
          noCache: true,
        });

        if (stoppedRef.current) return;

        setStatus(data.status);
        setProgress(data.progress);
        setEstimatedSeconds(data.estimatedSeconds);

        if (data.status === "completed") {
          setResult(data.result);
          stopPolling();
        } else if (data.status === "failed") {
          setError(
            (data.error as { code: string; message: string; retryable: boolean }) ?? {
              code: "UNKNOWN",
              message: "Task failed",
              retryable: false,
            }
          );
          stopPolling();
        } else if (TERMINAL_STATUSES.has(data.status)) {
          stopPolling();
        }
      } catch (err) {
        // Network errors during polling are transient — keep polling
        console.warn("[useTaskPolling] Poll error:", err);
      }
    };

    // Immediate first poll
    poll();

    // Set up interval
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      stoppedRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [taskId, enabled, intervalMs, stopPolling]);

  return {
    status,
    progress,
    result,
    error,
    isPolling,
    estimatedSeconds,
    stopPolling,
  };
}
