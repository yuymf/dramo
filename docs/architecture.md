# 架构与设计模式

> Dramo 的核心架构决策和技术模式。

## 数据流总览

```
浏览器 (:12323)
  │ HTTP / 相对路径 /api/*
  ↓
Next.js API Routes (代理层)
  │ Server-side fetch → BACKEND_API_URL
  ↓
Hono API (:12321)
  ├── Prisma → 本地 PostgreSQL (容器)
  ├── 文件存储 (本地 ./uploads，挂载为 Docker volume)
  └── HTTP/SSE → AgentOS (:12322, 内网)
                    ├── Agno 工作流 (多智能体)
                    ├── LLM API (OpenAI / Hunyuan)
                    └── 图片生成 (ARK Seedream / Doubao)
```

## API 代理模式

前端所有请求通过 Next.js API Routes (`web/app/api/`) 代理到后端：

1. 客户端用 `api<T>()` (`web/lib/api/client.ts`) 调用相对路径 `/api/...`
2. Next.js Route Handler 调用 `proxyRequest()` (`web/app/api/_utils/proxy.ts`) 把请求 server-side 转发到 `BACKEND_API_URL`
3. 转发同时把 path 重写为 `/api/v1/...`（后端实际挂载点），并保留 SSE 流式 passthrough
4. 后端无 cookie/session 概念，**无认证**：`middleware/default-user.ts` 自动注入 `default-local-user`

```
Browser → fetch('/api/projects')
        → web/app/api/projects/route.ts
        → proxyRequest()
        → http://api:12321/api/v1/projects
        → defaultUserMiddleware 注入用户
        → routes/projects.ts
```

## SSE 流式传输

长时间 AI 操作支持 Server-Sent Events：

- **使用场景**：对话、分镜导入、角色/场景提取、台本润色
- **超时**：55 秒（保守值，nginx `proxy_read_timeout` 设为 600s 兜底）
- **心跳**：每 15 秒发送保活
- **重连**：客户端自动重连，从断点续传
- **Passthrough**：Next.js Route Handler 检测 `text/event-stream` 后直接 pipe `ReadableStream`，不缓冲
- **实现**：`server/src/lib/sse.ts` — `streamSSEResponse()`, `parseAgentOSSSE()`

## 异步任务模式

分镜导入等超长耗时操作（>55s）：

1. `POST` 返回 `202 Accepted` + `taskId`
2. 后端 fire-and-forget 后台执行（Node.js 进程长驻，不依赖 serverless）
3. 客户端轮询 `GET /api/tasks/:taskId` 获取进度
4. 任务状态：`queued → running → completed/failed`

> Node.js HTTP 服务器超时设置（`server/src/server.ts`）：headersTimeout 10min、requestTimeout 12min、keepAliveTimeout 10min20s。

## 图片生成队列

1. 创建 `GenerationJob` (status: queued)
2. 后端 inline 执行（无独立队列服务）
3. 客户端通过 SSE 流 `/api/jobs/stream` 或单独 GET 获取进度
4. 支持取消和重试（仅限可重试错误）

## 加密方案

- 用户的 LLM API Key 使用 AES-256-GCM 加密存储于数据库
- 读取时解密，通过 HTTP header 转发给 AgentOS
- 加密密钥来自 `ENCRYPTION_KEY` 环境变量（64 hex chars = 32 bytes）
- 实现：`server/src/lib/crypto.ts`

## 部署架构

单服务器 Docker Compose：

| 容器 | 镜像 | 端口 |
|------|------|------|
| `nginx` | `nginx:alpine` | `${PORT:-80}` 对外 |
| `web` | 构建 `web/Dockerfile`（Next.js standalone）| 内网 3000 |
| `api` | 构建 `server/Dockerfile`（Node.js + Prisma）| 内网 12321 |
| `agentos` | 构建 `agentos/Dockerfile`（Python + uvicorn）| 内网 12322 |
| `postgres` | `postgres:15-alpine` | 内网 5432 + 主机 5432 |

Nginx (`deploy/nginx.conf`) 把 `/api/*` 转给 api、其他转给 web，`/uploads/*` 直接 alias 到共享 volume。所有容器在 `dramo-network` 网络中互相用 service name 通信。

## 统一错误处理

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "用户友好消息",
    "retryable": true
  },
  "requestId": "uuid"
}
```

- `server/src/lib/errors.ts` — `AppException` 类 + `ErrorCode` 枚举
- `server/src/middleware/error-handler.ts` — 全局错误拦截，统一格式
- 每个请求自动注入 `requestId` 用于链路追踪

## AgentOS 工作流

### 分镜生成 (StoryboardWorkflow) — 4 阶段

```
台本 + 角色库 + 场景库
  → Phase 1: Screenplay (台本→编剧格式)
  → Phase 2: PlanPanels (场景→镜头拆分)
  → Phase 3: 并行执行
     ├── Cinematographer (镜头、灯光、焦距)
     └── ActingDirection (角色走位、情绪、动作)
  → Phase 4: DetailRefiner (丰富视觉细节、生成提示词)
  → 输出: JSON { scenes → shots → cinematography + acting + details }
```

### 台本生成 (ScriptWorkflow)

- 输入：大纲、角色、场景、风格
- 多步骤生成 + 精炼循环
- 输出：完整台本 (acts → scenes → blocks/dialogue)

### 角色提取 (CharactersWorkflow)

- 输入：台本文本
- 提取角色、推断画像、检测关系
- 输出：角色画像数组（语言特征、年龄、角色定位）

### 场景提取 (LocationsWorkflow)

- 输入：台本文本 → 输出：场景规格（视觉、道具、氛围）

### 台本润色 (PolishWorkflow)

- 语法、对话、叙事流润色

### 图片生成 (ImageService)

```
POST /api/generate-image → AgentOS 智能模式选择:
  0 参考图 + single   → text_to_image
  1 参考图 + single   → image_to_image
  N 参考图 + single   → merge_images
  0 参考图 + sequence → text_to_sequence
  1 参考图 + sequence → image_to_sequence
  N 参考图 + sequence → images_to_sequence
```

### AgentOS 与后端通信

- `server/src/lib/agentos-client.ts`：
  - `startWorkflowRun()` — POST 到 `/workflows/{id}/runs`，返回 raw Response（JSON 或 SSE）
  - `postAgentOS<T>()` / `getAgentOS<T>()` — 通用 JSON 请求
  - `runImageGeneration()` — POST 到 `/api/generate-image`
  - `parseAgentOSSSE()` — SSE 流解析

## 前端状态管理

- `AIChatProvider` — AI 对话抽屉、当前页面类型、JSON 上下文、待应用的 AI 建议
- `GenerationJobsProvider` — 异步任务轮询（图片/台本生成）
- SWR — 远端数据获取与缓存
- Zustand — 局部客户端状态（如 pipeline 步进器）
- 无全局认证状态（无登录设计）

## 前端路由

项目工作区 `/projects/[id]/` 使用 Next.js 并行路由：

- `@sidebar` — 持久侧边栏（场景列表、导航）
- `@content` — 深链接内容区（scripts、characters、storyboard）

Legacy 路由 `/scripts/:id` 通过 `web/next.config.ts` 永久重定向到 `/projects/:id/scripts`。
