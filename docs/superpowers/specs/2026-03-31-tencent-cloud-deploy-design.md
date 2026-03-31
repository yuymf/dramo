# Dramo 腾讯云一键部署方案

**日期**: 2026-03-31
**状态**: 待实现

## 概览

将 Dramo 全栈（Next.js 前端 + Hono 后端 + AgentOS Python 服务）部署到一台腾讯云 VPS 上，通过 Docker Compose 编排，Nginx 反向代理统一入口。提供一键部署脚本，新服务器上运行一次即可完成全部配置。

## 目标

1. 一个 `setup-dramo.sh` 脚本完成从裸机到服务可用的全流程
2. 消除 Vercel Serverless 60s 超时限制，分镜生成 / 图片生成等长任务正常运行
3. 不改变现有业务代码逻辑，仅增加部署相关文件
4. 提供日常运维脚本（更新、日志、重启）

## 非目标

- HTTPS / 域名配置（后续绑定域名时再加）
- 本地 PostgreSQL（继续使用远程 Supabase）
- CI/CD 自动部署流水线（手动运行更新脚本）
- 监控告警系统

## 架构

```
用户浏览器
    │
    ▼ :80
┌──────────────────── Docker Network: dramo-network ────────────────────┐
│                                                                       │
│  Nginx (nginx:alpine)                                                 │
│    ├── /           → web:3000    (Next.js standalone)                  │
│    └── /api/       → api:12321   (Hono 长驻进程)                       │
│                                                                       │
│  web        (Next.js 15, standalone 输出, 端口 3000)                   │
│  api        (Hono + Prisma, Node.js 20, 端口 12321)                   │
│  agentos    (FastAPI + Agno, Python 3.11, 端口 12322, 仅内网可访问)     │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                          │
                          ▼ 外网
                    Supabase (PostgreSQL + Storage)
```

### 端口暴露策略

| 服务 | 容器端口 | 对外暴露 | 访问方式 |
|------|----------|----------|----------|
| nginx | 80 | 80 | 唯一对外入口 |
| web | 3000 | 不暴露 | nginx → `http://web:3000` |
| api | 12321 | 不暴露 | nginx → `http://api:12321` |
| agentos | 12322 | 不暴露 | api → `http://agentos:12322` |

## 服务器推荐配置

| 配置项 | 推荐 | 原因 |
|--------|------|------|
| CPU | 2 核+ | AgentOS 主要等 LLM API 响应，不吃 CPU |
| 内存 | 4GB+ | Next.js + Hono + FastAPI 共存 |
| 磁盘 | 50GB SSD | Docker 镜像 + 日志 |
| 带宽 | 5Mbps+ | 文本为主，流量不大 |
| 系统 | Ubuntu 22.04 / 24.04 | Docker 官方源支持最好 |
| 腾讯云型号 | 轻量应用服务器 2C4G | ~60-80 元/月，性价比最高 |

## 新增文件清单

```
deploy/
├── setup-dramo.sh          # 一键部署脚本（主入口）
├── update.sh               # 更新部署脚本
├── logs.sh                 # 查看日志脚本
├── nginx.conf              # Nginx 配置
└── .env.template           # 环境变量模板（带注释）

web/
└── Dockerfile              # Next.js standalone 构建（新增）

docker-compose.yml          # 改造：加 nginx + web 容器
web/next.config.ts          # 改造：加 output: "standalone"
```

## 需改造的现有文件

### 1. `docker-compose.yml`

**新增 nginx 服务：**
```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./deploy/nginx.conf:/etc/nginx/nginx.conf:ro
  depends_on:
    web:
      condition: service_healthy
    api:
      condition: service_healthy
  restart: unless-stopped
  networks:
    - dramo-network
```

**新增 web 服务：**
```yaml
web:
  build:
    context: ./web
    dockerfile: Dockerfile
  environment:
    - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    - NEXTAUTH_URL=${NEXTAUTH_URL}
    - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000"]
    interval: 30s
    timeout: 5s
    retries: 3
  restart: unless-stopped
  networks:
    - dramo-network
```

**改动 api 服务：**
- 移除 `ports: ["12321:12321"]`（不再对外暴露）
- 确保 `AGENTOS_BASE_URL=http://agentos:12322`

**改动 agentos 服务：**
- 移除 `ports: ["12322:12322"]`（不再对外暴露）

### 2. `web/Dockerfile`（新建）

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

### 3. `web/next.config.ts`

添加 `output: "standalone"` 到 Next.js 配置中。

### 4. `NEXT_PUBLIC_*` 构建时烘焙问题

Next.js 的 `NEXT_PUBLIC_*` 变量在 `npm run build` 时被内联到客户端 JS 中（构建时烘焙），运行时环境变量不生效。

**解决方案：** `web/Dockerfile` 中将 `NEXT_PUBLIC_API_URL` 作为 build arg 传入：

```dockerfile
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build
```

`docker-compose.yml` 中：
```yaml
web:
  build:
    context: ./web
    args:
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
```

这意味着更换服务器 IP 后需要重新 `docker compose build web`。

## Nginx 配置

```nginx
events {
    worker_connections 1024;
}

http {
    upstream web_backend {
        server web:3000;
    }

    upstream api_backend {
        server api:12321;
    }

    server {
        listen 80;
        server_name _;

        client_max_body_size 50M;

        # 前端页面
        location / {
            proxy_pass http://web_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            # Next.js HMR websocket（开发时可能用到）
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # 后端 API + SSE
        location /api/ {
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # 长连接支持（分镜生成 9 分钟 + SSE 流式）
            proxy_read_timeout 600s;
            proxy_send_timeout 600s;
            proxy_buffering off;
            proxy_cache off;

            # SSE 支持
            proxy_set_header Connection "";
        }
    }
}
```

## 一键脚本设计 (`setup-dramo.sh`)

### 执行流程

```
1. 系统检查
   ├── 检测 OS 类型和版本（Ubuntu 20/22/24, Debian 11/12, CentOS 8+）
   ├── 警告 CPU < 2 核或内存 < 4GB（不阻塞，仅提示）
   └── 检测端口 80 是否被占用

2. 安装依赖
   ├── 安装 Docker Engine（官方 apt/yum 源）
   ├── 安装 Docker Compose v2（plugin 模式）
   └── 安装 git

3. 克隆代码
   ├── 提示输入 Git 仓库地址（默认: 当前 origin remote）
   └── git clone <仓库地址> /opt/dramo

4. 交互式配置 .env
   ├── 自动生成密钥（JWT_SECRET, ENCRYPTION_KEY, NEXTAUTH_SECRET, AGENTOS_SECURITY_KEY）
   ├── 自动检测公网 IP（curl ifconfig.me）
   ├── 自动推导 NEXT_PUBLIC_API_URL, NEXTAUTH_URL, FRONTEND_URL
   ├── 提示输入必填项（DATABASE_URL, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY）
   ├── 提示输入可选项（STRIPE_* 系列，可回车跳过）
   └── 写入 /opt/dramo/.env 并设置 chmod 600

5. 构建 & 启动
   ├── docker compose build --parallel
   └── docker compose up -d

6. 健康检查（最多等 90s）
   ├── 轮询 api 健康端点: http://localhost:12321/api/health
   ├── 轮询 agentos 健康端点: http://localhost:12322/api/health
   ├── 轮询 web: http://localhost:3000
   └── 输出彩色状态表格

7. 完成提示
   ├── 前端访问地址: http://<IP>
   ├── API 健康检查: http://<IP>/api/health
   └── 更新命令: cd /opt/dramo && ./deploy/update.sh
```

### 错误处理

- 每一步失败立即退出并提示具体原因
- Docker 安装失败 → 输出手动安装文档链接
- 端口 80 被占用 → 提示 `lsof -i :80` 排查
- 健康检查未通过 → 输出 `docker compose logs` 诊断

## 环境变量策略

### 自动生成

| 变量 | 方式 |
|------|------|
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `NEXTAUTH_SECRET` | `openssl rand -hex 32` |
| `AGENTOS_SECURITY_KEY` | `openssl rand -hex 16` |

### 自动推导

| 变量 | 来源 |
|------|------|
| `SERVER_IP` | `curl -s ifconfig.me` |
| `NEXT_PUBLIC_API_URL` | `http://${SERVER_IP}/api` |
| `NEXTAUTH_URL` | `http://${SERVER_IP}` |
| `FRONTEND_URL` | `http://${SERVER_IP}` |
| `AGENTOS_BASE_URL` | `http://agentos:12322`（Docker 内网） |

### 用户手动输入

| 变量 | 必填 | 提示文案 |
|------|------|----------|
| `DATABASE_URL` | 是 | "Supabase PostgreSQL 连接串 (postgresql://...)" |
| `OPENAI_API_KEY` | 是 | "OpenAI API Key (sk-...)" |
| `SUPABASE_URL` | 是 | "Supabase 项目 URL (https://xxx.supabase.co)" |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | "Supabase Service Role Key" |
| `STRIPE_SECRET_KEY` | 否 | "Stripe Secret Key（回车跳过）" |
| `STRIPE_WEBHOOK_SECRET` | 否 | "Stripe Webhook Secret（回车跳过）" |

## 运维脚本

### `deploy/update.sh`

```bash
cd /opt/dramo
git pull origin main
docker compose build --parallel
docker compose up -d --remove-orphans
# 等待健康检查
# 输出更新完成状态
```

### `deploy/logs.sh`

```bash
# ./deploy/logs.sh          → 所有服务最近 100 行
# ./deploy/logs.sh api      → 单个服务
# ./deploy/logs.sh -f       → 实时跟踪
# ./deploy/logs.sh api -f   → 跟踪单个服务
```

## 安全加固

| 措施 | 实现方式 |
|------|----------|
| 防火墙 | 脚本配置 ufw：仅开放 22 (SSH) + 80 (HTTP) |
| .env 权限 | `chmod 600 /opt/dramo/.env`，仅 root 可读 |
| 容器非 root | 现有 server/agentos Dockerfile 已配置非 root 用户 |
| AgentOS 隔离 | 不暴露端口，不通过 Nginx 转发，仅 api 内网可达 |
| Docker socket | 不挂载到任何业务容器 |

## 后续扩展（不在本次范围）

- **HTTPS**: 绑定域名后，加 Certbot 容器自动续签 Let's Encrypt 证书
- **监控**: 加 Prometheus + Grafana 容器监控资源和响应时间
- **CI/CD**: GitHub Actions push 时自动 SSH 到服务器执行 update.sh
- **备份**: 定时备份 .env 和 Docker volumes
