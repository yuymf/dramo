# Dramo Web

Next.js 15 + React 19。落地页与 e2e 的现行品牌是猫咪角色（`/`、`CatLogo`、`web/app/layout.tsx`）。`DESIGN.md` 是书桌 / 无猫耳的目标视觉，尚未覆盖落地页。

## 端口

- Web: `12323`
- Server (API): `12321`
- AgentOS: `12322`

## 启动

```bash
# 仓库根目录
npm install
npm run dev:web
```

浏览器走相对路径 `/api/*`。Next.js catch-all 代理到 `BACKEND_API_URL`（默认 `http://localhost:12321`）。

## 路由

- `/` — 落地页（猫）
- `/login` `/register` — 账号
- `/home` — 主页
- `/projects` — 项目列表
- `/projects/[id]` — 按类型跳到 `/screenplay` 或 `/reels`
- `/projects/[id]/screenplay` — 剧本正文（工作区主路径）
- `/projects/[id]/{outline,beats,characters,locations,props,storyboard,assets}` — 规划 / 前期
- `/projects/[id]/{worldview,knowledge,advisors,cold-start,spoken}` — 更多
- `/projects/[id]/reels` `/projects/[id]/tasks` — Cinema
- `/library` `/settings` `/profile` `/s/[token]`
- `/projects/[id]/scripts` 与旧 `/scripts/:id` 重定向到 `/screenplay`（见 `next.config.ts`）

工作区：`@sidebar` + `@content` 并行路由。侧栏见 `WorkspaceRail`。

## 环境变量

复制 `env.local.example` 到 `.env.local`：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_API_URL` | 浏览器侧 API 前缀（保持 `/api`）|
| `BACKEND_API_URL` | 服务端代理目标（默认 `http://localhost:12321`）|

## 关键依赖

- TipTap — 剧本编辑
- @dnd-kit — 拖拽
- @xyflow/react — 关系图
- SWR — 数据获取
- Zustand — 客户端状态
- Tailwind CSS v4 + Radix/shadcn
