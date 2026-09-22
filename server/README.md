# Dramo API

Hono + Prisma + 本地 PostgreSQL。Cookie session 鉴权；静帧出图走 SD worker 池。

## 启动

```bash
# 在仓库根目录
cp server/env.example server/.env   # DATABASE_URL、ENCRYPTION_KEY、AGENTOS_BASE_URL、SD_WORKERS
npm run prisma:generate
npm run prisma:migrate
npm run dev:server            # :12321
```

Docker：根目录 `docker compose up -d`。入口脚本先跑 `prisma migrate deploy`。

## 结构

```
src/
  app.ts                 # 路由模块，挂在 /api/v1
  server.ts
  routes/                # auth, projects, screenplay, entities, planning,
                         # assist, preproduction, cinema, files, collab,
                         # uploads, generation-tasks, llm-config, health
  services/
  lib/agentos-client.ts  # 工作流 POST /workflows/{id}/runs
  middleware/session.ts  # dramo_session cookie；公开路径仅 /auth/* /health
  db/schema.prisma
```

浏览器认 `/api/*`。生产 nginx 改写到 `/api/v1/*`；本地由 Next.js catch-all 转发。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 热重载 |
| `npm run build` | tsc（源码带 `.js` 扩展名） |
| `npm test` | Jest |
| `npm run prisma:studio` | 看库 |
