# Dramo

AI 直播台本生成助手 — 一键启动的全栈 Monorepo 项目。

## 项目结构

```
dramo/
├── web/          # Next.js 15 前端 (端口 12323)
├── server/       # Hono 后端 API (端口 12321)
├── agentos/      # Python AgentOS AI 服务 (端口 12322)
├── package.json  # npm workspaces root
└── switch-env.sh # 环境切换脚本
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 切换到本地开发环境
./switch-env.sh debug

# 3. 编辑 server/.env 填入真实的 DATABASE_URL 等配置
vim server/.env

# 4. 一键启动全部服务
npm run dev
```

三个服务会并行启动：
- **web**: http://localhost:12323 — Next.js 前端
- **server**: http://localhost:12321 — Hono 后端 API
- **agentos**: http://localhost:12322 — Python AgentOS AI

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 一键启动全部三个服务 |
| `npm run dev:web` | 只启动前端 |
| `npm run dev:server` | 只启动后端 API |
| `npm run dev:agentos` | 只启动 AgentOS |
| `npm run build` | 构建后端 + 前端 |
| `npm run lint` | 检查前后端代码规范 |
| `npm run test` | 运行后端测试 |
| `npm run prisma:studio` | 打开 Prisma 数据库浏览器 |
| `./switch-env.sh status` | 查看当前环境配置 |

## 环境切换

```bash
./switch-env.sh debug      # 本地开发（全部 localhost）
./switch-env.sh prod       # 生产环境（连接远端）
./switch-env.sh status     # 查看当前状态
```

环境变量统一管理在根目录的 `.env.debug` / `.env.production` 模板中，脚本会自动分发到 `server/.env` 和 `web/.env.local`。

## 技术栈

- **前端**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4
- **后端**: Hono v4 + Prisma 5 + Supabase PostgreSQL
- **AI**: Python FastAPI + Agno (AgentOS)
- **Monorepo**: npm workspaces + concurrently
