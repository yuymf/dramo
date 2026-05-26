/**
 * 全局图片生成任务状态管理
 */
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import useSWR from 'swr';
import type { GenerationJob, ListJobsResponse } from '../types/generation-job';
import { listJobs } from '../api/jobs';

interface GenerationJobsContextValue {
  jobs: Map<string, GenerationJob>;
  activeCount: number;
  updateJob: (jobId: string, updates: Partial<GenerationJob>) => void;
  addJob: (job: GenerationJob) => void;
  removeJob: (jobId: string) => void;
  getJob: (jobId: string) => GenerationJob | undefined;
  refreshJobs: (immediate?: boolean) => Promise<void>;
}

const GenerationJobsContext = createContext<GenerationJobsContextValue | null>(null);

export function GenerationJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Map<string, GenerationJob>>(new Map());
  const refreshTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const lastRefreshTimeRef = React.useRef<number>(0);
  const retryCountRef = useRef(0);
  const jobsRef = useRef(jobs);

  // Keep ref in sync with state
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // 计算进行中的任务数量
  const activeCount = useMemo(
    () => Array.from(jobs.values()).filter(
      job => job.status === 'queued' || job.status === 'running'
    ).length,
    [jobs]
  );

  /**
   * 将服务端返回的任务列表合并到本地 Map 状态，并清理过期条目。
   * 同时被 SWR onSuccess 回调和 refreshJobs 手动刷新共用。
   */
  const mergeJobsFromServer = useCallback((data: ListJobsResponse) => {
    setJobs(prev => {
      const newMap = new Map(prev);

      // Update with fresh data from server
      data.jobs.forEach(job => {
        newMap.set(job.id, job);
      });

      // Remove active jobs that are no longer returned by the server
      const activeJobIds = new Set(data.jobs.map(j => j.id));
      for (const [id, job] of newMap) {
        if (!activeJobIds.has(id) && (job.status === 'queued' || job.status === 'running')) {
          // Job was active locally but not returned by server — remove it
          newMap.delete(id);
        }
        // Also clean up terminal jobs older than 5 minutes
        if (
          (job.status === 'succeeded' || job.status === 'failed' || job.status === 'canceled') &&
          job.updatedAt &&
          Date.now() - new Date(job.updatedAt).getTime() > 5 * 60 * 1000
        ) {
          newMap.delete(id);
        }
      }

      return newMap;
    });
  }, []);

  // SWR key: always poll for active jobs
  const swrKey = '/api/jobs?status=queued&status=running&limit=100';

  // SWR handles initial load and background polling.
  // Polling is active (every 3 s) only while there are queued/running jobs;
  // otherwise polling stops until the next focus/reconnect revalidation.
  useSWR<ListJobsResponse>(
    swrKey,
    () => listJobs({ status: ['queued', 'running'], limit: 100 }),
    {
      refreshInterval: (data) => {
        const hasPending = data?.jobs?.some(
          j => j.status === 'queued' || j.status === 'running'
        );
        return hasPending ? 3000 : 0;
      },
      onSuccess: mergeJobsFromServer,
      revalidateOnFocus: false,
    }
  );

  const updateJob = useCallback((jobId: string, updates: Partial<GenerationJob>) => {
    setJobs(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(jobId);
      if (existing) {
        newMap.set(jobId, { ...existing, ...updates, updatedAt: new Date().toISOString() });
      }
      return newMap;
    });
  }, []);

  const addJob = useCallback((job: GenerationJob) => {
    setJobs(prev => {
      const newMap = new Map(prev);
      newMap.set(job.id, job);
      return newMap;
    });
  }, []);

  const removeJob = useCallback((jobId: string) => {
    setJobs(prev => {
      const newMap = new Map(prev);
      newMap.delete(jobId);
      return newMap;
    });
  }, []);

  const getJob = useCallback((jobId: string) => {
    return jobsRef.current.get(jobId);
  }, []);

  const refreshJobs = useCallback(async (immediate = false) => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

    // 如果不是立即刷新且距离上次刷新时间小于5秒，则跳过
    if (!immediate && timeSinceLastRefresh < 5000) {
      return;
    }

    lastRefreshTimeRef.current = now;

    try {
      // 获取进行中和排队中的任务
      const response = await listJobs({
        status: ['queued', 'running'],
        limit: 100,
      });

      mergeJobsFromServer(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage?.includes('429') || errorMessage?.includes('RATE_LIMITED')) {
        // Exponential backoff with max 3 retries
        if (retryCountRef.current < 3) {
          const delay = Math.min(5000 * Math.pow(2, retryCountRef.current), 30000);
          retryCountRef.current += 1;
          refreshTimeoutRef.current = setTimeout(() => {
            refreshJobs(true);
          }, delay);
        } else {
          console.warn('[GenerationJobs] Max retries reached for rate-limited refresh');
          retryCountRef.current = 0;
        }
        return;
      }

      // Log non-rate-limit errors instead of silently swallowing
      console.error('[GenerationJobs] Failed to refresh jobs:', error);
      retryCountRef.current = 0;
    }
  }, [mergeJobsFromServer]);

  // Clean up any pending retry timeouts on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const value: GenerationJobsContextValue = {
    jobs,
    activeCount,
    updateJob,
    addJob,
    removeJob,
    getJob,
    refreshJobs,
  };

  return (
    <GenerationJobsContext.Provider value={value}>
      {children}
    </GenerationJobsContext.Provider>
  );
}

export function useGenerationJobs() {
  const context = useContext(GenerationJobsContext);
  if (!context) {
    throw new Error('useGenerationJobs must be used within GenerationJobsProvider');
  }
  return context;
}
