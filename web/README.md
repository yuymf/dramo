This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# AI 直播台本生成助手

基于 Next.js 14 App Router 的 AI 辅助直播台本创作工具。

## 路由架构

项目采用混合路由方案（并行路由 + 深链接）：

### 路由结构
- `/projects/[id]` - 项目首页（如果有台本重定向到台本编辑器，如果没有重定向到输入生成）
- `/projects/[id]/scripts` - 台本编辑器（台本式，默认）
- `/projects/[id]/scripts/script` - 台本编辑器（台本式）
- `/projects/[id]/scripts/dialogue` - 分支式编辑器（开发中）
- `/projects/[id]/scripts/hollywood` - 分镜式编辑器（开发中）
- `/projects/[id]/input` - 输入生成（开发中）
- `/projects/[id]/characters` - 角色管理（开发中）
- `/projects/[id]/favorites` - 我的收藏（开发中）
- `/projects/[id]/storyboard` - 分镜（开发中）

### 旧路由（自动重定向）
- `/scripts/[id]` - 自动重定向到 `/projects/[id]/scripts`

### 并行路由特性
- **侧栏常驻**：`@sidebar` 槽位，显示项目导航
- **主内容区深链接**：`@content` 槽位，支持独立 URL 和浏览器前进/后退
- **状态共享**：通过 Context/SWR 缓存跨路由共享项目数据
- **预加载优化**：导航项自动 `prefetch`，切换流畅

## Getting Started

### 端口配置

项目使用以下端口：
- **Frontend**: `12323` (Next.js)
- **Backend API**: `12321` (Node.js/Fastify)
- **AgentOS**: `12322` (Python/FastAPI)

详细配置请查看 [PORT_CONFIGURATION.md](PORT_CONFIGURATION.md)

### 启动开发服务器

**选项 1: 仅启动 Frontend（使用 Mock 数据）**

```bash
npm run dev
```

打开 [http://localhost:12323](http://localhost:12323) 查看应用。

**选项 2: 启动 Frontend + Backend（完整功能）**

```bash
# 终端 1: 启动后端服务（需要先配置环境变量）
cd backend
docker compose up -d

# 终端 2: 启动前端
npm run dev
```

访问地址：
- Frontend: [http://localhost:12323](http://localhost:12323)
- Backend API Docs: [http://localhost:12321/docs](http://localhost:12321/docs)

### 环境变量配置（可选）

如果需要连接到外部后端服务，创建 `.env.local` 文件：

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:12321

# 或连接到生产环境
# NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 后端 API 文档

本项目的后端 API 规范已完整定义，包含详细的接口说明、架构方案与实施指南：

### 📚 文档清单

> 详细文档索引请查看 [docs/README.md](docs/README.md)

**核心文档**：
1. **[后端 API 接口规范](docs/BACKEND_API_SPEC.md)** (v2.0) + **[v3.0 补充](docs/BACKEND_API_SPEC_V3_ADDENDUM.md)** ⭐
2. **[API 变更总结](docs/API_CHANGES_SUMMARY.md)** ⭐
3. **[高并发架构方案](docs/BACKEND_ARCHITECTURE.md)**
4. **[后端交付清单](docs/BACKEND_DELIVERY_CHECKLIST.md)**
5. **[AgentOS 集成文档](docs/AGENTOS_MIGRATION_SUMMARY.md)** + **[集成示例](docs/AGENTOS_INTEGRATION.md)**

**功能指南**：
- [分镜 Schema 指南](docs/STORYBOARD_SCHEMA_GUIDE.md)
- [测试指南](docs/TESTING_GUIDE.md)
- [Landing Page 说明](docs/LANDING_PAGE_README.md)

**OpenAPI 规范**：
- JSON 版本: [`public/openapi.json`](public/openapi.json)
- YAML 版本: [`specs/001-ai-ai-ai/contracts/openapi.yaml`](specs/001-ai-ai-ai/contracts/openapi.yaml)
- 可导入 Swagger UI / Postman 查看交互式文档

### 🚀 快速开始

**后端开发**：
```bash
# 查看文档索引
cat docs/README.md

# 查看 v3.0 变更总结（推荐先读）
cat docs/API_CHANGES_SUMMARY.md

# 查看完整 API 规范
cat docs/BACKEND_API_SPEC.md
cat docs/BACKEND_API_SPEC_V3_ADDENDUM.md
```

### 🎯 关键特性 (v3.0)

- ✅ **单项目单台本架构**（简化资源管理）
- ✅ **三种台本形式**（linear/branching/storyboard）
- ✅ **15+ 新增接口**（AI对话、资产生成、历史版本等）
- ✅ Bearer Token 认证
- ✅ 异步任务处理（支持高并发）
- ✅ 统一错误模型与错误码
- ✅ 限流保护（全局 + 用户级）
- ✅ 幂等性保证
- ✅ 完整的监控与告警

### 📊 性能目标

- 查询接口 P95 < 200ms
- 任务队列等待 < 5s
- 完整台本生成 < 120s
- 系统可用性 > 99.5%

---

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
