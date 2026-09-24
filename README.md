<div align="center">
  <img src="docs/assets/logo.png" alt="Dramo" width="72" height="72">

# Dramo

**AI 剧本工作区 — 从大纲到分镜，一处写完。**

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)](./docker-compose.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](./web)
[![Hono](https://img.shields.io/badge/Hono-v4-e36002?style=flat-square)](./server)

</div>

<p align="center">
  <img src="docs/assets/cover.jpg" alt="Dramo — AI screenplay workspace" width="100%">
</p>

Dramo 是 Docker Compose 一键部署的全栈 Monorepo：Next.js 工作台 + Hono API + AgentOS（Agno）剧本 revise。需要注册 / 登录（cookie session `dramo_session`）。不存在 `default-local-user`。

```
Nginx (:80)  →  Web (:12323)  +  /api/* → Server (:12321)  →  AgentOS (:12322)
```

## 快速开始

### 1. 生产 / 一键部署（推荐）

```bash
git clone https://github.com/yuymf/dramo.git && cd dramo
./deploy/setup-dramo.sh         # 自动生成密钥 + 启动所有容器
# 访问 http://localhost
```

或手动：

```bash
cp .env.example .env
# 至少填 ENCRYPTION_KEY（openssl rand -hex 32）
# 出图还需 SD_WORKERS（Docker 内 127.0.0.1 指向容器自己，不可用）
docker compose up -d --build
```

运维脚本：

```bash
./deploy/logs.sh [service] [-f]
./deploy/update.sh
```

### 2. 本地开发（无 Docker 全栈）

```bash
npm install                     # 生成 / 更新根目录 package-lock.json（npm workspaces）
cd agentos && pip install -r requirements.txt && cd ..

docker run -d --name dramo-pg \
  -e POSTGRES_DB=dramo -e POSTGRES_USER=dramo -e POSTGRES_PASSWORD=dramo_secret \
  -p 5432:5432 postgres:15-alpine

cp server/env.example server/.env
npm run prisma:generate
npm run prisma:migrate
npm run dev                     # web :12323 + server :12321 + agentos :12322
```

浏览器走相对路径 `/api/*`；Next.js 代理到 `BACKEND_API_URL`（默认 `http://localhost:12321`）。

## 架构概览

三层服务，由 Nginx 反向代理统一对外暴露：

```
              Nginx (:80)
            /          \
         /  /api/*       /
       Web (:12323)   API (:12321) — Hono v4 + Prisma 5 + PostgreSQL
                         |
                    AgentOS (:12322) — FastAPI + Agno
```

| 服务 | 技术栈 | 端口 |
|------|--------|------|
| **web** | Next.js 15 + React 19 + Tailwind v4 | 12323 |
| **server** | Hono v4 + Prisma 5 + 本地 PostgreSQL | 12321 |
| **agentos** | Python FastAPI + Agno | 12322 |

鉴权：`server/src/middleware/session.ts`。除 `/auth/*` 与 `/health` 外，未带有效 session cookie 一律 401。

静帧出图走 `SD_WORKERS`（A1111 兼容池，`server/src/services/sd-pool.service.ts`）。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 一键启动 web + server + agentos |
| `npm run dev:web` | 只启动前端 (`:12323`) |
| `npm run dev:server` | 只启动后端 API (`:12321`) |
| `npm run dev:agentos` | 只启动 AgentOS (`:12322`) |
| `npm run build` | 构建后端 + 前端 |
| `npm run lint` | 检查前后端代码规范 |
| `npm run test` | 运行后端测试 |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:migrate` | 运行数据库迁移 |
| `npm run prisma:studio` | 打开数据库浏览器 |
| `npm run test:e2e -w @dramo/web` | Playwright 本地 e2e（需先起 web，默认 `http://localhost:12323`） |

## CI

Push / PR 到 `main` 时，[`.github/workflows/ci.yml`](.github/workflows/ci.yml) 硬门禁跑 **lint**、**server Jest**（含 `prisma:generate`）和 **AgentOS pytest**（无密钥）。Playwright e2e 仍由独立的 [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) 门禁，不在本 workflow 内。

## 技术栈

- **前端**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4 + Radix/shadcn
- **后端**: Hono v4 + Prisma 5 + 本地 PostgreSQL + pino + AES-256-GCM
- **AI**: AgentOS（Agno 工作流；产品路径是剧本 revise）+ 本机 SD worker 池
- **基建**: Docker Compose + Nginx + npm workspaces + concurrently
- **节点**: Node.js 20+

## 文档

- [产品需求：对标 Laper](docs/prd-laper-parity.md)
- [第一期任务拆分](docs/phase1-wbs.md)
- [第一期共享契约](docs/phase1-contracts.md)
- [架构与设计](docs/architecture.md)
- [API 接口参考](docs/api-reference.md)
- [数据库模型](docs/database-schema.md)
- [环境变量与部署](docs/env-and-deploy.md)

## 注意事项

- 根目录 `.env` 由 docker-compose 注入各容器。只保留 compose 会注入、且代码会读的变量。
- 本地开发：`server/.env`；AgentOS 经 `env_loader.py` 读 `../server/.env`。
- LLM 密钥存在库里（`UserLLMConfig`），调用时写入 workflow `message` 的 `_llm_config`。
- `npm ci` 需要根目录 `package-lock.json`。没有时在仓库根跑 `npm install` 生成。
