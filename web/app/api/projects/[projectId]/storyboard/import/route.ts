import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

// 设置较长的超时时间，因为AgentOS处理长文本需要时间
// Vercel Hobby 的 maxDuration 只能在 1~300 秒
// 本地开发不受限制
export const maxDuration = 300; // 5分钟

/**
 * POST /api/projects/{projectId}/storyboard/import
 * 从文本或文件生成分镜JSON，代理到后端
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: '未认证，请重新登录',
          retryable: false,
        },
      },
      { status: 401 }
    );
  }

  const authHeader = `Bearer ${session.backendToken}`;
  const backendUrl =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:12321';
  const agentosUrl = process.env.AGENTOS_BASE_URL || 'http://localhost:12322';
  
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // 提前读取并保存 request body（只能读取一次）
    let requestBody: string | FormData;
    let requestText: string | null = null;
    
    if (contentType.includes('multipart/form-data')) {
      requestBody = await request.formData();
    } else {
      requestBody = await request.text();
      try {
        const parsed = JSON.parse(requestBody);
        requestText = parsed?.text;
      } catch (e) {
        console.error('[storyboard/import] Failed to parse JSON body:', e);
      }
    }
    
    // For JSON text requests: try AgentOS first, fallback to backend
    if (requestText) {
      try {
        console.log(`[POST /api/projects/${projectId}/storyboard/import] Calling AgentOS StoryboardWorkflow`);
        
        // Call AgentOS StoryboardWorkflow
        const form = new URLSearchParams();
        form.set('message', JSON.stringify({ projectId, text: requestText }));
        form.set('stream', 'false');
        
        const agentosStartTime = Date.now();
        const agentRes = await fetch(`${agentosUrl}/workflows/storyboardworkflow/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
          signal: AbortSignal.timeout(300000), // 5 minutes
        });
        const agentosDuration = ((Date.now() - agentosStartTime) / 1000).toFixed(2);
        console.log(`[storyboard/import] AgentOS responded in ${agentosDuration}s with status ${agentRes.status}`);
        
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          if (agentData.content) {
            try {
              const storyboard = JSON.parse(agentData.content);
              console.log(`[storyboard/import] AgentOS success: ${storyboard.scenes?.length || 0} scenes`);
              return NextResponse.json(storyboard);
            } catch (e) {
              console.error('[storyboard/import] Failed to parse AgentOS content:', e);
              console.error('[storyboard/import] Content preview:', agentData.content.substring(0, 200));
            }
          } else {
            console.error('[storyboard/import] AgentOS response missing content field');
          }
        } else {
          const errorText = await agentRes.text().catch(() => '');
          console.error(`[storyboard/import] AgentOS error ${agentRes.status}: ${errorText.substring(0, 500)}`);
        }
      } catch (e: unknown) {
        const error = e as Error;
        console.error('[storyboard/import] AgentOS exception:', error.message, error.name);
        console.log('[storyboard/import] Falling back to backend proxy');
      }
    }
    
    console.log(`[POST /api/projects/${projectId}/storyboard/import] Proxying to backend...`);
    let backendRequest: RequestInit;

    // 处理 FormData (文件上传)
    if (contentType.includes('multipart/form-data')) {
      backendRequest = {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          // 不设置 Content-Type，让浏览器自动设置 multipart boundary
        },
        body: requestBody as FormData,
      };
    } 
    // 处理 JSON (纯文本) - 使用保存的 body
    else {
      backendRequest = {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: requestBody as string,
      };
    }

    console.log(`[POST /api/projects/${projectId}/storyboard/import] Proxying to backend...`);

    // 设置 fetch 超时为 5 分钟，确保不会过早断开连接
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分钟

    try {
      const backendResponse = await fetch(
        `${backendUrl}/api/projects/${projectId}/storyboard/import`,
        {
          ...backendRequest,
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        console.error(`Backend error (${backendResponse.status}):`, errorText);
        
        return NextResponse.json(
          { 
            error: {
              code: 'BACKEND_ERROR',
              message: errorText || `后端返回错误: ${backendResponse.status}`,
            }
          },
          { status: backendResponse.status }
        );
      }

      const data = await backendResponse.json();
      return NextResponse.json(data);
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      
      // 区分超时错误和其他错误
      const error = fetchError as Error;
      if (error.name === 'AbortError') {
        console.error('Backend request timeout after 5 minutes');
        return NextResponse.json(
          { 
            error: {
              code: 'TIMEOUT',
              message: '处理时间过长（超过5分钟），请尝试缩短文本或稍后重试',
            }
          },
          { status: 504 }
        );
      }
      
      throw fetchError;
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Storyboard import proxy error:', err);
    
    return NextResponse.json(
      { 
        error: {
          code: 'PROXY_ERROR',
          message: err.message || '代理请求失败',
        }
      },
      { status: 500 }
    );
  }
}

