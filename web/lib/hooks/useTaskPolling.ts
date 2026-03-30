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
  /** Maximum consecutive poll failures before giving up (default: 20 → ~60s at 3s interval) */
  maxConsecutiveErrors?: number;
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
  const { intervalMs = 3000, maxConsecutiveErrors = 20, enabled = true } = options ?? {};

  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<{ code: string; message: string; retryable: boolean } | null>(null);
  const [estimatedSeconds, setEstimatedSeconds] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);
  const errorCountRef = useRef(0);

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
    errorCountRef.current = 0;
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

        // Reset error counter on successful poll
        errorCountRef.current = 0;

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
          // Handles "cancelled" and any future terminal statuses
          setError({
            code: "TASK_CANCELLED",
            message: "任务已取消",
            retryable: false,
          });
          stopPolling();
        }
      } catch (err) {
        errorCountRef.current += 1;

        if (errorCountRef.current >= maxConsecutiveErrors) {
          console.error(
            `[useTaskPolling] ${errorCountRef.current} consecutive poll failures, giving up:`,
            err
          );
          setError({
            code: "POLL_FAILED",
            message: "无法获取任务状态，请刷新页面重试",
            retryable: true,
          });
          stopPolling();
        } else {
          console.warn(
            `[useTaskPolling] Poll error (${errorCountRef.current}/${maxConsecutiveErrors}):`,
            err
          );
        }
      }
    };

    // Immediate first poll
    poll();

    // Set up interval
    intervalRef.current = setInterval(poll, intervalMs);

    // Cleanup on unmount — avoid calling setIsPolling on unmounted component
    return () => {
      stoppedRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [taskId, enabled, intervalMs, maxConsecutiveErrors, stopPolling]);

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
