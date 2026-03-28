# Task Plan: 统一后端设计 — Supabase + Vercel (Hono) 架构迁移

## Goal

将 Story Agent 后端从当前的 Fastify + BullMQ/Redis + Docker 多服务架构，迁移为 **Hono + Vercel Serverless** + **Supabase** 的轻量架构。去除冗余代码，修复 SSE 流式响应，实现统一、简洁、可部署的后端设计。

## Current Phase
Phase 2

## 核心架构变更

**当前架构（As-Is）：**
```
Client → Fastify API (TS) → Redis/BullMQ → Worker Pool (TS)
                          → Prisma → Supabase PostgreSQL       → AgentOS (Python)
                          → Local/Supabase Storage
```

**目标架构（To-Be）：**
```
Client → Hono (Vercel Serverless) → Prisma → Supabase PostgreSQL
       ↕ SSE (60s chunks + auto-reconnect)  → Supabase Storage
                                             → AgentOS (独立部署, HTTP/SSE)
```

**关键决策（已确认）：**
- **API 框架**: Hono（轻量、Vercel 原生支持）
- **AgentOS**: 独立部署（Railway/Fly.io/云服务器）
- **长任务策略**: SSE 为主，60s 分段 + 客户端自动重连
- **Vercel 计划**: Hobby（60s timeout）
- **Redis/BullMQ**: 完全移除
- **Worker 进程**: 移除，任务内联 + SSE

## Phases

### Phase 1: 需求分析与现状梳理
- [x] 理解用户意图
- [x] 梳理当前架构（TS API、Python AgentOS、Redis、BullMQ）
- [x] 识别 SSE 问题（chat 路由 TODO、storyboard 未 stream）
- [x] 识别冗余代码（deprecated routes、legacy callAgentOS、未用限流）
- [x] 记录发现到 findings.md
- **Status:** complete

### Phase 2: 架构设计与技术决策
- [x] 确认 Vercel 部署方案 → Serverless Functions (Hobby, 60s)
- [x] 确认长任务策略 → SSE 60s chunk + auto-reconnect
- [x] 确认 AgentOS 部署 → 独立部署
- [x] 确认 API 框架 → Hono
- [ ] 设计新的目录结构
- [ ] 设计 SSE 统一方案（含 60s 分段协议）
- [ ] 设计 Hono 路由映射
- **Status:** in_progress

### Phase 3: 项目脚手架搭建
- [ ] 初始化 Hono + Vercel 项目结构
- [ ] 配置 vercel.json
- [ ] 配置 tsconfig（Hono 兼容）
- [ ] 设置 Prisma 连接池（Supabase connection pooler）
- [ ] 实现通用中间件（CORS, Auth, Error handling）
- [ ] 实现 SSE helper（含 60s 分段 + heartbeat）
- **Status:** pending

### Phase 4: 路由迁移
- [ ] 迁移 health routes
- [ ] 迁移 auth routes
- [ ] 迁移 project routes
- [ ] 迁移 script routes（去掉 BullMQ，改 SSE/inline）
- [ ] 迁移 chat routes（实现 SSE 流式）
- [ ] 迁移 storyboard routes（实现 SSE 流式）
- [ ] 迁移 characters/locations/polish routes
- [ ] 迁移 asset/upload routes（统一 Supabase Storage）
- [ ] 迁移 task/generation-job routes（去掉 BullMQ 轮询）
- [ ] 迁移 inspiration routes
- [ ] 迁移 ai-provider routes
- [ ] 删除 deprecated endpoints
- **Status:** pending

### Phase 5: SSE 流式实现
- [ ] 实现 chat SSE（AgentOS chat_completion stream → 客户端）
- [ ] 实现 storyboard import SSE（AgentOS storyboardworkflow stream）
- [ ] 实现 characters/locations/polish SSE
- [ ] 实现 60s 超时自动续传协议
  - 服务端：接近 55s 时发 `event: timeout` + `data: {cursor, sessionId}`
  - 客户端：收到后用 cursor 重连 `GET /api/.../stream?cursor=xxx&session=yyy`
  - 服务端：从断点继续推送
- [ ] 统一 SSE 事件格式：
  - `event: data` — 数据块
  - `event: progress` — 进度 (0-100)
  - `event: error` — 错误
  - `event: done` — 完成
  - `event: timeout` — 超时重连信号
- **Status:** pending

### Phase 6: 去除冗余代码
- [ ] 删除 `src/workers/` 目录（4 个 worker 文件）
- [ ] 删除 `src/lib/queue.ts`（BullMQ 队列定义）
- [ ] 删除 `src/lib/cache.ts`（Redis 连接）
- [ ] 删除 `src/lib/ai-client.ts`（callAgentOS 的薄封装）
- [ ] 简化 `src/lib/agentos-client.ts`（移除 legacy callAgentOS）
- [ ] 删除 deprecated route handlers
- [ ] 删除已注释的 rate limiter
- [ ] 删除 docker-compose.yml 中的 redis/worker 服务
- [ ] 清理 package.json 无用依赖（bullmq, ioredis, fastify 系列）
- **Status:** pending

### Phase 7: 测试与部署
- [ ] 本地 `vercel dev` 测试所有 endpoints
- [ ] 验证 SSE streaming（chat、storyboard）
- [ ] 验证 Supabase Storage 上传/读取
- [ ] 验证 Prisma 连接池在 serverless 环境
- [ ] `vercel deploy` 部署到 staging
- [ ] 验证生产环境 AgentOS 连通性
- [ ] 更新 CLAUDE.md
- **Status:** pending

## Key Questions (已解答)

| Question | Answer |
|----------|--------|
| Vercel Function Type | Serverless Functions (Node.js runtime) |
| AgentOS 部署 | 独立部署，TS 通过 HTTP/SSE 调用 |
| 长任务策略 | SSE 为主，60s 分段 + 自动重连 |
| API 框架 | Hono |
| Vercel 计划 | Hobby (60s timeout) |
| 是否移除 Redis | 是，完全移除 |

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Hono 框架 | 轻量、TypeScript 原生、Vercel 官方支持、API 类似 Express 迁移成本低 |
| Vercel Hobby (60s) | 用户选择；SSE 分段续传解决 timeout 限制 |
| AgentOS 独立部署 | Python 不适合 Vercel；Agno 框架需要长运行进程 |
| SSE 60s chunk 协议 | Hobby 60s 硬限制；通过 cursor-based 续传实现长任务 |
| 移除 BullMQ + Redis | Vercel serverless 无持久进程，SSE 替代队列 |
| Supabase Storage 统一 | Vercel 无持久磁盘，移除 local storage driver |
| 保留 Prisma + Supabase PG | 已有 13 model schema，迁移成本低 |
| Supabase connection pooler | Serverless 环境连接数管理必需 |

## 目标目录结构

```
story_agent/
├── api/                          # Vercel serverless functions (Hono)
│   └── [[...route]].ts           # Hono catch-all handler
├── src/
│   ├── app.ts                    # Hono app 定义、路由注册
│   ├── routes/                   # 路由模块
│   │   ├── health.ts
│   │   ├── auth.ts
│   │   ├── projects.ts
│   │   ├── scripts.ts
│   │   ├── chat.ts               # SSE 流式
│   │   ├── storyboard.ts         # SSE 流式
│   │   ├── characters.ts
│   │   ├── locations.ts
│   │   ├── polish.ts
│   │   ├── assets.ts
│   │   ├── uploads.ts
│   │   ├── tasks.ts
│   │   ├── inspirations.ts
│   │   ├── generation-jobs.ts
│   │   └── ai-providers.ts
│   ├── middleware/
│   │   ├── auth.ts               # JWT 验证
│   │   ├── error-handler.ts      # 统一错误处理
│   │   └── cors.ts               # CORS
│   ├── services/                 # 业务逻辑（保留）
│   ├── lib/
│   │   ├── db.ts                 # Prisma（连接池优化）
│   │   ├── agentos-client.ts     # AgentOS HTTP/SSE client（简化）
│   │   ├── sse.ts                # SSE helper（60s chunk 协议）
│   │   ├── errors.ts             # 统一错误类型
│   │   ├── logger.ts             # 日志
│   │   └── storage.ts            # Supabase Storage only
│   └── db/
│       └── schema.prisma
├── agentos/                      # Python AgentOS（独立部署）
├── vercel.json
├── package.json
└── tsconfig.json
```

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | - | - |

## Notes
- Vercel Hobby 60s 是硬限制，SSE 需要分段续传协议
- Prisma 在 Serverless 需要使用 Supabase connection pooler (port 6543) 而非直连 (port 5432)
- AgentOS 独立部署后需要配置 CORS 允许 Vercel 域名
- Hono 的 `c.stream()` 和 `c.streamSSE()` 原生支持 SSE
- 需要在 AgentOS 端也实现续传支持（session cursor）
