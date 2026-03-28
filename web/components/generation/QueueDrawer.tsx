/**
 * QueueDrawer - 任务队列侧边抽屉
 */
"use client";

import { useMemo, useState } from 'react';
import Image from "next/image";
import { X, Loader2, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useGenerationJobs } from '@/lib/hooks/useGenerationJobs';
import { cancelJob, retryJob } from '@/lib/api/jobs';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import type { GenerationJob, JobStatus } from '@/lib/types/generation-job';

interface QueueDrawerProps {
  open: boolean;
  onClose: () => void;
}

type TabType = 'active' | 'completed' | 'all';

export function QueueDrawer({ open, onClose }: QueueDrawerProps) {
  const { jobs, updateJob, refreshJobs } = useGenerationJobs();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  // 按 tab 过滤任务
  const filteredJobs = useMemo(() => {
    const jobsArray = Array.from(jobs.values());
    
    switch (activeTab) {
      case 'active':
        return jobsArray.filter(j => j.status === 'queued' || j.status === 'running');
      case 'completed':
        return jobsArray.filter(j => j.status === 'succeeded' || j.status === 'failed' || j.status === 'canceled');
      case 'all':
      default:
        return jobsArray;
    }
  }, [jobs, activeTab]);

  // 按创建时间降序排序
  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filteredJobs]);

  const handleCancel = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      updateJob(jobId, { status: 'canceled' });
      showToast('任务已取消', 'success');
    } catch (error) {
      console.error('Failed to cancel job:', error);
      showToast('取消失败', 'error');
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryJob(jobId);
      showToast('任务已重新加入队列', 'success');
      await refreshJobs();
    } catch (error) {
      console.error('Failed to retry job:', error);
      showToast('重试失败', 'error');
    }
  };

  const handleBatchCancel = async () => {
    const promises = Array.from(selectedJobs).map(id => handleCancel(id));
    await Promise.all(promises);
    setSelectedJobs(new Set());
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold jp-serif">生成队列</h2>
            <p className="text-sm text-slate-500 mt-1">
              {filteredJobs.length} 个任务
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-slate-200 flex gap-4">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'active'
                ? "bg-orange-100 text-orange-700"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            进行中
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'completed'
                ? "bg-orange-100 text-orange-700"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            已完成
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'all'
                ? "bg-orange-100 text-orange-700"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            全部
          </button>
        </div>

        {/* Batch Actions */}
        {selectedJobs.size > 0 && (
          <div className="px-6 py-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
            <span className="text-sm text-orange-800">
              已选择 {selectedJobs.size} 个任务
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBatchCancel}
                className="px-3 py-1.5 text-sm bg-white border border-orange-300 text-orange-700 rounded hover:bg-orange-50 transition-colors"
              >
                批量取消
              </button>
              <button
                onClick={() => setSelectedJobs(new Set())}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
              >
                清除选择
              </button>
            </div>
          </div>
        )}

        {/* Job List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sortedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Clock className="w-12 h-12 mb-3" />
              <p className="text-sm">暂无任务</p>
            </div>
          ) : (
            sortedJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                selected={selectedJobs.has(job.id)}
                onToggleSelect={() => toggleJobSelection(job.id)}
                onCancel={() => handleCancel(job.id)}
                onRetry={() => handleRetry(job.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

interface JobCardProps {
  job: GenerationJob;
  selected: boolean;
  onToggleSelect: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

function JobCard({ job, selected, onToggleSelect, onCancel, onRetry }: JobCardProps) {
  const statusConfig = getStatusConfig(job.status);

  return (
    <div
      className={cn(
        "border rounded-lg p-4 transition-all",
        selected ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1 w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <h3 className="font-medium text-sm truncate">{job.params.name}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {job.params.description}
              </p>
            </div>
            
            {/* Status Badge */}
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
              statusConfig.className
            )}>
              {statusConfig.icon}
              {statusConfig.label}
            </div>
          </div>

          {/* Progress Bar */}
          {(job.status === 'queued' || job.status === 'running') && (
            <div className="mt-3 mb-2">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>
                  {job.status === 'queued' ? `队列位置: ${job.queuePosition ?? '...'}` : '生成中'}
                </span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-pink-500 transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {job.error && (
            <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{job.error.message}</span>
              </div>
            </div>
          )}

          {/* Reference Images */}
          {job.params.referenceImages && job.params.referenceImages.length > 0 && (
            <div className="mt-2 flex gap-1">
              {job.params.referenceImages.slice(0, 4).map((img, idx) => (
                <div key={idx} className="relative w-10 h-10 rounded border border-slate-200 overflow-hidden">
                  <Image
                    src={img}
                    alt={`参考 ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="40px"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            {(job.status === 'queued' || job.status === 'running') && (
              <button
                onClick={onCancel}
                className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
            )}
            {job.status === 'failed' && job.error?.retryable !== false && (
              <button
                onClick={onRetry}
                className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
              >
                重试
              </button>
            )}
            {job.status === 'succeeded' && job.resultUrl && (
              <>
                <a
                  href={job.resultUrl}
                  download
                  className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                >
                  下载
                </a>
                <button
                  disabled
                  title="功能开发中"
                  className="px-3 py-1 text-xs bg-orange-500/50 text-white rounded cursor-not-allowed transition-colors"
                >
                  插入到分镜
                </button>
              </>
            )}
            
            <span className="ml-auto text-xs text-slate-400">
              {new Date(job.createdAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusConfig(status: JobStatus) {
  switch (status) {
    case 'queued':
      return {
        label: '排队中',
        icon: <Clock className="w-3.5 h-3.5" />,
        className: 'bg-blue-100 text-blue-700',
      };
    case 'running':
      return {
        label: '生成中',
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
        className: 'bg-orange-100 text-orange-700',
      };
    case 'succeeded':
      return {
        label: '已完成',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        className: 'bg-green-100 text-green-700',
      };
    case 'failed':
      return {
        label: '失败',
        icon: <XCircle className="w-3.5 h-3.5" />,
        className: 'bg-red-100 text-red-700',
      };
    case 'canceled':
      return {
        label: '已取消',
        icon: <XCircle className="w-3.5 h-3.5" />,
        className: 'bg-slate-100 text-slate-700',
      };
  }
}

