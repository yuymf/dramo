# Dramo — AI 直播台本生成助手

## 项目概览

Dramo 是一个全栈 AI 驱动的直播台本生成工具，采用 Monorepo 架构。

## 目录结构

- `web/` — Next.js 15 前端 (React 19, Tailwind CSS v4, 端口 12323)
- `server/` — Hono v4 后端 API (Prisma 5, Supabase, 端口 12321)
- `agentos/` — Python AgentOS AI 服务 (FastAPI + Agno, 端口 12322)
- `deploy/` — 部署脚本与配置 (setup-dramo.sh, nginx.conf, update.sh, logs.sh)

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

### 腾讯云 VPS 一键部署（推荐）

推荐配置：轻量应用服务器 2C4G Ubuntu 22.04（~60-80 元/月）

```bash
# SSH 到服务器后执行
bash <(curl -fsSL https://raw.githubusercontent.com/你的仓库/main/deploy/setup-dramo.sh)
```

脚本自动完成：系统检测 → Docker 安装 → 代码克隆 → 环境变量配置 → 构建启动 → 健康检查

架构：

```
用户 :80 → Nginx → ├── /     → Next.js (:3000)
                    └── /api/ → Hono API (:12321) → AgentOS (:12322, 仅内网)
```

日常运维：

```bash
cd /opt/dramo
./deploy/update.sh       # 拉取最新代码并重启
./deploy/logs.sh         # 查看所有服务日志
./deploy/logs.sh api -f  # 实时跟踪某个服务
docker compose ps        # 查看服务状态
```

### Vercel 部署

- 后端 Vercel: Root Directory 指向 `server/`（注意：Serverless 有 60s 超时限制，分镜生成等长任务不可用）
- AgentOS 需独立部署到 VPS

### 本地 Docker 开发

```bash
docker compose up -d                        # 启动 nginx + web + api + agentos
docker compose --profile localpg up -d      # 同上 + 本地 PostgreSQL
```

### 环境切换

```bash
./switch-env.sh debug   # 切换到本地开发环境
./switch-env.sh prod    # 切换到生产环境
./switch-env.sh status  # 查看当前环境状态
```

## 注意事项

- 环境变量在根目录 `.env.debug` / `.env.production` 统一管理，由 `switch-env.sh` 分发
- `server/.env` 供后端和 AgentOS 使用
- `web/.env.local` 供 Next.js 前端使用
- AgentOS 的 `env_loader.py` 从 `../server/.env` 读取后端环境变量

## 测试账号

### 本地测试账号

- 邮箱: `demo@example.com`
- 密码: `demo123456`
