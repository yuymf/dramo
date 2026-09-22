# Dramo

AI 剧本工作区 — Docker Compose 一键部署的全栈 Monorepo。需要注册 / 登录（cookie session `dramo_session`）。

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

鉴权：`server/src/middleware/session.ts`。除 `/auth/*` 与 `/health` 外，未带有效 session cookie 一律 401。不存在 `default-local-user`。

静帧出图走 `SD_WORKERS`（A1111 兼容池，`server/src/services/sd-pool.service.ts`）。

## 快速开始（生产 / 一键部署）

```bash
git clone <repo-url> && cd dramo
./deploy/setup-dramo.sh         # 自动生成密钥 + 启动所有容器
# 访问 http://localhost
```

或手动：

```bash
cp .env.example .env
# 至少填 ENCRYPTION_KEY (openssl rand -hex 32)
# 出图还需 SD_WORKERS（Docker 内 127.0.0.1 指向容器自己，不可用）
docker compose up -d --build
```

```bash
./deploy/logs.sh [service] [-f]
./deploy/update.sh
```

## 本地开发（无 Docker）

```bash
npm install                     # 生成 / 更新根目录 package-lock.json（npm workspaces 需要）
cd agentos && pip install -r requirements.txt && cd ..

docker run -d --name dramo-pg \
  -e POSTGRES_DB=dramo -e POSTGRES_USER=dramo -e POSTGRES_PASSWORD=dramo_secret \
  -p 5432:5432 postgres:15-alpine

cp .env.example server/.env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

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

## 技术栈

- **前端**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4 + Radix/shadcn + TipTap + @dnd-kit + @xyflow/react
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
