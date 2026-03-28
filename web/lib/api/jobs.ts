/**
 * 图片生成任务 API 客户端
 */
import { api } from './client';
import type {
  GenerationJob,
  CreateJobRequest,
  CreateJobResponse,
  ListJobsRequest,
  ListJobsResponse,
} from '../types/generation-job';

/**
 * 创建图片生成任务
 */
export async function createGenerationJob(
  request: CreateJobRequest
): Promise<CreateJobResponse> {
  return api<CreateJobResponse>('/api/images/generations', {
    method: 'POST',
    body: request,
  });
}

/**
 * 获取任务列表
 */
export async function listJobs(
  request: ListJobsRequest = {}
): Promise<ListJobsResponse> {
  const params = new URLSearchParams();
  
  if (request.status) {
    const statuses = Array.isArray(request.status) ? request.status : [request.status];
    statuses.forEach(s => params.append('status', s));
  }
  
  if (request.limit) {
    params.set('limit', String(request.limit));
  }
  
  if (request.offset) {
    params.set('offset', String(request.offset));
  }
  
  const queryString = params.toString();
  const url = `/api/jobs${queryString ? `?${queryString}` : ''}`;
  
  return api<ListJobsResponse>(url, { method: 'GET' });
}

/**
 * 获取单个任务详情
 */
export async function getJob(jobId: string): Promise<GenerationJob> {
  return api<GenerationJob>(`/api/jobs/${jobId}`, { method: 'GET' });
}

/**
 * 取消任务
 */
export async function cancelJob(jobId: string): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/api/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
}

/**
 * 重试失败的任务
 */
export async function retryJob(jobId: string): Promise<CreateJobResponse> {
  return api<CreateJobResponse>(`/api/jobs/${jobId}/retry`, {
    method: 'POST',
  });
}

