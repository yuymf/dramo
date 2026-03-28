# Findings & Decisions

## Requirements
- 统一后端设计，去除冗余代码
- 修复 SSE 流式响应
- 后端采用 Supabase + Vercel 的组合

## Research Findings

### 当前架构分析

**TypeScript API 层 (src/)**
- `server.ts` — Fastify 启动，注册中间件、路由、静态文件
- `config/index.ts` — 环境变量集中配置
- `api/routes/` — 18 个路由文件（health, auth, projects, scripts, tasks, inspirations, chat, assets, polish, characters, locations, storyboard, storyboard-persistence, ai-providers, relations, uploads, generation-jobs）
- `api/middleware/` — auth(JWT), idempotency, error-handler, ratelimit(已禁用)
- `services/` — 业务逻辑层（chat, script, storyboard, storage 等）
- `workers/` — BullMQ 消费者：script-generator, scene-regenerator, inspiration-refresher, image-generator
- `lib/` — 基础设施：db(Prisma), cache(Redis/ioredis), queue(BullMQ), agentos-client, errors, logger, telemetry, ai-client

**Python AgentOS 层 (agentos/)**
- `app.py` — FastAPI + Agno 运行时，注册 workflows，自定义路由
- `config.py` — AI provider 配置
- `workflows/` — storyboard, characters, locations, polish workflows
- `services/image_service.py` — Seedream 图片生成
- `prompts/` — Markdown prompt 模板

### SSE 问题详情

1. **Chat SSE — 完全未实现** (`src/api/routes/chat.ts:26-30`)
   - 有 `stream` 参数但被强制设为 `false`
   - `chat.service.ts:72-74` 有 stream 分支但未真正处理 SSE 响应格式
   - `ai-client.ts:162-185` 的 chatCompletion 不支持流式

2. **Storyboard — 无 SSE**
   - `storyboard.ts` 直接 await `startWorkflowRun` 拿全量结果
   - AgentOS 的 workflow API 支持 `stream=true` 但 TS 层未利用

3. **AgentOS 图片生成 — 有 SSE** (`agentos/app.py:144-172`)
   - Python 端有完整 SSE 实现（StreamingResponse）
   - 但 TS 端 `runImageGeneration` 不消费 SSE，直接 `response.json()`

4. **agentos-client.ts — 有 streaming 基础设施**
   - `streamWorkflowRun()` 函数存在但未被任何路由使用
   - 能返回 `Readable` stream 但没有人消费

### 冗余代码清单

| 位置 | 内容 | 原因 |
|------|------|------|
| `src/api/routes/index.ts:41-62` | Deprecated `/api/scripts` GET/POST 返回 410 | 废弃端点，可直接删除 |
| `src/api/middleware/ratelimit.ts` | 限流中间件 | 已注释禁用，server.ts 中也注释了 |
| `src/lib/agentos-client.ts:122-184` | `callAgentOS()` legacy 函数 | 被 ai-client.ts 使用，但应该统一到 workflow API |
| `src/lib/agentos-client.ts:98-117` | `streamWorkflowRun()` | 存在但从未被调用 |
| `src/lib/ai-client.ts` | 整个文件 | 只是 `callAgentOS` 的薄封装，增加了不必要的间接层 |
| `src/lib/cache.ts` | Redis 缓存 | 迁移后移除 |
| `src/lib/queue.ts` | BullMQ 队列 | 迁移后移除 |
| `src/workers/*` | 所有 worker 文件 | 迁移后移除 |
| `docker-compose.yml` | Redis、Worker 服务 | 迁移后简化 |

### Supabase 使用现状

- **PostgreSQL**: 通过 `DATABASE_URL` 连接 Supabase 托管的 PostgreSQL
- **Storage**: 可配置（`STORAGE_DRIVER=local|supabase`），生产用 Supabase Storage
- **Auth**: **未使用** Supabase Auth，自行实现 JWT（`src/api/middleware/auth.ts`）
- **Realtime**: 未使用
- **Edge Functions**: 未使用

### Vercel 部署考量

- **Serverless Functions**: 支持 Node.js 20，可用 Prisma
- **Edge Functions**: 不支持 Prisma 直连，但可用 Prisma Accelerate
- **Streaming**: Vercel 支持 Serverless Functions 的 streaming response（SSE）
- **Timeout**: Hobby=60s, Pro=300s, Enterprise=900s
- **Python**: Vercel 支持 Python runtime 但功能有限

### 依赖分析 (package.json)

**可移除的依赖（迁移后）：**
- `bullmq` — 队列
- `ioredis` — Redis
- `@opentelemetry/*` — 可改用 Vercel Analytics
- `@fastify/*` (cors, helmet, multipart, static, swagger, swagger-ui) — 改 Vercel 原生
- `fastify` — 改 Vercel serverless

**保留的依赖：**
- `@prisma/client` — 数据库
- `@supabase/supabase-js` — 存储
- `jsonwebtoken` — JWT
- `zod` — 验证
- `pino` + `pino-pretty` — 日志
- `node-fetch` — HTTP client
- `openai` — AI API
- `bcrypt`, `uuid` — 工具

### SSE 60s 分段续传协议设计

由于 Vercel Hobby 的 60s 硬限制，需要一个续传机制：

**协议流程：**
```
Client                          Vercel Function              AgentOS
  |--- POST /api/chat (SSE) ---->|                              |
  |                               |--- POST /workflows (SSE) -->|
  |<-- event: data {chunk1} ------|<-- SSE data {chunk1} -------|
  |<-- event: data {chunk2} ------|<-- SSE data {chunk2} -------|
  |<-- event: progress {50%} -----|                              |
  |    ... (approaching 55s) ...  |                              |
  |<-- event: timeout {cursor} ---|  (save state to Supabase)   |
  |    (connection closes)        |                              |
  |                               |                              |
  |--- GET /api/chat/resume ----->|                              |
  |    ?session=xxx&cursor=yyy    |--- resume from cursor ------>|
  |<-- event: data {chunk3} ------|<-- SSE data {chunk3} -------|
  |<-- event: done ---------------|<-- done --------------------|
```

**状态存储：**
- Session ID + cursor 存 Supabase DB（`task` 表的 `metadata` 字段）
- 包含已发送数据的 hash 和偏移量

**对大多数场景的简化：**
- Chat completion 通常 < 60s，不需要续传
- Storyboard/characters/locations 可能超 60s，需要续传
- 图片生成请求 AgentOS 后立即返回 job ID，用 DB 轮询结果

## Technical Decisions (已确认)
| Decision | Rationale |
|----------|-----------|
| **Hono 框架** | 轻量、TS 原生、Vercel 官方支持、API 类似 Express 迁移成本低 |
| **Vercel Hobby (60s)** | 用户选择；SSE 分段续传解决 timeout 限制 |
| **AgentOS 独立部署** | Python 不适合 Vercel；Agno 框架需要长运行进程 |
| **SSE 60s chunk 协议** | Hobby 60s 硬限制；通过 cursor-based 续传实现长任务 |
| **移除 BullMQ + Redis** | Vercel serverless 无持久进程，SSE 替代队列 |
| **Supabase Storage 统一** | Vercel 无持久磁盘，移除 local storage driver |
| **保留 Prisma + Supabase PG** | 已有 13 model schema，迁移成本低 |
| **Supabase connection pooler** | Serverless 环境连接数管理必需 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| (none yet) | |

## Resources
- Supabase Dashboard: `db.ypiujdwrugmotyqqucef.supabase.co`
- Prisma Schema: `src/db/schema.prisma` (13 models)
- Vercel Serverless docs: https://vercel.com/docs/functions/serverless-functions
- Vercel SSE streaming: https://vercel.com/docs/functions/streaming

---
*Update this file after every 2 view/browser/search operations*
