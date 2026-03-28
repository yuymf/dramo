# Dramo — AI 直播台本生成助手

## 项目概览

Dramo 是一个全栈 AI 驱动的直播台本生成工具，采用 Monorepo 架构。

## 目录结构

- `web/` — Next.js 15 前端 (React 19, Tailwind CSS v4, 端口 12323)
- `server/` — Hono v4 后端 API (Prisma 5, Supabase, 端口 12321)
- `agentos/` — Python AgentOS AI 服务 (FastAPI + Agno, 端口 12322)

## 开发

```bash
npm install          # 安装所有依赖
./switch-env.sh debug  # 切换到本地开发环境
npm run dev          # 一键启动 web + server + agentos
```

## 代码规范

- 前端: ESLint v9 (Flat Config) — `npm run lint -w @dramo/web`
- 后端: ESLint v8 (Traditional Config) — `npm run lint -w @dramo/server`
- 前后端各自独立的 ESLint 配置，不要统一版本

## 数据库

Prisma schema 位于 `server/src/db/schema.prisma`

```bash
npm run prisma:generate   # 生成 Prisma Client
npm run prisma:migrate    # 运行数据库迁移
npm run prisma:studio     # 打开数据库浏览器
```

## 部署

- 后端 Vercel: Root Directory 指向 `server/`
- Docker: `docker compose up` (api + agentos，可选 localpg)
- 环境切换: `./switch-env.sh prod`

## 注意事项

- 环境变量在根目录 `.env.debug` / `.env.production` 统一管理，由 `switch-env.sh` 分发
- `server/.env` 供后端和 AgentOS 使用
- `web/.env.local` 供 Next.js 前端使用
- AgentOS 的 `env_loader.py` 从 `../server/.env` 读取后端环境变量
