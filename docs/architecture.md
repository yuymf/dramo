# 架构与设计模式

## 数据流

```
浏览器
  │ HTTP / 相对路径 /api/*    cookie: dramo_session
    ↓
Nginx (:80)  ──生产──→  /api/* 改写为 /api/v1/* → Hono (:12321)
  │                    /uploads/* → 共享 volume
  │                    / → Next.js (:3000)
    │
    └── 本地 `npm run dev` 无 nginx：
        Next.js catch-all (`web/app/api/[[...path]]`) → Hono /api/v1/*

Hono API
  ├── sessionMiddleware（库表 Session；公开路径仅 /auth/* /health）
  ├── Prisma → 本地 PostgreSQL
  ├── 文件存储 ./uploads
  ├── SD worker 池（SD_WORKERS，A1111 txt2img）
  └── HTTP/SSE → AgentOS (:12322, 内网)
                    ├── Agno 工作流（产品路径：ReviseWorkflow）
                    └── LLM（请求内 _llm_config，不是进程级 AI_PROVIDER）
```

## API 入口

浏览器只认 `/api/*`。Hono 只挂 `/api/v1/*`。

| 环境 | 谁改写 |
|------|--------|
| Docker / 生产 | nginx `rewrite ^/api/(?!v1/)(.*)$ /api/v1/$1` |
| `npm run dev` | Next.js `app/api/[[...path]]/route.ts` |

```
Browser → fetch('/api/projects', { credentials: 'include' })
        → nginx 或 Next.js catch-all
        → http://api:12321/api/v1/projects
        → sessionMiddleware 读 cookie dramo_session
        → routes/projects.ts
```

实现：`server/src/middleware/session.ts`。注册 / 登录写 `Session` 行并 `Set-Cookie`。没有 `default-local-user`，没有 `SESSION_SECRET`（token 存在库里，不签名）。

13 个路由模块见 `server/src/app.ts`，清单见 [api-reference.md](api-reference.md)。

## 图片生成

主路径：`POST /api/images/generations` 与 Cinema 分镜图都走 `TaskRunnerService`（`GenerationTask` + SD 池 + Asset）。

`GET /api/tasks` 列任务。旧 `/api/jobs` 路径已删除。

`SD_WORKERS` 是 A1111 兼容 JSON 数组。未设置时本地默认 `127.0.0.1:7860/7861`。Docker 里这个 loopback 指向 api 容器，必须经 compose 注入宿主机可达的 URL。

`runImageGeneration` / AgentOS `POST /api/generate-image` 不是产品路径。

## 加密

- `UserLLMConfig.apiKey`：AES-256-GCM
- 调用 AgentOS 时放进 `_llm_config` / `X-LLM-*`
- 密钥：`ENCRYPTION_KEY`（64 hex）
- 实现：`server/src/lib/crypto.ts`

## 部署

| 容器 | 镜像 | 端口 |
|------|------|------|
| `nginx` | `nginx:alpine` | `${PORT:-80}` 对外 |
| `web` | `web/Dockerfile` | 内网 3000 |
| `api` | `server/Dockerfile` | 内网 12321 |
| `agentos` | `agentos/Dockerfile` | 内网 12322 |
| `postgres` | `postgres:15-alpine` | 5432 |

Nginx：`/api/*` → api，`/uploads/*` → volume，其余 → web。

## 错误信封

```json
{
  "error": { "code": "ERROR_CODE", "message": "用户友好消息", "retryable": true },
  "requestId": "uuid"
}
```

`server/src/lib/errors.ts`、`server/src/middleware/error-handler.ts`。

## AgentOS

产品写作用 `POST /workflows/reviseworkflow/runs`（`server/src/services/screenplay.service.ts`）。只注册 ReviseWorkflow。出图不走 AgentOS。

## 前端

- 落地页 `/`：猫咪品牌（现行）。`web/DESIGN.md` 是书桌目标视觉。
- 工作区 `/projects/[id]/*`：扁平子路由（`layout` + 子 `page`）；主路径 `/screenplay`。
- 登录态走 cookie，没有「无认证默认用户」。
