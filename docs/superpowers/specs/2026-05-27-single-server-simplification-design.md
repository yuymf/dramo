# Dramo 单服务器简化部署重构设计

## 概述

将 Dramo 从依赖外部 SaaS（Supabase、Stripe、NextAuth）的多服务架构，简化为单台服务器一键 Docker Compose 部署的纯工具型应用。

## 目标

- **一键部署**：`docker compose up -d` 启动完整应用
- **零外部依赖**：除 LLM API（OpenAI/Hunyuan/ARK）外，不依赖任何外部服务
- **纯工具模式**：无登录、无计费、默认用户自动使用
- **最小改动**：保持三层架构（Next.js + Hono + AgentOS），只做减法

## 最终架构

```
┌────────────────────────────────────────────────────────┐
│                   单台服务器                             │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │  Nginx   │───▶│ Next.js  │    │   Hono   │──┐      │
│  │   :80    │───▶│  :12323  │    │  :12321  │  │      │
│  └──────────┘    └──────────┘    └──────────┘  │      │
│                                       │         │      │
│                                       ▼         ▼      │
│                                 ┌──────────┐ ┌──────┐  │
│                                 │PostgreSQL│ │Agent │  │
│                                 │  :5432   │ │ OS   │  │
│                                 └──────────┘ │:12322│  │
│                                              └──────┘  │
│                                                        │
│  Volumes: postgres_data, uploads                       │
└────────────────────────────────────────────────────────┘
         │
         ▼ (出站 HTTPS)
   ┌─────────────┐
   │ LLM APIs    │
   │ OpenAI/ARK/ │
   │ Hunyuan     │
   └─────────────┘
```

## 移除清单

### 1. Stripe 计费模块

**移除文件：**
- `server/src/routes/billing.ts`
- `server/src/services/billing.service.ts`
- `server/src/lib/stripe.ts`

**移除依赖：**
- `stripe` (package.json)

**数据库：**
- 删除 `Subscription` 模型
- 删除 `UsageRecord` 模型

**前端：**
- 移除所有计费/订阅相关页面和组件
- 移除 pricing/plan 选择器

### 2. NextAuth 认证

**移除文件：**
- `web/app/api/auth/[...nextauth]/route.ts`
- `web/lib/auth/options.ts`
- `web/lib/auth/` 整个目录

**移除依赖：**
- `next-auth` (package.json)

**前端改动：**
- 移除登录/注册页面
- 移除 `middleware.ts` 中的 session 检查
- API 代理不再注入 Bearer Token

### 3. 后端认证中间件

**移除文件：**
- `server/src/middleware/auth.ts`（JWT 校验逻辑）
- `server/src/routes/auth.ts`（login/register 接口）

**移除依赖：**
- `jsonwebtoken`
- `bcrypt`

**替代方案：**
- 所有需要 `userId` 的地方注入默认用户 ID（常量）
- 后端启动时 seed 默认用户记录

### 4. Supabase 存储

**移除文件：**
- `storage.service.ts` 中的 `supabase` 分支代码

**移除依赖：**
- `@supabase/supabase-js`

**替代方案：**
- `STORAGE_DRIVER` 固定为 `local`
- 本地文件存储在 `/app/uploads`（Docker volume 持久化）
- Hono 静态文件路由 `/uploads/*` 提供访问

### 5. 环境变量清理

**移除：**
```env
# Supabase
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_BUCKET
SUPABASE_SIGNED_URL_TTL
DIRECT_URL

# Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY
STRIPE_PRICE_PRO_YEARLY

# NextAuth
NEXTAUTH_SECRET
NEXTAUTH_URL

# Auth
JWT_SECRET
JWT_EXPIRES_IN
```

**保留：**
```env
# 数据库（改为本地 PostgreSQL）
DATABASE_URL=postgresql://dramo:${DB_PASSWORD}@postgres:5432/dramo

# 存储
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=/app/uploads
STORAGE_BASE_URL=http://localhost/uploads

# AgentOS
AGENTOS_BASE_URL=http://agentos:12322
AGENTOS_SECURITY_KEY=${AGENTOS_KEY}

# 加密（LLM 配置加密存储仍需要）
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# LLM（用户可在界面配置，或通过环境变量预设）
AI_PROVIDER=openai
OPENAI_API_KEY=（可选，也可在界面配置）
```

## 保留清单

### 数据库表

| 表 | 保留原因 |
|----|----------|
| `User` | 默认用户 + 未来恢复多用户的可能性 |
| `UserLLMConfig` | 用户在界面配置 LLM API key |
| `Project` | 核心业务 |
| `Script` / `ScriptVersion` / `ScriptScene` | 核心业务 |
| `CharacterAsset` / `CharacterRelation` | 核心业务 |
| `LocationAsset` | 核心业务 |
| `Storyboard` / `StoryboardShot` / `StoryboardFrameImage` | 核心业务 |
| `GenerationJob` | 图片生成队列 |
| `ChatSession` / `ChatMessage` | AI 对话 |
| `Task` / `PipelineRun` | 异步任务追踪 |
| `Inspiration` | 灵感库 |

### 功能模块

- 所有台本生成/编辑功能
- 角色/场景提取（SSE 流式）
- 分镜导入（异步任务）
- 图片生成
- AI 对话
- LLM 配置界面
- 项目 CRUD

## 实现细节

### 默认用户方案

```typescript
// server/src/lib/default-user.ts
export const DEFAULT_USER_ID = 'default-local-user';
export const DEFAULT_USER_EMAIL = 'local@dramo.tool';

// 启动时 seed
export async function ensureDefaultUser(prisma: PrismaClient) {
  await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    create: {
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
      name: 'Local User',
      password: '', // 不需要密码
    },
    update: {},
  });
}
```

```typescript
// server/src/middleware/inject-user.ts（替代 auth middleware）
export function injectDefaultUser(): MiddlewareHandler {
  return async (c, next) => {
    c.set('user', { userId: DEFAULT_USER_ID });
    await next();
  };
}
```

### 前端 API 代理简化

改动范围：仅移除 Bearer Token 注入逻辑。保留以下现有功能不变：
- SSE passthrough（`text/event-stream` 检测 + 直通管道）
- 文件上传 multipart 透传
- 错误处理和超时逻辑

```typescript
// web/app/api/_utils/proxy.ts — 关键改动
// BEFORE: const token = await getToken({ req }); headers['Authorization'] = `Bearer ${token}`;
// AFTER: 直接透传，不注入任何认证 header
// 其余 SSE passthrough、multipart 转发逻辑保持不变
```

### Docker Compose 最终版

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: dramo
      POSTGRES_USER: dramo
      POSTGRES_PASSWORD: ${DB_PASSWORD:-dramo_secret}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dramo"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 12321
      DATABASE_URL: postgresql://dramo:${DB_PASSWORD:-dramo_secret}@postgres:5432/dramo
      STORAGE_DRIVER: local
      STORAGE_LOCAL_DIR: /app/uploads
      STORAGE_BASE_URL: ${PUBLIC_URL:-http://localhost}/uploads
      AGENTOS_BASE_URL: http://agentos:12322
      AGENTOS_SECURITY_KEY: ${AGENTOS_KEY:-default_key}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    volumes:
      - uploads:/app/uploads
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:12321/health"]
      interval: 10s
      timeout: 3s
      retries: 3

  agentos:
    build:
      context: ./agentos
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    environment:
      PORT: 12322
      AGENTOS_SECURITY_KEY: ${AGENTOS_KEY:-default_key}
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:12322/health')"]
      interval: 10s
      timeout: 5s
      retries: 3

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: http://api:12321
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    environment:
      NEXT_PUBLIC_API_URL: /api
      NEXT_PUBLIC_APP_MODE: production

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "${PORT:-80}:80"
    depends_on:
      - web
      - api
    volumes:
      - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - uploads:/var/www/uploads:ro

volumes:
  postgres_data:
  uploads:
```

### 一键启动脚本

```bash
#!/bin/bash
# deploy/setup.sh — 一键部署

set -e

echo "=== Dramo 一键部署 ==="

# 检查 Docker
if ! command -v docker &> /dev/null; then
  echo "正在安装 Docker..."
  curl -fsSL https://get.docker.com | sh
fi

# 生成 .env（如不存在）
if [ ! -f .env ]; then
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  DB_PASSWORD=$(openssl rand -base64 16 | tr -d '=/+')
  AGENTOS_KEY=$(openssl rand -base64 24 | tr -d '=/+')

  cat > .env << EOF
# Dramo 配置
DB_PASSWORD=${DB_PASSWORD}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
AGENTOS_KEY=${AGENTOS_KEY}
PORT=80
PUBLIC_URL=http://localhost

# LLM API（二选一：在此填写，或启动后在界面中配置）
# OPENAI_API_KEY=sk-xxx
EOF

  echo "已生成 .env，请编辑填入 LLM API key（或启动后在界面配置）"
  echo "文件位置: $(pwd)/.env"
fi

# 启动
docker compose up -d --build

echo ""
echo "=== 部署完成 ==="
echo "访问: http://localhost"
echo ""
echo "如需配置 LLM API key，请在界面中 设置 → LLM 配置 中添加"
```

## 数据库迁移策略

由于移除了 `Subscription` 和 `UsageRecord` 表，需要一个新的 Prisma migration：

1. 从 `schema.prisma` 中删除 `Subscription`、`UsageRecord` 模型
2. 从 `User` 模型中移除 `subscription` 关系字段
3. 运行 `npx prisma migrate dev --name remove-billing-tables`
4. Docker 启动时自动执行 `npx prisma migrate deploy`

## 前端路由调整

| 当前路由 | 操作 |
|----------|------|
| `/login` | 删除 |
| `/register` | 删除 |
| `/pricing` | 删除 |
| `/settings/billing` | 删除 |
| `/settings/llm` | 保留 |
| `/projects` | 改为首页（`/`） |
| `/projects/[id]` | 保留 |

应用入口直接进入项目列表，无需任何登录流程。

## 测试策略

1. **移除后冒烟测试**：确保不引用已删除模块
2. **核心流程验证**：
   - 创建项目
   - 生成台本（SSE 流）
   - 提取角色/场景
   - 导入分镜（异步任务）
   - 图片生成
   - AI 对话
   - LLM 配置
3. **Docker Compose 端到端**：从 `docker compose up` 到完整使用流程

## 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| 移除认证后遗留 userId 引用导致 crash | 高 | grep 全局搜索所有 `userId`、`c.get('user')` 引用 |
| 本地 PostgreSQL 性能不如 Supabase pooler | 低 | 单用户场景无性能压力 |
| 移除 Supabase 后图片 URL 失效 | 中 | 新部署无历史数据，不影响；如需迁移旧数据另写脚本 |
| Docker 构建时间过长 | 低 | 多阶段构建已存在 |

## 工作量估计

| 阶段 | 预计耗时 |
|------|----------|
| 后端移除认证/计费 + 注入默认用户 | 4-6 小时 |
| 后端移除 Supabase 存储分支 | 1-2 小时 |
| 前端移除 NextAuth + 登录页 + 计费页 | 3-4 小时 |
| 数据库 migration（删表 + seed） | 1 小时 |
| Docker Compose 调整 + 一键脚本 | 2-3 小时 |
| 集成测试 + 修复遗留引用 | 3-4 小时 |
| **总计** | **~2-3 天** |
