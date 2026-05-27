# Dramo — AI 直播台本生成助手

## 项目概览

Dramo 是一个全栈 AI 驱动的直播台本生成工具，采用 Monorepo 架构，单服务器一键部署。三层服务协作：

1. **Web 前端** (Next.js 15, React 19, Tailwind CSS v4) — 端口 12323
2. **Server 后端** (Hono v4, Prisma 5, PostgreSQL) — 端口 12321
3. **AgentOS AI 服务** (FastAPI + Agno 多智能体框架) — 端口 12322

> **部署模式**: 纯工具型单用户应用，无登录/无计费，`docker compose up -d` 一键启动。

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
├── docker-compose.yml      # 5 容器编排 (postgres, api, agentos, web, nginx)
└── .env.example            # 环境变量模板
```

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 15, React 19, TypeScript strict, Tailwind CSS v4, Radix/shadcn, TipTap, @dnd-kit, @xyflow/react |
| **后端** | Hono v4, Prisma 5, PostgreSQL (本地), pino, AES-256-GCM |
| **AI** | FastAPI + Agno, OpenAI / Hunyuan / ARK, Seedream / Doubao |
| **基建** | Docker Compose, Nginx, Playwright |

## 开发

```bash
npm install                # 安装所有依赖
npm run dev                # 一键启动 web + server + agentos

npm run dev:web            # 仅前端 (:12323)
npm run dev:server         # 仅后端 (:12321)
npm run dev:agentos        # 仅 AgentOS (:12322)
```

## 部署（一键）

```bash
git clone <repo-url> && cd dramo
./deploy/setup-dramo.sh    # 自动安装 Docker、生成密钥、启动所有服务
# 访问 http://localhost
```

或手动：
```bash
cp .env.example .env
# 编辑 .env 填入 ENCRYPTION_KEY (openssl rand -hex 32)
docker compose up -d --build
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

> 认证已移除。后端使用默认用户中间件，所有请求自动关联 `default-local-user`。

## API 概览

完整接口: [API 接口参考](docs/api-reference.md)

| 模块 | 端点数 | 关键能力 |
|------|--------|---------|
| 项目 | 5 | CRUD |
| 台本 | 6 | 生成、编辑、版本、回退 |
| 角色 | 7+5 | 提取 (SSE)、资产 CRUD、关系图 |
| 场景 | 7 | 提取 (SSE)、资产 CRUD |
| 分镜 | 6 | 导入 (SSE/异步)、帧持久化 |
| 对话 | 3 | 消息、AI 流式回复 |
| 图片/任务 | 6 | 生成队列、SSE 轮询、重试 |
| LLM 配置 | 5 | CRUD、加密存储 |

**关键模式**: 统一错误信封 `{error: {code, message, retryable}, requestId}` · SSE 55s 超时 + 心跳 + 自动重连 · 异步任务 (202 + taskId + 轮询)

## 架构要点

详见 [架构与设计模式](docs/architecture.md)

- **API 代理**: 浏览器 → Next.js API Routes (注入 Bearer Token) → Hono 后端
- **SSE 流**: 对话、分镜、角色/场景提取、润色 — 55s 超时 + 15s 心跳
- **AgentOS 工作流**: 分镜 (4 阶段并行)、台本生成、角色/场景提取、润色
- **图片生成**: 智能模式选择 (text_to_image / image_to_image / merge 等)

## 部署详情

```bash
# 一键部署 (VPS 或本地)
./deploy/setup-dramo.sh

# 手动 Docker
cp .env.example .env && docker compose up -d --build

# 查看日志
./deploy/logs.sh [service] [-f]

# 更新
./deploy/update.sh
```

环境变量参考: `.env.example`

## 测试

```bash
npm test                          # Jest 后端测试
npm run e2e                       # Playwright E2E
cd agentos && python -m pytest    # Python 测试
```

## 注意事项

- 环境变量通过根目录 `.env` 管理（参考 `.env.example`）
- `server/.env` 由开发时手动创建；生产环境通过 Docker Compose environment 注入
- AgentOS 的 `env_loader.py` 从 `../server/.env` 读取环境变量
- Node.js 20+ 必需
- 无需外部数据库 — 本地 PostgreSQL 容器自动启动
- 存储使用本地文件系统 (`/app/uploads` volume)
- 无认证 — 默认用户自动注入，所有接口无需 token

## 测试账号

本地工具模式，无需登录。默认用户 `local@dramo.tool` 自动使用。
