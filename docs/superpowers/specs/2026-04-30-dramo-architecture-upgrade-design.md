# Dramo 全面架构升级设计文档

**日期**: 2026-04-30  
**版本**: 1.0  
**范围**: 全栈 Monorepo（web + server + agentos）  
**节奏**: 渐进式重构，4 阶段，每阶段独立上线  

---

## 背景与目标

Dramo 当前代码库经过快速迭代后积累了以下系统性问题：

1. **Schema 技术债**：V1/V2 资产模型共存、JSON Blob 替代关联表、AI 用量计量未实现
2. **服务层上帝类**：`asset.service.ts`（696 行）、`chat.ts` 路由（398 行）混合多重职责
3. **重复代码**：`characters.ts` 与 `locations.ts` 结构完全相同；SSE 封装分散在 6+ 端点；`StorageService` 4 个方法实为 2 个
4. **前端上帝组件**：`scripts/page.tsx`（1511 行）包含 10+ 独立关注点
5. **双写状态**：版本历史、收藏、角色资产同时写 localStorage 和 DB，数据一致性脆弱
6. **安全隐患**：CORS `origin: '*'`，无 API 版本化
7. **代码质量**：Python `_merge_images` 遗留大量调试日志；全局单例非线程安全

**升级目标**：在不中断线上服务的前提下，通过渐进式重构消灭上述问题，同时为新功能（AI 负责人、树形剧本、新导出格式）创造干净的接入点。

---

## 架构目标（重构完成态）

```
Browser
  │
  ↓  fetch('/api/*')  — 仅 Auth Guard，无业务逻辑
Next.js Route Handlers
  │  < 20 个有效 Handler（工厂生成透传，有逻辑的保留完整实现）
  ↓  Bearer Token 注入
Hono /api/v1/*
  │  按域划分路由，CORS 白名单
  ↓  Internal HTTP
AgentOS FastAPI
  │  工作流不变，LLM 配置通过 Header 注入（LLMContextMiddleware 已有）
  ↓
PostgreSQL (Supabase)
  单一真相：LocalStorage 仅保存 UI 偏好（侧边栏状态、主题）
```

---

## P0：技术债清零（Week 1-2）

### P0.1 Schema 迁移（最高优先级）

**目标**：消灭 V1/V2 模型共存、JSON Blob、AI 用量缺失、计划限额硬编码。

#### V1 → V2 资产迁移

| 删除（V1） | 保留（V2） | 迁移内容 |
|-----------|-----------|---------|
| `Character3ViewAsset` | `CharacterAsset` | `imageUrl`, `viewType`, `prompt`, `projectId` |
| `LocationImageAsset` | `LocationAsset` | `imageUrl`, `prompt`, `projectId` |

迁移步骤：
1. 编写 Prisma migration 脚本，将 V1 表数据 INSERT 到 V2 表
2. 更新所有引用 V1 模型的服务代码（`asset.service.ts` 中的 V1 分支）
3. 删除 V1 模型定义
4. 删除 `asset.service.ts` 中的内联 base64→URL 迁移逻辑（一次性完成后无需保留）

#### JSON Blob → 关联表

**`Storyboard.frames`（JSON）→ `StoryboardShot` 表**

```prisma
model StoryboardShot {
  id           String     @id @default(cuid())
  storyboardId String
  storyboard   Storyboard @relation(fields: [storyboardId], references: [id], onDelete: Cascade)
  order        Int
  imageUrl     String?
  dialogue     String?
  action       String?
  cameraAngle  String?
  generatedAt  DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([storyboardId, order])
}
```

**`Script.scenes`（JSON）→ `ScriptScene` 表**

```prisma
model ScriptScene {
  id           String   @id @default(cuid())
  scriptId     String
  script       Script   @relation(fields: [scriptId], references: [id], onDelete: Cascade)
  actIndex     Int
  order        Int
  title        String?
  content      String   @db.Text  // TipTap HTML
  parentSceneId String?           // P3 树形剧本用
  branchLabel  String?            // P3 树形剧本用
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([scriptId, actIndex, order])
}
```

#### 新增 UsageRecord 表

```prisma
model UsageRecord {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  month     String   // "2026-04" 格式
  type      String   // "ai_generation" | "export" 等
  count     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, month, type])
  @@index([userId, month])
}
```

解除 `billing.service.ts` 中 `aiUsed = 0` 硬编码，改为查询 `UsageRecord`。

#### PLAN_LIMITS 外化

新建 `server/src/config/plan-limits.ts`（或 DB 配置表），从 `billing.service.ts` 内联常量中提取：

```typescript
// server/src/config/plan-limits.ts
export const PLAN_LIMITS: Record<string, PlanLimit> = {
  free:    { projects: 3,  aiGenerations: 10,  exports: 5  },
  starter: { projects: 10, aiGenerations: 100, exports: 50 },
  pro:     { projects: -1, aiGenerations: -1,  exports: -1 }, // -1 = unlimited
};
```

后续可迁移到 DB 表实现动态配置。

### P0.2 StorageService 去重

当前 4 个方法合并为 2 个：

```typescript
// 合并前（重复）
uploadImageFromUrl(projectId, url): Promise<string>
uploadImageFromUrlDetailed(projectId, url): Promise<{ url: string; path: string }>
uploadImageFromBase64(projectId, base64): Promise<string>
uploadImageFromBase64Detailed(projectId, base64): Promise<{ url: string; path: string }>

// 合并后
uploadImageFromUrl(projectId, url, opts?: { detailed?: boolean }):
  Promise<string | { url: string; path: string }>

uploadImageFromBase64(projectId, base64, opts?: { detailed?: boolean }):
  Promise<string | { url: string; path: string }>
```

配套单元测试覆盖：URL/Base64 × Supabase/Local × detailed/simple 共 8 条路径。

### P0.3 image_service.py 清理

1. 删除 `_merge_images` 中所有 `logger.info(f"[DEBUG]...")` / `logger.error(f"[ERROR]...")` 调试输出（共 15+ 行）
2. 用 `threading.Lock` 保护全局单例初始化：

```python
_image_service: Optional[ImageService] = None
_image_service_lock = threading.Lock()

def get_image_service() -> ImageService:
    global _image_service
    if _image_service is None:
        with _image_service_lock:
            if _image_service is None:  # double-checked locking
                _image_service = ImageService()
    return _image_service
```

3. 添加 pytest 测试覆盖并发初始化场景（使用 `ThreadPoolExecutor` 模拟并发调用）

### P0.4 API 版本化 & CORS 收紧

**Hono 路由前缀**：所有 21 个路由模块挂载路径从 `'/'` 改为 `'/api/v1'`：

```typescript
// app.ts（变更前）
app.route('/', authRoutes)
app.route('/', projectRoutes)

// app.ts（变更后）
app.route('/api/v1', authRoutes)
app.route('/api/v1', projectRoutes)

// 旧路径兼容重定向（保留 1 个版本）
app.use('/api/*', (c, next) => {
  if (!c.req.path.startsWith('/api/v1')) {
    return c.redirect(c.req.path.replace('/api/', '/api/v1/'), 301)
  }
  return next()
})
```

**CORS 收紧**：

```typescript
// 变更前
app.use('*', cors({ origin: '*' }))

// 变更后
const allowedOrigins = [
  process.env.NEXTAUTH_URL,
  process.env.BACKEND_API_URL,
].filter(Boolean) as string[]

app.use('*', cors({ origin: allowedOrigins }))
```

Next.js `proxy.ts` 中的后端调用路径同步更新（`/api/` → `/api/v1/`）。

---

## P1：后端重组（Week 3-5）

### P1.1 拆分上帝服务

**`asset.service.ts`（696 行）→ 3 个文件**

```
server/src/services/
├── character-asset.service.ts   # CharacterAsset V2 CRUD + 图片上传
│                                # 方法：list, get, create, update, delete,
│                                #       generateImage, uploadImage
├── location-asset.service.ts    # LocationAsset V2 CRUD + 图片上传
│                                # 方法：同上
└── storage.service.ts           # 纯存储驱动（P0 去重后）
```

**`chat.ts` route（398 行）→ route + 2 services**

```
server/src/
├── routes/chat.ts               # HTTP 层：validate → call service → return（< 80 行）
├── services/chat.service.ts     # 消息存储、PipelineRun 创建、AgentOS 调用编排
└── services/intent.service.ts   # 意图识别
                                 #   短期：迁移 GENERATION_TRIGGER_PATTERNS +
                                 #         buildFallbackClarificationComplete
                                 #   中期：调用 AgentOS clarification workflow
                                 #   服务端 fallback 保留并标记 @deprecated
```

**`characters.ts` + `locations.ts` → 路由工厂**

```typescript
// server/src/lib/asset-route-factory.ts
export function createAssetRouter(config: AssetRouterConfig): Hono {
  // 生成标准路由：
  //   GET    /             list
  //   POST   /             create
  //   GET    /:id          get
  //   PATCH  /:id          update
  //   DELETE /:id          delete
  //   POST   /extract      SSE extract（复用 createAgentOSStream）
  //   POST   /:id/image    生成图片
}

// routes/characters.ts
export default createAssetRouter({
  model: 'character',
  service: characterAssetService,
  agentWorkflow: 'character_extraction',
})

// routes/locations.ts
export default createAssetRouter({
  model: 'location',
  service: locationAssetService,
  agentWorkflow: 'location_extraction',
})
```

### P1.2 统一 SSE 封装

**单一 `createAgentOSStream` 函数，替换 6+ 端点的分散实现**：

```typescript
// server/src/lib/sse.ts（重构后）

interface AgentOSStreamOptions {
  endpoint: string          // AgentOS 端点路径
  payload: Record<string, unknown>
  timeout?: number          // 默认 55000ms
  heartbeatInterval?: number // 默认 15000ms
  onEvent?: (event: SSEEvent) => Promise<void>  // 可选副作用钩子
  onComplete?: (result: unknown) => Promise<void>
}

export async function createAgentOSStream(
  c: Context,
  opts: AgentOSStreamOptions
): Promise<Response>
```

**覆盖场景**：chat（streaming）、characters/extract、locations/extract、storyboard/import、scripts/generate、scripts/polish。

55s 超时 + 15s 心跳参数在此统一定义，不再各端点分散配置。

### P1.3 NLP 意图识别归位

`GENERATION_TRIGGER_PATTERNS` 从路由层提取到 `intent.service.ts`：

```typescript
// services/intent.service.ts

export class IntentService {
  /**
   * 判断用户消息是否为「开始生成」意图
   * @deprecated 中期由 AgentOS clarification workflow 替代
   */
  isGenerationTrigger(message: string): boolean { ... }

  /**
   * 从对话历史构建降级的结构化完成响应
   * @deprecated 中期由 AgentOS clarification workflow 替代
   */
  buildFallbackClarificationComplete(messages: ChatMessage[]): ClarificationComplete { ... }
}
```

路由层调用 `intentService.isGenerationTrigger()`，不再内联正则。

---

## P2：前端重组（Week 6-8）

### P2.1 拆分 `scripts/page.tsx`

**目录结构**：

```
app/projects/[id]/@content/scripts/
└── page.tsx                      # 入口：数据获取 + 布局组装（< 80 行）

components/editor/
├── ScriptEditorShell.tsx         # 顶层 Shell：工具栏 + 键盘快捷键注册
├── ActSceneTree.tsx              # Acts → Scenes 树 + DnD（@dnd-kit）
├── TipTapEditor.tsx              # 富文本编辑器封装（已有，收紧接口）
├── ScriptToolbar.tsx             # 保存状态指示、格式切换
├── ExportMenu.tsx                # PDF/SRT/DOCX/MD/JSON/Fountain/CSV 导出
├── VersionHistoryPanel.tsx       # 版本历史（纯 DB，删除 localStorage 版）
├── InspirationPanel.tsx          # 灵感收藏（纯 DB Inspiration 表）
├── ScriptPolishPanel.tsx         # AI 润色 Diff + 应用
└── BranchingCanvas.tsx           # 分支剧本画布（@xyflow/react，WIP 独立迭代）

lib/hooks/
├── useScriptAutosave.ts          # 自动保存（统一命名，整合现有 useAutosave.ts）
├── useScriptExport.ts            # 导出逻辑封装
└── useScriptVersions.ts          # 版本 CRUD（纯 DB，无 localStorage）
```

**拆分原则**：
- 每个文件 < 300 行
- 单一职责，通过 props/context 传递数据
- 不直接读写全局状态，通过 hooks 封装副作用

### P2.2 消灭 LocalStorage 双写

**三个双写场景全部改为 DB 单一真相**：

| 场景 | 旧实现 | 新实现 |
|------|-------|-------|
| 版本历史 | localStorage + `ScriptVersion` | 仅 `ScriptVersion`，`VersionHistoryPanel` 直接调 `/api/v1/scripts/:id/versions` |
| 灵感收藏 | localStorage + `Inspiration` | 仅 `Inspiration`，`InspirationPanel` 直接调 `/api/v1/projects/:id/inspirations` |
| 角色/场景资产 | localStorage 乐观 + 手动回滚 + DB | 删除 `addProjectCharacterAsset`/`deleteProjectCharacterAsset`；改用 `useSWRMutation` 框架托管乐观更新 + 自动回滚 |

**LocalStorage 保留用途**（`web/lib/storage/local.ts`）：
- UI 偏好：侧边栏展开/折叠状态
- 主题设置
- 上次打开的标签页路径

其余所有 `als:` 前缀键全部删除。

### P2.3 代理层工厂精简

49 个纯透传 Route Handler 改用工厂函数生成：

```typescript
// app/api/_utils/route-factory.ts
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export function createProxyRoute(
  backendPath: string,
  methods: HttpMethod[]
) {
  return Object.fromEntries(
    methods.map(method => [
      method,
      (req: Request) => proxyRequest(req, method, backendPath)
    ])
  )
}
```

```typescript
// app/api/projects/[id]/route.ts（变更后，1 行）
export const { GET, PATCH, DELETE } = createProxyRoute('/api/v1/projects/:id', ['GET', 'PATCH', 'DELETE'])
```

有自定义逻辑的 Handler（auth callback、Stripe webhook）保留完整实现。

### P2.4 状态管理收紧

**`AIChatProvider` 瘦身**：

```typescript
// 保留（3 个字段）
interface AIChatState {
  isOpen: boolean
  pageType: PageType
  pendingSuggestion: AISuggestion | null
}
// 移除：聊天消息列表（下沉到 SWR 查询）、loading 状态（SWR 托管）
```

**`GenerationJobsProvider` 改为 SWR 轮询**：

```typescript
// 变更前：手写 setInterval
useEffect(() => {
  const interval = setInterval(fetchJobs, 3000)
  return () => clearInterval(interval)
}, [])

// 变更后：SWR refreshInterval
const { data: jobs } = useSWR('/api/v1/jobs', fetcher, {
  refreshInterval: data => data?.some(j => j.status === 'pending') ? 3000 : 0
})
```

**`pipeline-store` + `pipeline-controller` 解耦**：

```typescript
// pipeline-store.ts：只存状态，无副作用
// pipeline-controller.ts：只做 API 调用 + 状态派发，不读/写 DOM
// 二者通过 store.subscribe() 通信，不直接调用对方
```

---

## P3：新功能（Week 9+，与 P2 尾段并行可行）

### AI 负责人（AI Director）

**后端**：
- 新增 `agentos/workflows/director_workflow.py`
- 输入：剧本上下文（场景列表、角色列表、当前幕）
- 输出：结构化修改建议（角色弧线问题、节奏建议、冲突强化点）
- 新增 Hono 端点：`POST /api/v1/projects/:id/scripts/:scriptId/director`（SSE，复用 `createAgentOSStream`）

**前端**：
- `components/editor/AIDirectorPanel.tsx` — 建议列表 + 一键应用
- `lib/hooks/useAIDirector.ts` — SSE 状态管理
- 挂载在 `ScriptEditorShell` 右侧插槽

### 树形剧本（Branching Script）

- `ScriptScene` 表中 `parentSceneId`（self-relation）、`branchLabel` 字段在 P0.1 中已预留
- `BranchingCanvas.tsx` 基于 `@xyflow/react`（与角色关系图复用同一技术栈）
- API 层通过现有 script endpoint 扩展，不新增独立路由
- 编辑操作：创建分支场景、设置分支标签、合并分支

### 新导出格式

- **Fountain**（好莱坞标准格式）：`useScriptExport.ts` 纯前端转换
- **CSV 台词表**：角色名 + 台词 + 场景，纯前端转换
- `ExportMenu.tsx` 增加两个选项，无需后端改动

---

## 测试策略

### 覆盖率要求

| 层级 | 工具 | 覆盖率目标 |
|------|------|-----------|
| 后端单元 | Jest + `@prisma/client` mock | **80%** |
| 后端集成 | Jest + Supertest + 测试 DB | happy path + 4xx/5xx 全覆盖 |
| Python 单元 | pytest | **80%**（service + workflow 各阶段） |
| 前端组件 | Vitest + Testing Library | **70%**（含 loading/error 状态） |
| E2E | Playwright（现有） | 台本编辑、角色创建、分镜生成 3 条核心流程 |

### TDD 节律

每个任务：
1. **RED**：先写测试，运行确认失败
2. **GREEN**：最小实现，测试通过
3. **REFACTOR**：重构，测试保持绿色

---

## 完整时间线

```
Week 1-2   P0 技术债清零
  ├─ P0.1  Schema 迁移（V1→V2, JSON Blob→表, UsageRecord, PLAN_LIMITS 外化）
  ├─ P0.2  StorageService 去重 + 单元测试（8 条路径）
  ├─ P0.3  image_service.py 清理 + 并发锁 + pytest
  └─ P0.4  API 版本化 /api/v1/* + CORS 白名单

Week 3-5   P1 后端重组
  ├─ P1.1  asset.service.ts 拆分（character-asset / location-asset / storage）
  ├─ P1.2  chat.ts → route + chat.service + intent.service
  ├─ P1.3  createAssetRouter 工厂（消灭 characters/locations 重复）
  └─ P1.4  createAgentOSStream 统一 SSE（6 端点切换）

Week 6-8   P2 前端重组
  ├─ P2.1  scripts/page.tsx 拆分为 10 模块（TDD 每模块先写测试）
  ├─ P2.2  LocalStorage 双写消灭（SWR 乐观更新替代手动回滚）
  ├─ P2.3  createProxyRoute 工厂精简 49 个透传 Handler
  └─ P2.4  状态管理收紧（AIChatProvider / GenerationJobsProvider / pipeline）

Week 9+    P3 新功能（与 P2 尾段并行）
  ├─ AI 负责人工作流 + 前端面板（AIDirectorPanel）
  ├─ 树形剧本（ScriptScene self-relation + BranchingCanvas）
  └─ 新导出格式（Fountain / CSV）
```

---

## 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 重构节奏 | 渐进式，每阶段独立上线 | 低风险，持续可验证，不中断线上服务 |
| 数据真相 | DB 单一真相，localStorage 仅 UI 偏好 | 消灭数据不一致，简化调试 |
| 代理层 | 保留 Next.js 代理，用工厂精简代码量 | NextAuth session 需要服务端注入 token，无法绕过 |
| V1 模型 | 一次性迁移后删除，不保留双写兼容 | 双写兼容期是技术债，P0 一次解决 |
| SSE 封装 | 单一 `createAgentOSStream`，6 端点统一 | 超时/心跳参数一处修改，行为一致 |
| NLP fallback | 保留服务端 fallback 标记 deprecated | AgentOS 工作流替换前保底，不立即删除 |
| 新功能时机 | P3 在 P2 完成后开始 | 避免在遗留代码上叠加复杂度 |
| 测试策略 | TDD 同步，后端 80% 覆盖率 | 重构安全网，防止回归 |

---

## 不在范围内（本次不做）

- 替换 Next.js 代理为直连（需要改变部署架构和 Auth 方案，风险过高）
- AgentOS 工作流框架替换（Agno 工作良好，不引入新框架）
- 数据库迁移到非 Supabase（无必要）
- 前端状态管理库替换（Zustand 按需引入即可，不全量迁移）
- UI 设计系统重建（MUJI 风格保持不变）
