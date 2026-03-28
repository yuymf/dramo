# AgentOS 集成示例

## 概述

本文档提供基于 [Agno AgentOS](https://docs.agno.com/introduction) 的最小可运行示例，展示如何将 Python 多智能体框架与现有 Node.js 后端集成。

**核心原则**:
- Node.js 保持统一 API 门面、鉴权、限流与错误模型
- AgentOS 专注 AI 生成逻辑与多智能体编排
- 对外 OpenAPI 契约不变，前端无感知

---

## 快速开始

### 前置要求

- Python 3.11+
- Node.js 20+
- Redis 7+
- OpenAI API Key

### 安装依赖

**Python（AgentOS）**:
```bash
cd agentos
pip install agno fastapi uvicorn pydantic openai
```

**Node.js（Worker）**:
```bash
cd backend
npm install node-fetch p-limit p-retry opossum prom-client @opentelemetry/api
```

---

## Python AgentOS 实现

### 目录结构

```
agentos/
├── app.py              # FastAPI 应用与 AgentOS 配置
├── agents/
│   ├── script_generator.py
│   ├── scene_regenerator.py
│   └── inspiration_refresher.py
├── requirements.txt
└── Dockerfile
```

### 完整代码示例

#### `app.py` - FastAPI 应用

```python
"""
AgentOS FastAPI Application
提供内部 AI 生成接口，供 Node Worker 调用
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import logging
import time

from agno.agent import Agent
from agno.models.openai import OpenAI
from agno.os import AgentOS

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ 数据模型 ============

class GenerateScriptInput(BaseModel):
    """生成台本输入"""
    projectId: str
    title: str
    type: Optional[str] = "product"
    style: Optional[str] = "enthusiastic"
    parameters: Optional[Dict[str, Any]] = None


class RegenerateSceneInput(BaseModel):
    """重新生成场景输入"""
    scriptId: str
    sceneId: str
    parameters: Optional[Dict[str, Any]] = None


class RefreshInspirationsInput(BaseModel):
    """刷新灵感输入"""
    projectId: str
    locale: Optional[str] = "zh-CN"


# ============ Agent 配置 ============

# 台本生成 Agent
script_agent = Agent(
    name="ScriptGenerator",
    model=OpenAI(id="gpt-4-turbo-preview"),
    description="专业的直播台本生成助手",
    instructions=[
        "你是一个专业的直播台本编剧",
        "根据用户提供的主题、风格和目标生成结构化台本",
        "台本应包含：开场、主题陈述、核心环节、互动、收尾等部分",
        "每个场景应包含清晰的内容块（Block）",
    ],
    markdown=False,
)

# 场景重生成 Agent
scene_agent = Agent(
    name="SceneRegenerator",
    model=OpenAI(id="gpt-4-turbo-preview"),
    description="场景内容重写与优化助手",
    instructions=[
        "根据场景上下文重新生成内容",
        "提供 3 个不同风格的候选版本",
        "保持内容的连贯性和吸引力",
    ],
    markdown=False,
)

# 灵感推荐 Agent
inspiration_agent = Agent(
    name="InspirationRefresher",
    model=OpenAI(id="gpt-4-turbo-preview"),
    description="创意灵感推荐助手",
    instructions=[
        "基于项目内容推荐相关灵感素材",
        "包含金句、话题、互动玩法、热点梗等",
        "每个灵感应简洁有力，易于应用",
    ],
    markdown=False,
)

# ============ AgentOS 初始化 ============

agent_os = AgentOS(agents=[script_agent, scene_agent, inspiration_agent])
app: FastAPI = agent_os.get_app()

# ============ 中间件 ============

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """请求日志与追踪"""
    start_time = time.time()
    request_id = request.headers.get("X-Request-Id", "unknown")
    
    logger.info(f"[{request_id}] {request.method} {request.url.path}")
    
    response = await call_next(request)
    
    duration = (time.time() - start_time) * 1000
    logger.info(f"[{request_id}] Completed in {duration:.2f}ms - Status: {response.status_code}")
    
    # 透传 Request ID
    response.headers["X-Request-Id"] = request_id
    
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """统一异常处理"""
    request_id = request.headers.get("X-Request-Id", "unknown")
    logger.error(f"[{request_id}] Error: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "AI 服务内部错误",
                "details": str(exc),
            },
            "requestId": request_id,
        },
    )


# ============ 健康检查 ============

@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "ok": True,
        "service": "agentos",
        "version": "1.0.0",
        "timestamp": time.time(),
    }


# ============ AI 生成接口 ============

@app.post("/agentos/generate_script")
async def generate_script(body: GenerateScriptInput, request: Request):
    """
    生成完整台本
    
    返回结构化的 Script 对象，包含多个 Scene
    """
    request_id = request.headers.get("X-Request-Id", "unknown")
    logger.info(f"[{request_id}] Generating script: {body.title}")
    
    try:
        # 构建 Prompt
        prompt = f"""
请生成一个{body.style}风格的直播台本。

项目信息：
- 标题：{body.title}
- 类型：{body.type}
- 主题：{body.parameters.get('topic', '未指定') if body.parameters else '未指定'}
- 目标：{body.parameters.get('goal', '吸引观众') if body.parameters else '吸引观众'}

要求：
1. 生成至少 5 个场景（Scene）
2. 每个场景包含 3-5 个内容块（Block）
3. 内容块类型包括：开场暖场、主题陈述、核心环节、互动、收尾
4. 返回 JSON 格式，结构如下：

{{
  "scenes": [
    {{
      "id": "scene_1",
      "title": "场景名称",
      "order": 1,
      "content": [
        {{
          "id": "block_1",
          "label": "开场暖场",
          "text": "具体内容..."
        }}
      ]
    }}
  ]
}}
"""
        
        # 调用 Agent 生成
        response = script_agent.run(prompt)
        
        # 解析响应（简化示例，实际需要更健壮的解析）
        import json
        try:
            result = json.loads(response.content)
        except:
            # 如果 AI 返回不是纯 JSON，尝试提取
            result = {
                "scenes": [
                    {
                        "id": f"scene_{i+1}",
                        "title": f"场景 {i+1}",
                        "order": i + 1,
                        "content": [
                            {
                                "id": f"block_{i+1}_1",
                                "label": "正文",
                                "text": response.content[:500],
                            }
                        ],
                    }
                    for i in range(5)
                ]
            }
        
        # 返回完整 Script 对象
        return {
            "id": f"script_{int(time.time())}",
            "title": body.title,
            "projectId": body.projectId,
            "type": body.type,
            "style": body.style,
            "status": "draft",
            "scenes": result.get("scenes", []),
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        
    except Exception as e:
        logger.error(f"[{request_id}] Script generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agentos/regenerate_scene")
async def regenerate_scene(body: RegenerateSceneInput, request: Request):
    """
    重新生成场景内容
    
    返回 3 个候选版本供用户选择
    """
    request_id = request.headers.get("X-Request-Id", "unknown")
    logger.info(f"[{request_id}] Regenerating scene: {body.sceneId}")
    
    try:
        # 构建 Prompt
        prompt = f"""
请为场景 {body.sceneId} 重新生成 3 个不同风格的内容版本。

要求：
1. 每个版本风格略有不同（如：简洁版、详细版、互动版）
2. 内容应吸引人且实用
3. 返回 JSON 数组格式

示例：
[
  {{"id": "cand_1", "text": "版本1内容...", "rank": 1}},
  {{"id": "cand_2", "text": "版本2内容...", "rank": 2}},
  {{"id": "cand_3", "text": "版本3内容...", "rank": 3}}
]
"""
        
        # 调用 Agent 生成
        response = scene_agent.run(prompt)
        
        # 解析响应
        import json
        try:
            candidates = json.loads(response.content)
        except:
            # 回退方案
            candidates = [
                {"id": "cand_1", "text": response.content[:200], "rank": 1},
                {"id": "cand_2", "text": response.content[200:400], "rank": 2},
                {"id": "cand_3", "text": response.content[400:600], "rank": 3},
            ]
        
        return {
            "scriptId": body.scriptId,
            "sceneId": body.sceneId,
            "candidates": candidates,
            "regeneratedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        
    except Exception as e:
        logger.error(f"[{request_id}] Scene regeneration failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agentos/refresh_inspirations")
async def refresh_inspirations(body: RefreshInspirationsInput, request: Request):
    """
    刷新灵感推荐
    
    基于项目内容生成相关灵感素材
    """
    request_id = request.headers.get("X-Request-Id", "unknown")
    logger.info(f"[{request_id}] Refreshing inspirations for project: {body.projectId}")
    
    try:
        # 构建 Prompt
        prompt = f"""
请为项目生成 10 条创意灵感，包含以下类别：
- quotes（金句）
- topics（话题）
- interactions（互动玩法）
- hotspots（热点梗）

返回 JSON 数组格式：
[
  {{
    "id": "insp_1",
    "text": "灵感内容...",
    "category": "quotes",
    "relevance": 0.95,
    "source": "来源说明"
  }}
]
"""
        
        # 调用 Agent 生成
        response = inspiration_agent.run(prompt)
        
        # 解析响应
        import json
        try:
            inspirations = json.loads(response.content)
        except:
            # 回退方案
            inspirations = [
                {
                    "id": f"insp_{i+1}",
                    "text": f"灵感示例 {i+1}",
                    "category": ["quotes", "topics", "interactions", "hotspots"][i % 4],
                    "relevance": 0.9 - i * 0.05,
                    "source": "AI 生成",
                }
                for i in range(10)
            ]
        
        return {"data": inspirations}
        
    except Exception as e:
        logger.error(f"[{request_id}] Inspiration refresh failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ 启动配置 ============

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
```

#### `requirements.txt`

```txt
agno>=2.0.0
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
pydantic>=2.0.0
openai>=1.0.0
python-dotenv>=1.0.0
```

#### `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Node.js Worker 集成

### 目录结构

```
backend/src/workers/
├── agentos-client.ts       # AgentOS HTTP 客户端
├── error-mapper.ts         # 错误映射
├── handlers/
│   ├── script-generation.ts
│   ├── scene-regeneration.ts
│   └── inspiration-refresh.ts
└── strategy.ts             # 灰度策略
```

### 完整代码示例

#### `agentos-client.ts` - HTTP 客户端

```typescript
/**
 * AgentOS HTTP 客户端
 * 负责与 Python AgentOS 服务通信
 */
import fetch, { AbortError } from 'node-fetch';
import { logger } from '../lib/logger';

export interface AgentOSCallOptions {
  timeoutMs?: number;
  requestId?: string;
  traceparent?: string;
}

/**
 * 调用 AgentOS 接口
 */
export async function callAgentOS<T>(
  path: string,
  body: unknown,
  opts?: AgentOSCallOptions
): Promise<T> {
  const baseUrl = process.env.AGENTOS_BASE_URL || 'http://localhost:8000';
  const url = `${baseUrl}${path}`;
  const timeoutMs = opts?.timeoutMs ?? 65000;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  const startTime = Date.now();
  
  try {
    logger.info({ path, requestId: opts?.requestId }, 'Calling AgentOS');
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': opts?.requestId ?? '',
        'traceparent': opts?.traceparent ?? '',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    const duration = Date.now() - startTime;
    
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error(
        { path, status: res.status, duration, text },
        'AgentOS call failed'
      );
      throw new Error(`AGENTOS_${res.status}_${text}`);
    }
    
    const data = await res.json() as T;
    
    logger.info({ path, duration, requestId: opts?.requestId }, 'AgentOS call succeeded');
    
    return data;
  } catch (err) {
    const duration = Date.now() - startTime;
    
    if (err instanceof AbortError || (err as Error).name === 'AbortError') {
      logger.error({ path, duration }, 'AgentOS call timeout');
      throw new Error('AGENTOS_TIMEOUT');
    }
    
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
```

#### `error-mapper.ts` - 错误映射

```typescript
/**
 * AgentOS 错误映射到统一错误模型
 */
import { logger } from '../lib/logger';

export interface MappedError {
  code: string;
  message: string;
  retryable: boolean;
}

export function mapAgentOSError(err: Error): MappedError {
  const msg = err.message;
  
  logger.debug({ error: msg }, 'Mapping AgentOS error');
  
  // 400/422 - 参数错误
  if (/AGENTOS_400|AGENTOS_422/.test(msg)) {
    return {
      code: 'INVALID_INPUT',
      message: 'AI 服务参数校验失败',
      retryable: false,
    };
  }
  
  // 404 - 资源不存在
  if (/AGENTOS_404/.test(msg)) {
    return {
      code: 'NOT_FOUND',
      message: '请求的资源不存在',
      retryable: false,
    };
  }
  
  // 429 - 限流
  if (/AGENTOS_429/.test(msg)) {
    return {
      code: 'RATE_LIMITED',
      message: 'AI 服务请求频率超限',
      retryable: true,
    };
  }
  
  // 408/499/504/TIMEOUT - 超时
  if (/AGENTOS_408|AGENTOS_499|AGENTOS_504|AGENTOS_TIMEOUT/.test(msg)) {
    return {
      code: 'UPSTREAM_TIMEOUT',
      message: 'AI 服务响应超时',
      retryable: true,
    };
  }
  
  // 5xx - 服务器错误
  if (/AGENTOS_5\d\d/.test(msg)) {
    return {
      code: 'INTERNAL_ERROR',
      message: 'AI 服务内部错误',
      retryable: true,
    };
  }
  
  // 未知错误
  return {
    code: 'INTERNAL_ERROR',
    message: '未知错误',
    retryable: true,
  };
}
```

#### `handlers/script-generation.ts` - 台本生成处理器

```typescript
/**
 * 台本生成任务处理器
 */
import { Job } from 'bullmq';
import pRetry from 'p-retry';
import { callAgentOS } from '../agentos-client';
import { mapAgentOSError } from '../error-mapper';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/db';

interface ScriptGenerationJobData {
  scriptId: string;
  projectId: string;
  title: string;
  type?: string;
  style?: string;
  parameters?: Record<string, any>;
  requestId: string;
  userId: string;
}

export async function handleScriptGeneration(job: Job<ScriptGenerationJobData>) {
  const { scriptId, projectId, title, type, style, parameters, requestId } = job.data;
  
  logger.info({ jobId: job.id, scriptId }, 'Processing script generation');
  
  try {
    // 更新进度
    await job.updateProgress(10);
    
    // 调用 AgentOS（带重试）
    const result = await pRetry(
      async () => {
        try {
          return await callAgentOS<any>(
            '/agentos/generate_script',
            { projectId, title, type, style, parameters },
            { timeoutMs: 60000, requestId }
          );
        } catch (err) {
          const mapped = mapAgentOSError(err as Error);
          if (!mapped.retryable) {
            throw new pRetry.AbortError(mapped.message);
          }
          throw err;
        }
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 4000,
        onFailedAttempt: (err) => {
          logger.warn(
            { jobId: job.id, attempt: err.attemptNumber, retriesLeft: err.retriesLeft },
            'AgentOS call failed, retrying...'
          );
        },
      }
    );
    
    await job.updateProgress(90);
    
    // 保存到数据库
    await prisma.script.create({
      data: {
        id: result.id,
        title: result.title,
        projectId: result.projectId,
        type: result.type,
        style: result.style,
        status: result.status,
        scenes: result.scenes,
        createdAt: new Date(result.createdAt),
        updatedAt: new Date(result.updatedAt),
      },
    });
    
    await job.updateProgress(100);
    
    logger.info({ jobId: job.id, scriptId: result.id }, 'Script generation completed');
    
    return result;
  } catch (err) {
    const mapped = mapAgentOSError(err as Error);
    logger.error(
      { jobId: job.id, error: mapped },
      'Script generation failed'
    );
    throw Object.assign(new Error(mapped.message), { code: mapped.code, retryable: mapped.retryable });
  }
}
```

#### `strategy.ts` - 灰度策略

```typescript
/**
 * AgentOS 灰度策略
 */
import { config } from '../config';
import { logger } from '../lib/logger';

/**
 * 判断是否使用 AgentOS
 */
export function shouldUseAgentOS(taskType: string, userId: string): boolean {
  const grayRatio = config.get('agentos.grayRatio', 0);
  
  if (grayRatio === 0) {
    return false;
  }
  
  if (grayRatio === 1) {
    return true;
  }
  
  // 按用户 ID 一致性哈希
  const hash = hashCode(userId);
  const shouldUse = (hash % 100) < (grayRatio * 100);
  
  logger.debug(
    { taskType, userId, grayRatio, hash, shouldUse },
    'AgentOS gray decision'
  );
  
  return shouldUse;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
```

---

## 部署与运行

### 开发环境（Docker Compose）

```yaml
# docker-compose.yml
version: '3.8'

services:
  agentos:
    build: ./agentos
    ports:
      - "8000:8000"
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      LOG_LEVEL: debug
    volumes:
      - ./agentos:/app
    command: uvicorn app:app --host 0.0.0.0 --port 8000 --reload
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  worker:
    build: ./backend
    environment:
      AGENTOS_BASE_URL: http://agentos:8000
      AGENTOS_GRAY_RATIO: 0.1  # 10% 灰度
    depends_on:
      agentos:
        condition: service_healthy
      redis:
        condition: service_started
    command: npm run worker

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f agentos
docker-compose logs -f worker

# 测试 AgentOS 健康检查
curl http://localhost:8000/health

# 测试台本生成
curl -X POST http://localhost:8000/agentos/generate_script \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: test-123" \
  -d '{
    "projectId": "proj_test",
    "title": "测试台本",
    "type": "product",
    "style": "enthusiastic"
  }'
```

---

## 监控与调试

### 查看 AgentOS 日志

```bash
docker-compose logs -f agentos | grep "Generating script"
```

### 查看 Worker 日志

```bash
docker-compose logs -f worker | grep "AgentOS"
```

### Prometheus 指标

访问 `http://localhost:9090` 查询：

```promql
# AgentOS 调用延迟
histogram_quantile(0.95, rate(agentos_http_duration_seconds_bucket[5m]))

# AgentOS 错误率
rate(agentos_http_errors_total[5m]) / rate(agentos_http_duration_seconds_count[5m])

# 进行中的任务数
agentos_jobs_inflight
```

---

## 故障排查

### 常见问题

**1. AgentOS 连接超时**

```bash
# 检查 AgentOS 服务状态
docker-compose ps agentos

# 检查网络连通性
docker-compose exec worker curl http://agentos:8000/health
```

**2. AI 生成失败**

```bash
# 查看 AgentOS 错误日志
docker-compose logs agentos | grep "ERROR"

# 检查 OpenAI API Key
docker-compose exec agentos env | grep OPENAI_API_KEY
```

**3. 灰度不生效**

```bash
# 检查配置
docker-compose exec worker env | grep AGENTOS_GRAY_RATIO

# 查看灰度决策日志
docker-compose logs worker | grep "gray decision"
```

---

## 性能调优

### AgentOS 并发控制

```python
# app.py
from agno.agent import Agent

# 限制并发 LLM 调用
script_agent = Agent(
    name="ScriptGenerator",
    model=OpenAI(id="gpt-4-turbo-preview"),
    max_concurrent_calls=3,  # 最多 3 个并发
)
```

### Node Worker 并发控制

```typescript
// worker.ts
import pLimit from 'p-limit';

const agentosLimiter = pLimit(5); // 最多 5 个并发调用

export async function callAgentOSWithLimit<T>(path: string, body: unknown) {
  return agentosLimiter(() => callAgentOS<T>(path, body));
}
```

---

## 参考资源

- [Agno 官方文档](https://docs.agno.com/introduction)
- [AgentOS 快速开始](https://docs.agno.com/quickstart)
- [高并发架构方案](BACKEND_ARCHITECTURE.md#python-agentos-融合方案可选)
- [内部集成规范](BACKEND_API_SPEC.md#附录内部服务集成规范可选)

---

*文档版本*: 1.0  
*更新日期*: 2025-10-16  
*维护者*: Backend Team

