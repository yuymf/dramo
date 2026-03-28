export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const MAX_CACHE_SIZE = 100;

function getCacheKey(path: string, headers?: Record<string, string>): string {
  return `${path}::${JSON.stringify(headers ?? {})}`;
}

/**
 * Evict expired entries and enforce max cache size
 */
function evictCache(ttlMs: number): void {
  const now = Date.now();
  // Remove expired entries
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > ttlMs) {
      cache.delete(key);
    }
  }
  // If still over max size, remove oldest entries
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      cache.delete(key);
    }
  }
}

/**
 * 统一的API客户端
 * 所有请求通过Next.js API Routes代理到后端
 * 认证通过Cookie在服务端处理，客户端无需手动添加认证头
 */
export async function api<T>(
  path: string,
  options?: { 
    method?: HttpMethod; 
    body?: unknown; 
    headers?: Record<string, string>;
    cacheTtlMs?: number;
    noCache?: boolean;
    timeoutMs?: number;
  }
): Promise<T> {
  const method = options?.method ?? 'GET';
  
  // 检查是否为 FormData
  const isFormData = options?.body instanceof FormData;
  
  // 构建请求头
  // 注意：认证token通过Cookie在服务端处理，客户端不需要手动添加
  const headers: Record<string, string> = {
    // 只有当有 body 且不是 FormData 时才设置 Content-Type
    // 避免 DELETE 等无 body 请求时 Fastify 报错：Body cannot be empty when content-type is set to 'application/json'
    ...(!isFormData && options?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options?.headers ?? {}),
  };

  // 客户端缓存检查（仅GET请求）
  if (method === 'GET' && !options?.noCache && options?.cacheTtlMs) {
    const cacheKey = getCacheKey(path, headers);
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < options.cacheTtlMs) {
      return cached.data as T;
    }
  }

  // 统一使用相对路径，通过Next.js API Routes代理
  // 确保路径以/api开头
  const apiPath = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  
  // 设置超时控制器
  const controller = new AbortController();
  const timeoutId = options?.timeoutMs 
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : undefined;
  
  try {
    // 发送请求到Next.js API Route（相对路径）
    const res = await fetch(apiPath, {
      method,
      headers,
      // 如果是 FormData，直接传递；否则 JSON.stringify
      body: options?.body ? (isFormData ? options.body as BodyInit : JSON.stringify(options.body)) : undefined,
      cache: 'no-store',
      signal: controller.signal,
      credentials: 'include', // 包含Cookie，用于认证
    });
    
    if (timeoutId) clearTimeout(timeoutId);
    
    if (!res.ok) {
      // 读取响应体（只能读取一次）
      const contentType = res.headers.get('content-type') || '';
      let errorMessage = `请求失败 (${res.status})`;
      let errorCode: string | undefined;
      let retryable: boolean | undefined;
      
      try {
        // 先读取响应文本
        const responseText = await res.text();
        
        if (responseText) {
          // 尝试解析JSON格式的错误响应
          if (contentType.includes('application/json')) {
            try {
              const errorData = JSON.parse(responseText);
              // 优先使用结构化的错误消息
              if (errorData.error?.message) {
                errorMessage = errorData.error.message;
                errorCode = errorData.error.code;
                retryable = errorData.error.retryable;
              } else if (errorData.message) {
                errorMessage = errorData.message;
              } else if (typeof errorData === 'string') {
                errorMessage = errorData;
              } else {
                // 如果无法提取消息，使用默认格式
                errorMessage = `请求失败 (${res.status})`;
              }
            } catch (parseError) {
              console.warn('[API Client] Failed to parse error JSON:', parseError);
              // JSON解析失败，使用原始文本（限制长度）
              const truncated = responseText.length > 200 ? responseText.substring(0, 200) + '...' : responseText;
              errorMessage = `请求失败: ${truncated}`;
            }
          } else {
            // 非JSON响应，直接使用文本（限制长度）
            const truncated = responseText.length > 200 ? responseText.substring(0, 200) + '...' : responseText;
            errorMessage = `请求失败: ${truncated}`;
          }
        }
      } catch (readError) {
        // 读取响应失败，使用默认错误信息
        console.error('[API Client] Failed to read error response:', readError);
        errorMessage = `请求失败 (${res.status})`;
      }
      
      // 创建自定义错误，包含更多信息
      const apiError = new Error(errorMessage) as Error & {
        status?: number;
        code?: string;
        retryable?: boolean;
        path?: string;
      };
      apiError.status = res.status;
      apiError.path = apiPath;
      if (errorCode) apiError.code = errorCode;
      if (retryable !== undefined) apiError.retryable = retryable;

      // Trigger upgrade dialog for plan limit errors
      if (errorCode === 'PLAN_LIMIT_EXCEEDED') {
        try {
          const { getUpgradeDialogCallback } = await import('@/components/billing/SubscriptionProvider');
          const showUpgrade = getUpgradeDialogCallback();
          if (showUpgrade) showUpgrade();
        } catch {
          // SubscriptionProvider not mounted — ignore
        }
      }

      throw apiError;
    }
    
    // 解析响应
    const ct = res.headers.get('content-type') ?? '';
    const data = (ct.includes('application/json') ? await res.json() : await res.text()) as T;

    // 更新客户端缓存（仅GET请求）
    if (method === 'GET' && !options?.noCache && options?.cacheTtlMs) {
      const cacheKey = getCacheKey(path, headers);
      evictCache(options.cacheTtlMs);
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    
    // 处理超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`API ${method} ${apiPath} timeout after ${options?.timeoutMs}ms`);
    }
    
    throw error;
  }
}

/**
 * 刷新灵感推荐
 * @deprecated 使用 recommendInspirations 代替
 */
export async function refreshInspirations(params: {
  projectId: string;
  locale?: string;
}) {
  // 迁移到新接口
  return api<{ data: Array<{ id: string; text: string; category: string; relevance?: number; source?: string }> }>(
    `/api/inspirations/${params.projectId}/recommend`,
    {
      method: 'POST',
      body: {
        category: undefined, // 可以后续添加分类过滤
      },
    }
  ).then(response => ({
    inspirations: response.data || [],
  }));
}

/**
 * 推荐灵感（新接口）
 */
export async function recommendInspirations(params: {
  projectId: string;
  script?: unknown;
  position?: {
    actOrder?: number;
    sceneOrder?: number;
    blockOrder?: number;
  };
  category?: 'quotes' | 'topics' | 'interactions' | 'hotspots';
}) {
  return api<{ data: Array<{ id: string; text: string; category: string; relevance?: number; source?: string }> }>(
    `/api/inspirations/${params.projectId}/recommend`,
    {
      method: 'POST',
      body: {
        script: params.script,
        position: params.position,
        category: params.category,
      },
    }
  );
}

/**
 * 上传图片（V2：返回 url + path）
 */
export async function uploadImageV2(params: {
  projectId: string;
  base64Data: string;
}) {
  return api<{ success: boolean; url: string; path: string }>(
    `/api/projects/${params.projectId}/uploads/image-v2`,
    {
      method: 'POST',
      body: { base64Data: params.base64Data },
    }
  );
}

/**
 * 统一图片生成接口（支持 referencePaths）
 */
export async function generateImageUnified(params: {
  projectId: string;
  name: string;
  description: string;
  style?: string;
  referenceImages?: string[];
  mode?: 'single' | 'sequence';
  assetType?: 'character' | 'location';
}) {
  return api<{
    success: boolean;
    mode: string;
    type: string;
    images: Array<{
      id: string;
      url: string;
      source: string;
      createdAt: string;
    }>;
  }>(
    `/api/projects/${params.projectId}/generate-image`,
    {
      method: 'POST',
      body: {
        name: params.name,
        description: params.description,
        style: params.style,
        referenceImages: params.referenceImages,
        mode: params.mode,
        assetType: params.assetType,
      },
      timeoutMs: 100000, // 100 seconds timeout for image generation
    }
  );
}

// Storyboard Data API
export async function getStoryboardData(projectId: string) {
  return api<{ success: boolean; frames: unknown[] }>(
    `/api/projects/${projectId}/storyboard-data`,
    { method: 'GET' }
  );
}

export async function saveStoryboardData(projectId: string, frames: unknown[]) {
  return api<{ success: boolean; updatedAt: string }>(
    `/api/projects/${projectId}/storyboard-data`,
    {
      method: 'PUT',
      body: { frames },
    }
  );
}
