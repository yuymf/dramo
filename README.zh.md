<div align="center">
  <img src="docs/assets/logo.png" alt="Dramo" width="72" height="72">

# Dramo

**AI 剧本工作区 — 从大纲到分镜，一处写完。**

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)](./docker-compose.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](./web)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

[English](README.md) · [中文](#) · [架构](docs/architecture.md) · [环境与部署](docs/env-and-deploy.md) · [API](docs/api-reference.md)
</div>

<p align="center">
  <img src="docs/assets/cover.jpg" alt="Dramo — AI 剧本工作区" width="100%">
</p>

Dramo 是 Docker Compose 一键部署的全栈 Monorepo：Next.js 工作台 + Hono API + AgentOS（Agno）剧本 revise + PostgreSQL。需要注册 / 登录（cookie session `dramo_session`）。不存在 `default-local-user`。

```
Nginx (:80)  →  Web (:12323 / :3000)  +  /api/* → Server (:12321)  →  AgentOS (:12322)
```

## 功能

- 🎬 **剧本工作区** — 场次、对白、大纲、节拍，同一份文档真相源
- ✨ **有边界的 AI 改写** — 选区 / 场次 / 实体 / 大纲预览，接受或拒绝
- 🧍 **推导实体** — 角色、地点、道具从正文来，不是另一套平行数据
- 🖼️ **分镜 + SD 池** — A1111 兼容 worker 池（`SD_WORKERS`）出静帧
- 🐳 **一键 Docker** — Compose 拉起 web / API / AgentOS / Postgres / Nginx

## 快速开始（Docker，推荐）

```bash
git clone https://github.com/yuymf/dramo.git
cd dramo
./deploy/setup-dramo.sh    # 生成 .env 密钥并 docker compose up -d --build
# 访问 http://localhost
```

或手动：

```bash
cp .env.example .env
# 生产必填：ENCRYPTION_KEY=$(openssl rand -hex 32)
docker compose up -d --build
```

运维：`./deploy/logs.sh [service] [-f]` · `./deploy/update.sh`

> **实话：** 完整产品依赖 Postgres + Hono + AgentOS。全栈一键路径是 Docker Compose。单独的 `web/` 可以挂到 Vercel（需设置 `BACKEND_API_URL` 指向已部署的 API）——**不是**全栈一键上 Vercel。

[![Deploy web with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyuymf%2Fdramo&root-directory=web&env=BACKEND_API_URL,NEXT_PUBLIC_API_URL&envDescription=BACKEND_API_URL%20must%20point%20at%20your%20deployed%20Hono%20API%20(full%20stack%20still%20needs%20Docker).&envLink=https%3A%2F%2Fgithub.com%2Fyuymf%2Fdramo%2Fblob%2Fmain%2Fdocs%2Fenv-and-deploy.md&project-name=dramo-web&repository-name=dramo)

## 环境变量

根目录 `.env`（见 [`.env.example`](.env.example)）：

| 变量 | 必需 | 用途 |
|:---|:---:|:---|
| `ENCRYPTION_KEY` | **生产必填** | 64 位 hex；加密 `UserLLMConfig` |
| `DB_PASSWORD` | 是 | Postgres 密码 |
| `AGENTOS_KEY` | 是 | api ↔ agentos 共享密钥 |
| `PUBLIC_URL` | 是 | 对外 Origin |
| `PORT` | 否 | Nginx 宿主端口（默认 `80`） |
| `SD_WORKERS` | 出图需要 | JSON worker 池；容器内勿写 `127.0.0.1` |

LLM 密钥在界面 **设置 → LLM 配置** 填写，不进进程环境变量。本地开发见 [docs/env-and-deploy.md](docs/env-and-deploy.md)。

## 本地开发（不全用 Docker）

```bash
npm install
cd agentos && pip install -r requirements.txt && cd ..

docker run -d --name dramo-pg \
  -e POSTGRES_DB=dramo -e POSTGRES_USER=dramo -e POSTGRES_PASSWORD=dramo_secret \
  -p 5432:5432 postgres:15-alpine

cp server/env.example server/.env
npm run prisma:generate && npm run prisma:migrate
npm run dev
```

## 架构

| 服务 | 技术栈 | 端口 |
|:---|:---|:---|
| **web** | Next.js 15 + React 19 + Tailwind v4 | 12323 / 3000 |
| **server** | Hono v4 + Prisma 5 + PostgreSQL | 12321 |
| **agentos** | FastAPI + Agno | 12322 |
| **nginx** | 反向代理 | 80 |

## 许可证

[MIT](./LICENSE) © 2026 Yuymf
