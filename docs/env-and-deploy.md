# 环境变量与部署

> 环境配置、部署选项与运维指南。

## 环境切换

```bash
./switch-env.sh debug   # 切换到本地开发环境
./switch-env.sh prod    # 切换到生产环境
./switch-env.sh status  # 查看当前环境状态
```

脚本将 `.env.debug` / `.env.production` 分发到:
- `server/.env` — 后端 + AgentOS (AgentOS 通过 `env_loader.py` 从此文件读取)
- `web/.env.local` — 前端

---

## 后端环境变量 (server/.env)

### 服务器

```bash
NODE_ENV=development|production
PORT=12321
LOG_LEVEL=debug|info|warn|error
```

### 数据库

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
DIRECT_URL=postgresql://user:pass@host:5432/db    # 迁移专用直连
```

### 认证

```bash
JWT_SECRET=<32+ 字符随机字符串>
JWT_EXPIRES_IN=30d
```

### AgentOS 连接

```bash
AGENTOS_BASE_URL=http://localhost:12322            # 开发环境
AGENTOS_SECURITY_KEY=<可选安全密钥>
```

### 加密

```bash
ENCRYPTION_KEY=<32 字节 hex (AES-256-GCM)>        # LLM API Key 加密
```

### 文件存储

```bash
STORAGE_DRIVER=local|supabase
STORAGE_LOCAL_DIR=./uploads                        # local 模式
STORAGE_BASE_URL=http://localhost:12321/uploads     # local 模式
SUPABASE_URL=https://<project>.supabase.co         # supabase 模式
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SUPABASE_BUCKET=images
SUPABASE_SIGNED_URL_TTL=3600
```

### Stripe 计费

```bash
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
FRONTEND_URL=http://localhost:12323
```

### AI 供应商

```bash
AI_PROVIDER=openai|hunyuan|ark
OPENAI_API_KEY=sk-...
OPENAI_API_BASE=<可选自定义 base URL>
OPENAI_MODEL_ID=gpt-4-turbo-preview
HUNYUAN_OPENAPI_KEY=...
HUNYUAN_OPENAPI_URL=...
HUNYUAN_MODEL_ID=hunyuan-turbos-latest
ARK_API_KEY=...
ARK_API_BASE=https://ark.cn-beijing.volces.com/api/v3
```

### 超时配置

```bash
SSE_TIMEOUT_MS=55000                               # SSE 55s (Vercel 60s - 5s buffer)
SSE_HEARTBEAT_MS=15000                             # 心跳 15s
LLM_TIMEOUT_LONG_SECONDS=180                       # 工作流超时
DETAIL_REFINER_TIMEOUT_SECONDS=200                 # 分镜细化超时
LLM_CONCURRENCY=3                                  # 并行 LLM 调用 (最大 10)
```

---

## 前端环境变量 (web/.env.local)

```bash
NEXTAUTH_SECRET=<32+ 字符>
NEXTAUTH_URL=http://localhost:12323
NEXT_PUBLIC_API_URL=http://localhost:12321
BACKEND_API_URL=<可选服务端覆盖, 优先于 NEXT_PUBLIC_API_URL>
NEXT_PUBLIC_APP_MODE=development|production
DEV_USER_EMAIL=demo@example.com                    # 开发测试账号
DEV_USER_PASSWORD=demo123456
```

---

## 部署方案

### 方案 1: 腾讯云 VPS 一键部署（推荐）

推荐配置：轻量应用服务器 2C4G Ubuntu 22.04（~60-80 元/月）

```bash
# SSH 到服务器后执行
bash <(curl -fsSL https://raw.githubusercontent.com/你的仓库/main/deploy/setup-dramo.sh)
```

脚本自动完成：系统检测 → Docker 安装 → 代码克隆 → 环境变量配置 → 构建启动 → 健康检查

**架构:**

```
用户 :80 → Nginx → ├── /     → Next.js (:3000)
                    └── /api/ → Hono API (:12321) → AgentOS (:12322, 仅内网)
```

**日常运维:**

```bash
cd /opt/dramo
./deploy/update.sh       # 拉取最新代码并重启
./deploy/logs.sh         # 查看所有服务日志
./deploy/logs.sh api -f  # 实时跟踪某个服务
docker compose ps        # 查看服务状态
docker compose down      # 停止所有服务
```

### 方案 2: Vercel 部署

- 后端: Root Directory 指向 `server/`
- 入口: `server/src/api/[[...route]].ts` (Serverless catch-all)
- **注意**: Hobby 计划 60s 超时限制，分镜生成等长任务不可用
- AgentOS 需独立部署到 VPS

### 方案 3: 本地 Docker 开发

```bash
docker compose up -d                        # 启动 nginx + web + api + agentos
docker compose --profile localpg up -d      # 同上 + 本地 PostgreSQL
docker compose logs -f                      # 查看日志
docker compose ps                           # 服务状态
```

**Docker 网络:**
- API → AgentOS: `http://agentos:12322` (Docker 内部)
- 本地开发: `http://localhost:12322`

---

## 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| Web (Next.js) | 12323 | 前端开发服务器 |
| API (Hono) | 12321 | 后端 API |
| AgentOS (FastAPI) | 12322 | AI 服务 (仅内网) |
| Nginx | 80 | 反向代理 (Docker/生产) |
| PostgreSQL | 5432 | 数据库 (localpg profile) |
