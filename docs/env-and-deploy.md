# 环境变量与部署

只列出 compose 会注入、且代码会读的变量。没有 `AI_PROVIDER`、`ARK_API_KEY`、`SESSION_SECRET`、`OS_SECURITY_KEY`。`.env` 里的 `AGENTOS_KEY` 只被 compose 映射成容器内的 `AGENTOS_SECURITY_KEY`。

---

## 根目录 `.env`（Docker Compose）

```bash
DB_PASSWORD=dramo_secret
ENCRYPTION_KEY=                    # 64 hex；生产必填
AGENTOS_KEY=default_agentos_key    # → AGENTOS_SECURITY_KEY
PUBLIC_URL=http://localhost
PORT=80

# api 容器必填才能出图。127.0.0.1 在容器内指向 api 自己。
# SD_WORKERS=[{"id":"sd-1","baseUrl":"http://<sd-host>:7860","weight":1,"capabilities":["txt2img","img2img"]},{"id":"sd-2","baseUrl":"http://<sd-host>:7861","weight":1,"capabilities":["txt2img"]}]

# AgentOS 调参（有默认值）
# LLM_TIMEOUT_SECONDS=90
# LLM_MAX_RETRIES=2
```

LLM 密钥在界面里配，进 `UserLLMConfig`。

## server 本地 (`server/.env`)

```bash
NODE_ENV=development
PORT=12321
LOG_LEVEL=info
DATABASE_URL=postgresql://dramo:dramo_secret@localhost:5432/dramo
DIRECT_URL=postgresql://dramo:dramo_secret@localhost:5432/dramo
AGENTOS_BASE_URL=http://localhost:12322
AGENTOS_SECURITY_KEY=default_agentos_key
ENCRYPTION_KEY=
STORAGE_LOCAL_DIR=./uploads
STORAGE_BASE_URL=http://localhost:12321/uploads
FRONTEND_URL=http://localhost:12323
# 本机 SD 默认 127.0.0.1:7860/7861；要覆盖就设 SD_WORKERS
```

代码读取：`server/src/config/index.ts`。AgentOS 另读 `LLM_TIMEOUT_SECONDS`、`LLM_MAX_RETRIES`（`agentos/config.py`）。

## 前端 (`web/.env.local`)

```bash
NEXT_PUBLIC_API_URL=/api
BACKEND_API_URL=http://localhost:12321
```

---

## 部署

```bash
git clone <repo-url> && cd dramo
./deploy/setup-dramo.sh
```

```
:80 → Nginx → /     → Next.js (:3000)
             /api/  → Hono (:12321) → AgentOS (:12322)
             /uploads/ → volume
```

```bash
./deploy/update.sh
./deploy/logs.sh api -f
docker compose ps
```

本地：`docker compose up -d`。API → AgentOS：`http://agentos:12322`。

## 端口

| 服务 | 端口 |
|------|------|
| Web | 12323 开发 / 容器内 3000 |
| API | 12321 |
| AgentOS | 12322 |
| Nginx | 80 |
| PostgreSQL | 5432 |
