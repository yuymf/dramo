# 环境变量与部署

> 环境配置、部署选项与运维指南。

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
DATABASE_URL=postgresql://dramo:dramo_secret@localhost:5432/dramo
DIRECT_URL=postgresql://dramo:dramo_secret@localhost:5432/dramo  # 迁移专用直连
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
STORAGE_LOCAL_DIR=./uploads
STORAGE_BASE_URL=http://localhost:12321/uploads
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
SSE_TIMEOUT_MS=55000                               # SSE 55s
SSE_HEARTBEAT_MS=15000                             # 心跳 15s
LLM_TIMEOUT_LONG_SECONDS=180                       # 工作流超时
DETAIL_REFINER_TIMEOUT_SECONDS=200                 # 分镜细化超时
LLM_CONCURRENCY=3                                  # 并行 LLM 调用 (最大 10)
```

---

## 前端环境变量 (web/.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:12321
BACKEND_API_URL=<可选服务端覆盖, 优先于 NEXT_PUBLIC_API_URL>
NEXT_PUBLIC_APP_MODE=development|production
```

---

## 部署方案

### 方案 1: 一键部署（推荐）

```bash
# SSH 到服务器后执行
git clone <repo-url> && cd dramo
./deploy/setup-dramo.sh
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

### 方案 2: 本地 Docker 开发

```bash
docker compose up -d                        # 启动 nginx + web + api + agentos + postgres
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
| PostgreSQL | 5432 | 数据库 |
