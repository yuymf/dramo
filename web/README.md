# Dramo Web

Next.js 15 + React 19 前端，AI 直播台本生成助手的 UI 层。

> 架构与开发指引参见根目录 [README.md](../README.md) 与 [.claude/CLAUDE.md](../.claude/CLAUDE.md)。

## 端口

- Web: `12323`
- Server (API): `12321`
- AgentOS: `12322`

## 启动

```bash
npm install
npm run dev          # 启动 Next.js (turbopack, :12323)
```

`web` 默认通过相对路径 `/api/*` 访问后端。Next.js API Route 在服务端把请求代理到 `BACKEND_API_URL`（默认 `http://localhost:12321`）。

## 路由结构

App Router + 并行路由 (`@sidebar` + `@content`)：

- `/projects` — 项目列表
- `/projects/[id]` — 项目工作区入口（自动重定向到台本编辑器）
- `/projects/[id]/scripts` — 台本编辑器
- `/projects/[id]/characters` — 角色管理
- `/projects/[id]/storyboard` — 分镜
- 旧路由 `/scripts/[id]` 自动 308 重定向到 `/projects/[id]/scripts`

侧栏 (`@sidebar`) 常驻；主内容区 (`@content`) 支持深链接和浏览器前进/后退；通过 SWR 缓存跨路由共享项目数据。

## 环境变量

复制 `env.local.example` 到 `.env.local`：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_API_URL` | 浏览器侧 API 路径前缀（保持 `/api`）|
| `BACKEND_API_URL` | 服务端代理目标（默认 `http://localhost:12321`）|

## 设计规范

MUJI 风：奶油色/米白背景、宋体 SC / Georgia 正文、大量留白、线条图标。AI 伙伴为猫咪角色。

## 关键依赖

- TipTap — 富文本台本编辑器
- @dnd-kit — 拖拽排序
- @xyflow/react — 角色关系图
- SWR — 数据获取
- Zustand — 客户端状态
- Tailwind CSS v4 + Radix/shadcn — 样式与无障碍
