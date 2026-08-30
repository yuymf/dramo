/**
 * 图片生成任务类型定义
 */

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface GenerationJob {
  id: string;
  userId: string;
  projectId: string;
  type?: 'image' | 'storyboard_import' | string;
  storyboardId?: string;
  frameId?: string;
  params: {
    name?: string;
    description?: string;
    text?: string;
    style?: string;
    colorGuide?: string;
    referenceImages?: string[];
    mode?: 'single' | 'sequence';
    assetType?: 'character' | 'location';
  };
  status: JobStatus;
  progress: number; // 0-100
  queuePosition?: number;
  resultUrl?: string;
  result?: unknown;
  error?: {
    message: string;
    code?: string;
    retryable?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface JobEvent {
  jobId: string;
  status: JobStatus;
  progress?: number;
  queuePosition?: number;
  resultUrl?: string;
  error?: {
    message: string;
    code?: string;
    retryable?: boolean;
  };
}

export interface CreateJobRequest {
  projectId: string;
  storyboardId?: string;
  frameId?: string;
  params: {
    name: string;
    description: string;
    style?: string;
    colorGuide?: string;
    referenceImages?: string[];
    mode?: 'single' | 'sequence';
    assetType?: 'character' | 'location';
  };
}

export interface CreateJobResponse {
  jobId: string;
}

export interface ListJobsRequest {
  status?: JobStatus | JobStatus[];
  limit?: number;
  offset?: number;
}

export interface ListJobsResponse {
  jobs: GenerationJob[];
  total: number;
}

