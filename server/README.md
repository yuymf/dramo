# Dramo API

Hono + Prisma + 本地 PostgreSQL。无登录、无队列服务，AI 工作流全部交给 AgentOS。

## 启动

```bash
# 在仓库根目录
cp .env.example server/.env   # 填 DATABASE_URL、ENCRYPTION_KEY、AGENTOS_BASE_URL
npm run prisma:generate
npm run prisma:migrate
npm run dev:server            # :12321
```

Docker 下一并启动：根目录 `docker compose up -d`。入口脚本会先跑 `prisma migrate deploy`。

## 结构

```
src/
  app.ts              # Hono 应用，路由挂在 /api/v1
  server.ts           # Node HTTP 入口
  routes/             # HTTP 层
  services/           # 业务
  lib/agentos-client.ts
  middleware/         # 默认用户 + 统一错误
  db/schema.prisma
```

对外路径：`/api/v1/*`。生产由 nginx 把浏览器的 `/api/*` 改写过来；本地开发由 Next.js catch-all 做同样的事。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 热重载 |
| `npm run build` | tsc + ESM import 修补 |
| `npm test` | Jest |
| `npm run prisma:studio` | 看库 |
