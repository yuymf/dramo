# Dramo Server — Hono v4 后端 API

> Monorepo 子项目。全局文档见 [根目录 CLAUDE.md](../CLAUDE.md)，详细参考见 [docs/](../docs/)。

## 概览

Hono v4 TypeScript API 后端，端口 12321。两个运行时协作:

1. **TypeScript API** (Hono) — REST API、认证、SSE 流、数据库访问。可部署到 Vercel Serverless 或 `@hono/node-server` 独立运行。
2. **Python AgentOS** (FastAPI + Agno) — 多智能体 AI 工作流 (分镜、角色、场景、润色、图片生成)。端口 12322，独立部署。

TS API 通过 HTTP 委托 AI 工作给 AgentOS。长耗时操作使用 SSE 流 (55s 超时 + 自动重连，兼容 Vercel 60s 限制)。

## 命令

```bash
# 安装 & 生成
npm install
npm run prisma:generate        # 生成 Prisma Client (schema 变更后必须)
npm run prisma:migrate         # 运行数据库迁移

# 开发
npm run dev                    # Hono API 热重载 (tsx watch, :12321)

# 构建 & 生产
npm run build                  # tsc → dist/
npm start                      # node dist/server.js

# Vercel
vercel dev                     # 本地 Vercel 开发
vercel deploy                  # 部署到 Vercel

# 检查 & 测试
npm run lint                   # ESLint v8 (Traditional Config)
npm test                       # Jest

# 数据库
npm run prisma:studio          # 可视化数据库浏览器
```

## 环境变量

必须: `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 (Supabase) |
| `DIRECT_URL` | 迁移专用直连 |
| `JWT_SECRET` | JWT 签名密钥 (32+ 字符) |
| `JWT_EXPIRES_IN` | Token 有效期 (默认 `30d`) |
| `AGENTOS_BASE_URL` | AgentOS 地址 (`http://localhost:12322`) |
| `ENCRYPTION_KEY` | AES-256-GCM 密钥 (32 字节 hex) — 加密 LLM API Key |
| `STORAGE_DRIVER` | `local` (开发) / `supabase` (生产) |
| `AI_PROVIDER` | `openai` / `hunyuan` / `ark` |
| `STRIPE_SECRET_KEY` | Stripe 密钥 |

> 完整环境变量说明见 [docs/env-and-deploy.md](../docs/env-and-deploy.md)

## 目录结构

```
server/src/
├── app.ts                      # Hono 应用: CORS, auth middleware, 路由注册, 错误处理
├── server.ts                   # @hono/node-server 独立入口
├── api/[[...route]].ts         # Vercel Serverless 入口 (catch-all)
├── config/index.ts             # 环境变量集中配置对象
│
├── routes/                     # 路由处理器 (19 个文件)
│   ├── auth.ts                 #   POST /api/auth/login, /register
│   ├── projects.ts             #   CRUD /api/projects
│   ├── scripts.ts              #   台本生成、版本、回退
│   ├── characters.ts           #   角色提取 (SSE 流)
│   ├── locations.ts            #   场景提取 (SSE 流)
│   ├── storyboard.ts           #   分镜导入 (SSE/异步)
│   ├── storyboard-persistence.ts #  分镜帧持久化
│   ├── polish.ts               #   台本润色 (SSE 流)
│   ├── chat.ts                 #   AI 对话 (SSE 流)
│   ├── assets.ts               #   角色/场景资产 CRUD
│   ├── relations.ts            #   角色关系图 CRUD + cleanup
│   ├── generation-jobs.ts      #   图片生成队列 + SSE 轮询
│   ├── llm-config.ts           #   用户 LLM 配置 (加密存储)
│   ├── ai-providers.ts         #   AI 供应商信息
│   ├── billing.ts              #   Stripe 订阅 + webhook
│   ├── inspirations.ts         #   灵感推荐
│   ├── tasks.ts                #   异步任务状态
│   ├── uploads.ts              #   图片上传
│   └── health.ts               #   GET /api/health
│
├── services/                   # 业务逻辑层 (13 个服务)
│   ├── project.service.ts      #   项目 CRUD、列表、校验
│   ├── script.service.ts       #   台本生成、版本控制、场景重生成
│   ├── asset.service.ts        #   角色/场景资产管理、图片生成
│   ├── generation-job.service.ts #  图片任务生命周期、轮询、重试
│   ├── chat.service.ts         #   消息 CRUD、SSE 流
│   ├── storyboard.service.ts   #   分镜操作
│   ├── storyboard-data.service.ts # 分镜帧持久化
│   ├── relation.service.ts     #   关系图操作、孤立边清理
│   ├── inspiration.service.ts  #   灵感 CRUD、收藏
│   ├── storage.service.ts      #   Local/Supabase 文件存储
│   ├── llm-config.service.ts   #   LLM 配置 CRUD、加密
│   ├── billing.service.ts      #   Stripe 订阅管理
│   └── task.service.ts         #   异步任务状态管理
│
├── middleware/
│   ├── auth.ts                 #   JWT Bearer 验证 + requestId 注入
│   └── error-handler.ts        #   统一错误信封
│
├── lib/                        # 基础设施
│   ├── db.ts                   #   Prisma 单例 (globalForPrisma, Serverless 友好)
│   ├── agentos-client.ts       #   AgentOS HTTP/SSE 客户端
│   ├── sse.ts                  #   SSE 辅助: streamSSEResponse(), parseAgentOSSSE()
│   ├── errors.ts               #   AppError 类 + ErrorCode 枚举 + createError()
│   ├── logger.ts               #   pino 结构化日志
│   └── encryption.ts           #   AES-256-GCM 加密/解密
│
└── db/
    ├── schema.prisma           #   数据库模型 (17 张表)
    └── migrations/             #   Prisma 迁移文件
```

## API 接口

> 完整端点列表见 [docs/api-reference.md](../docs/api-reference.md)

| 模块 | 端点数 | 路由文件 | 关键能力 |
|------|--------|---------|---------|
| 认证 | 3 | `auth.ts` | 注册、登录 (JWT) |
| 项目 | 5 | `projects.ts` | CRUD |
| 台本 | 6 | `scripts.ts` | 生成、编辑、版本、回退 |
| 角色 | 7 | `characters.ts` + `assets.ts` | 提取 (SSE)、资产 CRUD |
| 角色关系 | 5 | `relations.ts` | 关系图 CRUD + cleanup |
| 场景 | 7 | `locations.ts` + `assets.ts` | 提取 (SSE)、资产 CRUD |
| 分镜 | 6 | `storyboard.ts` + `storyboard-persistence.ts` | 导入 (SSE/异步)、帧持久化 |
| 润色 | 2 | `polish.ts` | 台本润色 (SSE) |
| 对话 | 3 | `chat.ts` | 消息、AI 流式回复 |
| 图片/任务 | 6 | `generation-jobs.ts` | 生成队列、SSE 轮询、重试 |
| LLM 配置 | 5 | `llm-config.ts` | CRUD、AES-256-GCM 加密 |
| AI 供应商 | 2 | `ai-providers.ts` | 供应商列表、当前供应商 |
| 计费 | 5 | `billing.ts` | Stripe 订阅 + webhook |
| 灵感 | 5 | `inspirations.ts` | 推荐、收藏 |
| 任务 | 1 | `tasks.ts` | 异步任务状态 |
| 上传 | 2 | `uploads.ts` | 图片上传 (v1/v2) |
| 健康 | 1 | `health.ts` | 健康检查 |

## 数据库

> 完整模型说明见 [docs/database-schema.md](../docs/database-schema.md)

Prisma schema: `src/db/schema.prisma`，17 张表:

- **核心**: `User` → `Project` → `Script` (+ `ScriptVersion`)
- **资产**: `CharacterAsset`, `LocationAsset`, `CharacterRelation`, `Storyboard`, `StoryboardFrameImage`
- **V1 资产**: `Character3ViewAsset`, `LocationImageAsset`
- **任务**: `GenerationJob`, `Task`, `PipelineRun`
- **社交**: `ChatMessage`, `Inspiration`
- **系统**: `UserLLMConfig`, `Subscription`

关键约束:
- `CharacterRelation`: nodeA < nodeB 归一化，`@@unique([projectId, nodeAId, nodeBId, type])`
- `Storyboard`: `projectId @unique` — 每项目一个分镜
- `UserLLMConfig`: `@@unique([userId, name])` — 配置名唯一

## 核心模式

### 统一错误信封

```json
{
  "error": { "code": "ERROR_CODE", "message": "用户友好消息", "retryable": true },
  "requestId": "uuid"
}
```

使用 `createError()` (lib/errors.ts) 创建错误。ErrorCode 枚举定义所有错误码。

### 认证

- JWT Bearer Token，`middleware/auth.ts` 全局拦截
- 公开路径: `/api/health`, `/api/auth/*`, `/api/billing/webhook`
- 认证路由中通过 `c.get('user').userId` 获取用户 ID

### SSE 流式传输

长时间 AI 操作 (对话、分镜、角色/场景提取、润色):
- 支持 `?stream=true` 或 `body.stream=true`
- 55 秒超时 (Vercel 60s - 5s buffer)
- 15 秒心跳保活
- 客户端自动重连协议
- 实现: `lib/sse.ts` — `streamSSEResponse()`, `parseAgentOSSSE()`

### 异步任务

分镜导入等超长操作 (>55s):
1. POST 返回 202 + `taskId`
2. 后端 fire-and-forget 执行
3. 客户端轮询 `GET /api/tasks/:taskId`

### 图片生成队列

1. 创建 `GenerationJob` (status: queued)
2. inline 执行 (非 Bull MQ, Serverless 友好)
3. 客户端通过 SSE `/api/jobs/stream` 或 GET 轮询
4. 支持取消/重试 (仅限 retryable 错误)

### 加密

- LLM API Key: AES-256-GCM 加密存储，读取时解密转发给 AgentOS
- `lib/encryption.ts`, 密钥来自 `ENCRYPTION_KEY`

### 存储

- `STORAGE_DRIVER=local`: 文件存储到 `./uploads`
- `STORAGE_DRIVER=supabase`: Supabase Storage
- `services/storage.service.ts` 统一管理

### AgentOS 通信

`lib/agentos-client.ts`:
- `startWorkflowRun()` — POST `/workflows/{id}/runs` → raw Response (JSON/SSE)
- `postAgentOS<T>()` / `getAgentOS<T>()` — 通用请求
- `runImageGeneration()` — POST `/api/generate-image`
- `parseAgentOSSSE()` — SSE 流解析

### Serverless 兼容

- Prisma 全局单例 (`globalForPrisma`)
- 无持久 EventEmitter，用 DB 轮询
- Vercel 入口: `api/[[...route]].ts`

## TypeScript 配置

- Target: ES2022, ESM (`"type": "module"`)
- Module resolution: bundler
- Strict mode + `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- JSX: react-jsx (Hono import source)
- Node.js 20+ 必需

## 部署

> 完整部署方案见 [docs/env-and-deploy.md](../docs/env-and-deploy.md)

- **Vercel**: `api/[[...route]].ts` 作为 Serverless 入口。Hobby 计划 60s 超时。
- **Docker**: `docker compose up -d` (API + AgentOS)
- **独立**: `npm run build && npm start`
- AgentOS 需独立部署。`AGENTOS_BASE_URL` 指向 AgentOS 实例。
