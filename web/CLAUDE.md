# Dramo Web — Next.js 15 前端

> Monorepo 子项目。全局文档见 [根目录 CLAUDE.md](../CLAUDE.md)，详细参考见 [docs/](../docs/)。

## 概览

Next.js 15 App Router 应用 (React 19, TypeScript strict, Tailwind CSS v4)，端口 12323。
所有 API 调用通过 Next.js API Routes 代理到后端 Hono API (:12321)。

## 命令

```bash
npm run dev            # Turbopack 开发服务器 (:12323)
npm run build          # 生产构建
npm start              # 生产服务器 (:12323)
npm run lint           # ESLint v9 (Flat Config)
```

MSW (`msw` + `@faker-js/faker`) 用于 mock 数据 (`mock/`)，无独立测试运行器。

## 环境变量 (.env.local)

| 变量 | 用途 |
|------|------|
| `NEXTAUTH_SECRET` | NextAuth JWT 签名密钥 |
| `NEXTAUTH_URL` | NextAuth 回调 URL (`http://localhost:12323`) |
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 (`http://localhost:12321`) |
| `BACKEND_API_URL` | 服务端覆盖后端地址 (优先于 `NEXT_PUBLIC_API_URL`) |
| `NEXT_PUBLIC_APP_MODE` | `development` / `production` |
| `DEV_USER_EMAIL` | 开发测试账号 (`demo@example.com`) |
| `DEV_USER_PASSWORD` | 开发测试密码 (`demo123456`) |

> 完整环境变量说明见 [docs/env-and-deploy.md](../docs/env-and-deploy.md)

## 目录结构

```
web/
├── app/
│   ├── api/                    # Next.js API Routes (代理到后端)
│   │   └── _utils/             #   proxyRequest(), auth guard
│   ├── projects/[id]/          # 项目工作区 (并行路由)
│   │   ├── @sidebar/           #   持久侧边栏 (场景列表、导航)
│   │   └── @content/           #   深链接内容区
│   │       ├── scripts/        #     台本编辑 (linear, dialogue, hollywood)
│   │       ├── characters/     #     角色管理 + relations/ 关系图谱
│   │       ├── locations/      #     场景管理
│   │       └── storyboard/     #     分镜面板
│   ├── home/                   # 仪表盘
│   ├── settings/               # LLM 配置管理
│   ├── pricing/                # 定价页
│   ├── billing/                # 支付结果 (success/cancel)
│   ├── login/ register/        # 认证页
│   ├── profile/ cases/ blog/   # 其他页
│   ├── providers.tsx           # AppProviders (SessionProvider, ThemeProvider)
│   ├── ai-chat-provider.tsx    # AI 对话状态 Context
│   └── generation-jobs-provider.tsx  # 任务轮询 Context
│
├── components/                 # 按功能分组
│   ├── ui/                     # Radix + shadcn 基础组件
│   ├── editor/                 # TipTap + @dnd-kit 台本编辑器
│   ├── characters/             # 角色卡片、表单、@xyflow 关系图
│   ├── locations/              # 场景卡片、表单
│   ├── storyboard/             # FrameCard, GeneratorModal, SavedAssetsPanel
│   ├── chat/                   # AI 对话面板、消息展示
│   ├── billing/                # 订阅、SubscriptionProvider
│   ├── sidebar/                # ProjectSidebar, SceneList
│   ├── settings/               # LLMConfigManager, AIProviderSettings
│   ├── home/                   # 仪表盘组件
│   └── landing/                # CatLogo, SiteHeader, FeatureCard
│
├── lib/
│   ├── api/                    # 类型化 API 客户端
│   │   ├── client.ts           #   api<T>() — 统一 fetch 封装 (缓存, 超时, 错误)
│   │   ├── projects.ts         #   项目 CRUD
│   │   ├── scripts.ts          #   台本操作
│   │   ├── characters.ts       #   角色操作
│   │   ├── storyboard.ts       #   分镜操作
│   │   ├── llm-configs.ts      #   LLM 配置
│   │   ├── relations.ts        #   角色关系
│   │   ├── jobs.ts             #   图片生成任务
│   │   ├── billing.ts          #   Stripe 订阅
│   │   └── ai-providers.ts     #   AI 供应商切换
│   ├── hooks/
│   │   ├── useTaskPolling.ts   #   通用任务轮询
│   │   ├── useGenerationJobs.ts#   生成任务 Context hook
│   │   ├── useAutosave.ts      #   自动保存台本
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── use-subscription.ts #   订阅状态
│   │   └── useIsLargeScreen.ts #   响应式断点
│   ├── types/                  # TypeScript 类型
│   │   ├── storyboard.ts       #   Frame, Scene, Shot
│   │   ├── chat.ts             #   Message 类型
│   │   └── generation-job.ts   #   Job 状态类型
│   ├── utils/
│   │   ├── exporter.ts         #   导出 DOCX/PDF
│   │   ├── json-applier.ts     #   应用 AI 建议
│   │   ├── json-context-extractor.ts  # 提取 AI 上下文
│   │   └── format-check.ts     #   JSON 格式校验
│   └── models.ts               # 核心领域模型 (Script, Character, Storyboard, ...)
│
└── mock/                       # MSW mock service worker
```

## 架构

### API 代理模式

```
Browser → fetch('/api/projects') → Next.js API Route → proxyRequest() → Hono :12321
```

- `app/api/_utils/proxy.ts` (`proxyRequest`) — 从 NextAuth session 提取 `backendToken`，注入 Bearer header
- 支持 JSON / FormData / URL-encoded body
- 统一错误信封: `{ error: { code, message, retryable } }`
- `lib/api/client.ts` (`api<T>()`) — 客户端 fetch 封装:
  - Cookie-based auth (`credentials: 'include'`)
  - 可选 GET 缓存 (TTL-based LRU, 最多 100 条)
  - AbortController 超时控制
  - `PLAN_LIMIT_EXCEEDED` 错误自动触发升级弹窗

### 认证

NextAuth v4 + Credentials provider:
- 登录调用后端 `POST /api/auth/login`，返回 token 存入 JWT
- `backendToken` 扩展到 Session 类型 (见 `next-auth.d.ts`)
- 自定义登录页 `/login`

### 路由 (并行路由)

项目工作区 `app/projects/[id]/` 使用 Next.js parallel routes:

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | Landing | 落地页 |
| `/login` `/register` | Auth | 认证 |
| `/home` | Dashboard | 仪表盘 |
| `/projects` | ProjectsList | 项目列表 |
| `/projects/[id]/scripts` | ScriptEditor | 线性台本编辑器 (默认) |
| `/projects/[id]/scripts/dialogue` | DialogueEditor | 分支编辑器 (WIP) |
| `/projects/[id]/scripts/hollywood` | HollywoodEditor | 分镜编辑器 (WIP) |
| `/projects/[id]/characters` | CharacterManager | 角色管理 |
| `/projects/[id]/characters/relations` | RelationGraph | @xyflow 关系图谱 |
| `/projects/[id]/locations` | LocationManager | 场景管理 |
| `/projects/[id]/storyboard` | StoryboardPanel | 分镜面板 |
| `/settings` | Settings | LLM 配置 |
| `/pricing` | Pricing | 定价 |
| `/profile` `/cases` `/blog` | Other | 其他页面 |

Legacy 路由 `/scripts/:id` 通过 `next.config.ts` 重定向到 `/projects/:id/scripts`。

### 领域模型

核心类型定义在 `lib/models.ts`:

- **Script** — Acts → Scenes → Blocks (HTML)。三种形态: `linear`, `branching`, `storyboard`
- **Character** — 语言特征、风格标签、图片资产、关系图
- **Storyboard** — Scenes → Shots (镜头、对话、生成提示词)
- **GenerationJob** — 异步任务追踪 (`lib/types/generation-job.ts`)

### 状态管理

- `SessionProvider` (NextAuth) — 认证状态
- `AIChatProvider` — AI 对话抽屉、当前页面类型、JSON 上下文、待应用的 AI 建议
- `GenerationJobsProvider` — 异步任务轮询 (图片/台本生成)
- 无全局状态库 (Zustand 按需引入但未安装)

### UI 技术栈

| 技术 | 用途 |
|------|------|
| Tailwind CSS v4 + @tailwindcss/postcss | 样式 |
| Radix UI + shadcn/ui | 基础组件 |
| TipTap | 富文本编辑 |
| @dnd-kit | 拖拽排序 (场景/区块) |
| @xyflow/react | 角色关系图谱 |
| Lucide React + React Icons | 图标 |
| docx + jspdf | 台本导出 |

### 设计风格

产品名: DRAMO。MUJI 风格:
- 背景: 奶油色/米白/燕麦色 (非纯黑白)
- 正文: Songti SC / Georgia; UI: 系统无衬线
- 大量留白、线条图标、淡纸纹理
- AI 伙伴: 专注可爱的猫咪角色
