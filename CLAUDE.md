# Dramo — AI 直播台本生成助手

## 项目概览

Dramo 是一个全栈 AI 驱动的直播台本生成工具，采用 Monorepo 架构。三层服务协作：

1. **Web 前端** (Next.js 15, React 19, Tailwind CSS v4) — 端口 12323
2. **Server 后端** (Hono v4, Prisma 5, PostgreSQL) — 端口 12321
3. **AgentOS AI 服务** (FastAPI + Agno 多智能体框架) — 端口 12322

> 详细文档按需查阅:
> - [API 接口参考](docs/api-reference.md) — 全部 70+ 端点
> - [数据库模型](docs/database-schema.md) — 17 张表、约束、关系图
> - [架构与设计模式](docs/architecture.md) — 数据流、SSE、异步任务、AgentOS 工作流
> - [环境变量与部署](docs/env-and-deploy.md) — 环境配置、3 种部署方案、运维

## 目录结构

```
dramo/
├── web/                    # Next.js 15 前端
│   ├── app/                #   App Router 页面 + API 代理 (/api/_utils/proxy.ts)
│   │   └── projects/[id]/  #   项目工作区 (@sidebar + @content 并行路由)
│   ├── components/         #   按功能分组: editor, characters, storyboard, chat, ...
│   └── lib/                #   api/, hooks/, types/, utils/, models.ts
├── server/                 # Hono v4 后端
│   └── src/
│       ├── routes/         #   19 个路由文件
│       ├── services/       #   13 个业务服务
│       ├── middleware/      #   auth (JWT), error-handler
│       ├── lib/            #   db, agentos-client, sse, errors, encryption
│       └── db/schema.prisma #  数据库模型
├── agentos/                # Python AI 服务
│   ├── workflows/          #   6 个 Agno 工作流
│   ├── services/           #   图片生成 (Seedream/ARK)
│   └── prompts/            #   Markdown 提示词模板
├── deploy/                 # 部署脚本 (setup, update, logs, nginx)
├── docker-compose.yml      # 多服务编排
└── switch-env.sh           # 环境切换 (debug/prod)
```

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 15, React 19, TypeScript strict, Tailwind CSS v4, Radix/shadcn, TipTap, @dnd-kit, @xyflow/react |
| **后端** | Hono v4, Prisma 5, PostgreSQL (Supabase), pino, JWT, AES-256-GCM |
| **AI** | FastAPI + Agno, OpenAI / Hunyuan / ARK, Seedream / Doubao |
| **基建** | Docker, Nginx, Stripe, Playwright, NextAuth v4 |

## 开发

```bash
npm install                # 安装所有依赖
./switch-env.sh debug      # 切换到本地开发环境
npm run dev                # 一键启动 web + server + agentos

npm run dev:web            # 仅前端 (:12323)
npm run dev:server         # 仅后端 (:12321)
npm run dev:agentos        # 仅 AgentOS (:12322)
```

## 代码规范

- **前端**: ESLint v9 (Flat Config) — `npm run lint -w @dramo/web`
- **后端**: ESLint v8 (Traditional Config) — `npm run lint -w @dramo/server`
- 前后端各自独立的 ESLint 配置，不要统一版本
- TypeScript strict 模式，ES2022 target，ESM 模块
- **设计风格**: MUJI 风 — 奶油色/米白背景、宋体 SC / Georgia 正文、大量留白、线条图标。AI 伙伴为猫咪角色。

## 数据库

Prisma schema: `server/src/db/schema.prisma` → 详见 [数据库模型](docs/database-schema.md)

```bash
npm run prisma:generate   # 生成 Prisma Client (schema 变更后必须)
npm run prisma:migrate    # 运行数据库迁移
npm run prisma:studio     # 打开数据库浏览器
```

核心模型: `User` → `Project` → `Script`/`CharacterAsset`/`LocationAsset`/`Storyboard`/`ChatMessage`/`GenerationJob`

## API 概览

完整接口: [API 接口参考](docs/api-reference.md)

| 模块 | 端点数 | 关键能力 |
|------|--------|---------|
| 认证 | 3 | 注册、登录 (JWT) |
| 项目 | 5 | CRUD |
| 台本 | 6 | 生成、编辑、版本、回退 |
| 角色 | 7+5 | 提取 (SSE)、资产 CRUD、关系图 |
| 场景 | 7 | 提取 (SSE)、资产 CRUD |
| 分镜 | 6 | 导入 (SSE/异步)、帧持久化 |
| 对话 | 3 | 消息、AI 流式回复 |
| 图片/任务 | 6 | 生成队列、SSE 轮询、重试 |
| LLM 配置 | 5 | CRUD、加密存储 |
| 计费 | 5 | Stripe 订阅 |

**关键模式**: 统一错误信封 `{error: {code, message, retryable}, requestId}` · SSE 55s 超时 + 心跳 + 自动重连 · 异步任务 (202 + taskId + 轮询)

## 架构要点

详见 [架构与设计模式](docs/architecture.md)

- **API 代理**: 浏览器 → Next.js API Routes (注入 Bearer Token) → Hono 后端
- **SSE 流**: 对话、分镜、角色/场景提取、润色 — 55s 超时 + 15s 心跳
- **AgentOS 工作流**: 分镜 (4 阶段并行)、台本生成、角色/场景提取、润色
- **图片生成**: 智能模式选择 (text_to_image / image_to_image / merge 等)

## 部署

详见 [环境变量与部署](docs/env-and-deploy.md)

```bash
# 本地 Docker
docker compose up -d
docker compose --profile localpg up -d      # 含本地 PostgreSQL

# 环境切换
./switch-env.sh debug   # 开发
./switch-env.sh prod    # 生产
```

## 测试

```bash
npm test                          # Jest 后端测试
npm run e2e                       # Playwright E2E
cd agentos && python -m pytest    # Python 测试
```

## 注意事项

- 环境变量在根目录 `.env.debug` / `.env.production` 统一管理，由 `switch-env.sh` 分发
- `server/.env` 供后端和 AgentOS 使用; `web/.env.local` 供前端使用
- AgentOS 的 `env_loader.py` 从 `../server/.env` 读取环境变量
- Node.js 20+ 必需

## 测试账号

- 邮箱: `demo@example.com`
- 密码: `demo123456`
