# Dramo

AI 直播台本生成助手 — Docker Compose 一键部署的全栈 Monorepo 应用。

## 架构概览

三层服务，由 Nginx 反向代理统一对外暴露：

```
              Nginx (:80)
            /          \
         /  /api/*       /
       Web (:12323)   API (:12321) — Hono v4 + Prisma 5 + PostgreSQL
                         |
                    AgentOS (:12322) — FastAPI + Agno 多智能体工作流
```

| 服务 | 技术栈 | 端口 |
|------|--------|------|
| **web** | Next.js 15 + React 19 + Tailwind v4 | 12323 |
| **server** | Hono v4 + Prisma 5 + 本地 PostgreSQL | 12321 |
| **agentos** | Python FastAPI + Agno | 12322 |

> 纯工具型单用户应用，**无登录、无计费**。所有请求由后端默认用户中间件自动注入。

## 快速开始（生产 / 一键部署）

```bash
git clone <repo-url> && cd dramo
./deploy/setup-dramo.sh         # 自动生成密钥 + 启动所有容器
# 访问 http://localhost
```

或手动：

```bash
cp .env.example .env
# 编辑 .env，至少填入 ENCRYPTION_KEY (openssl rand -hex 32)
docker compose up -d --build
```

部署辅助脚本：

```bash
./deploy/logs.sh [service] [-f] # 查看容器日志
./deploy/update.sh              # 拉取代码 + 重建 + 重启
```

## 本地开发（无 Docker）

```bash
# 1. 安装依赖（npm workspaces）
npm install

# 2. Python 依赖
cd agentos && pip install -r requirements.txt && cd ..

# 3. 启动本地 PostgreSQL（推荐用 Docker）
docker run -d --name dramo-pg \
  -e POSTGRES_DB=dramo -e POSTGRES_USER=dramo -e POSTGRES_PASSWORD=dramo_secret \
  -p 5432:5432 postgres:15-alpine

# 4. 配置 server/.env（DATABASE_URL、ENCRYPTION_KEY 等）
cp .env.example server/.env

# 5. 数据库迁移
npm run prisma:generate
npm run prisma:migrate

# 6. 一键启动三个服务（concurrently）
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

- **前端**: Next.js 15 + React 19 + TypeScript strict + Tailwind CSS v4 + Radix/shadcn + TipTap + @dnd-kit + @xyflow/react
- **后端**: Hono v4 + Prisma 5 + 本地 PostgreSQL + pino + AES-256-GCM
- **AI**: Python FastAPI + Agno 多智能体框架（OpenAI / Hunyuan / ARK Seedream）
- **基建**: Docker Compose + Nginx + npm workspaces + concurrently
- **节点**: Node.js 20+

## 文档

- [产品需求：对标 Laper](docs/prd-laper-parity.md)
- [架构与设计](docs/architecture.md)
- [API 接口参考](docs/api-reference.md)
- [数据库模型](docs/database-schema.md)
- [环境变量与部署](docs/env-and-deploy.md)

## 注意事项

- 环境变量统一在根目录 `.env` 管理，由 docker-compose 注入到各容器
- 本地开发时 `server/.env` 与 `agentos` 共享变量（agentos `env_loader.py` 从 `../server/.env` 读取）
- 无外部依赖：本地 PostgreSQL 容器自动启动；存储使用本地文件系统 (`/app/uploads` volume)
- 默认用户 `local@dramo.tool` 在首次启动时自动创建
