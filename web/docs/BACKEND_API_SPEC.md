# 后端 API 接口交付文档

## 概述

本文档描述了「AI 直播台本生成助手」前端应用需要后端实现的所有 REST API 接口。所有接口基于 OpenAPI 3.0.3 规范，使用 JSON 格式进行数据交互。

**基础地址**: `http://localhost:3000` (开发环境)

**版本**: 2.0  
**更新日期**: 2025-10-16

---

## 通用规范

### 认证

所有接口（除 `/api/health`）均需要 Bearer Token 认证：

```http
Authorization: Bearer <token>
```

**说明**:
- 开发环境可使用固定 token 或跳过验证
- 生产环境需实现 JWT 或 OAuth2 验证
- 401 响应表示未认证，403 表示无权限

### 幂等性

变更类 POST 请求支持幂等键（推荐）：

```http
Idempotency-Key: <uuid>
```

**说明**:
- 相同幂等键的重复请求返回相同结果
- 幂等键有效期建议 24 小时
- 用于防止网络重试导致的重复操作

### 通用响应格式

**成功响应**:
- 使用标准 HTTP 状态码 (200, 201, 202, 204)
- Content-Type 为 `application/json`
- 时间字段统一使用 ISO8601 格式

**列表响应**:
```typescript
{
  data: T[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
```

**单项响应**:
```typescript
T  // 直接返回对象
```

**异步任务响应** (202):
```typescript
{
  taskId: string;
  status: 'queued' | 'running';
  estimatedSeconds?: number;
}
```

### 错误响应

所有错误统一格式：

```typescript
{
  error: {
    code: string;           // 错误码（大写下划线）
    message: string;        // 用户可读的错误信息
    details?: object;       // 可选的详细信息
    retryable?: boolean;    // 是否可重试
  };
  requestId: string;        // 请求追踪ID
}
```

**常见错误码**:

| HTTP | Code | Message | Retryable |
|------|------|---------|-----------|
| 400 | INVALID_INPUT | 请求参数不合法 | false |
| 400 | MISSING_REQUIRED_FIELD | 缺少必填字段 | false |
| 401 | UNAUTHORIZED | 未提供有效的认证凭据 | false |
| 403 | FORBIDDEN | 无权访问该资源 | false |
| 404 | NOT_FOUND | 资源不存在 | false |
| 409 | CONFLICT | 资源冲突（如重复创建） | false |
| 429 | RATE_LIMITED | 请求频率超限 | true |
| 500 | INTERNAL_ERROR | 服务器内部错误 | true |
| 503 | SERVICE_UNAVAILABLE | 服务暂时不可用 | true |
| 504 | UPSTREAM_TIMEOUT | 上游 AI 服务超时 | true |

**限流响应头**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1697123456
Retry-After: 60
```

---

## 一、健康检查

### 1.1 健康检查

**接口**: `GET /api/health`

**认证**: 无需认证

**响应 200**:
```typescript
{
  ok: boolean;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}
```

**说明**:
- 用于负载均衡器健康检查
- 应检查数据库、Redis、队列等依赖服务
- 建议 < 100ms 响应

---

## 二、项目管理接口

### 2.1 获取项目列表

**接口**: `GET /api/projects`

**认证**: 必需

**查询参数**:
```typescript
{
  page?: number;        // 页码，默认 1
  limit?: number;       // 每页数量，默认 10，最大 100
  search?: string;      // 搜索关键词（按项目名称模糊搜索）
}
```

**响应 200**:
```typescript
{
  data: Project[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
```

### 2.2 创建项目

**接口**: `POST /api/projects`

**认证**: 必需

**请求头**:
- `Idempotency-Key`: 可选，防止重复创建

**请求体**:
```typescript
{
  name: string;         // 必填，项目名称 (1-80字符)
  description?: string; // 可选，项目描述（最多 500 字符）
  personaId?: string;   // 可选，关联的默认人设ID
}
```

**响应 201**:
```typescript
Project
```

**错误响应**:
- 400: 参数校验失败
- 409: 项目名称已存在（如启用唯一性约束）

### 2.3 获取项目详情

**接口**: `GET /api/projects/{id}`

**认证**: 必需

**路径参数**:
- `id`: string - 项目ID

**响应 200**:
```typescript
{
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  scriptCount: number;
  scripts: ScriptSummary[];
}
```

**错误响应**:
- 404: 项目不存在

### 2.4 更新项目

**接口**: `PUT /api/projects/{id}`

**认证**: 必需

**路径参数**:
- `id`: string - 项目ID

**请求体**:
```typescript
{
  name: string;         // 必填
  description?: string;
  personaId?: string;
}
```

**响应 200**:
```typescript
Project
```

**错误响应**:
- 404: 项目不存在
- 400: 参数校验失败

### 2.5 删除项目

**接口**: `DELETE /api/projects/{id}`

**认证**: 必需

**路径参数**:
- `id`: string - 项目ID

**响应 204**: 无内容

**错误响应**:
- 404: 项目不存在

---

## 三、台本管理接口

> **注意**: 以下接口 (`GET /api/scripts`, `POST /api/scripts`) 已在代码中删除。请使用项目级别的接口 `GET /api/projects/{projectId}/script` 和 `POST /api/projects/{projectId}/script`。详见 `BACKEND_API_SPEC_V3_ADDENDUM.md`。

### 3.1 获取台本列表 [已删除]

**接口**: ~~`GET /api/scripts`~~ **已删除**

**认证**: 必需

**查询参数**:
```typescript
{
  projectId?: string;   // 按项目ID过滤
  status?: 'draft' | 'published' | 'archived';
  page?: number;        // 默认 1
  limit?: number;       // 默认 10
}
```

**响应 200**:
```typescript
{
  data: Script[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
```

### 3.2 创建/生成台本（异步） [已删除]

**接口**: ~~`POST /api/scripts`~~ **已删除**

**认证**: 必需

**请求头**:
- `Idempotency-Key`: 推荐，防止重复生成

**请求体**:
```typescript
{
  projectId: string;    // 必填，所属项目ID
  title: string;        // 必填，台本标题 (1-120字符)
  type?: string;        // 可选，类型 (product/game/talk/interview/custom)
  style?: string;       // 可选，风格 (humorous/formal/enthusiastic/custom)
  parameters?: {        // 可选，生成参数
    topic?: string;
    goal?: string;
    scene?: string;
    currentEvents?: string;
  };
}
```

**响应 202** (异步模式):
```typescript
{
  taskId: string;
  status: 'queued';
  estimatedSeconds: 30;
}
```

**响应 201** (同步模式 - 仅开发环境):
```typescript
Script  // 包含完整的 scenes 数组
```

**说明**: 
- **生产环境推荐异步模式**：返回 202 + taskId，客户端轮询 `GET /api/tasks/{taskId}`
- **开发/Mock 环境可配置同步**：直接返回 201 + 完整 Script
- 当提供 `parameters` 时，后端应调用 AI 服务生成包含典型结构的完整台本（至少5个场景）
- 生成的场景应包含：开场、主题陈述、核心环节、互动、收尾等典型结构

**错误响应**:
- 400: 参数校验失败
- 404: projectId 不存在

### 3.3 获取台本详情

**接口**: `GET /api/scripts/{id}`

**认证**: 必需

**路径参数**:
- `id`: string - 台本ID

**响应 200**:
```typescript
{
  id: string;
  title: string;
  projectId: string;
  type: string;
  style: string;
  status: 'draft' | 'published' | 'archived';
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}
```

**错误响应**:
- 404: 台本不存在

### 3.4 更新台本内容

**接口**: `PATCH /api/scripts/{id}/content`

**认证**: 必需

**路径参数**:
- `id`: string - 台本ID

**请求体**:
```typescript
{
  scenes: Scene[];      // 更新后的完整场景列表
}
```

**响应 200**:
```typescript
Script
```

**说明**:
- 此接口用于保存用户编辑后的台本内容
- 应触发自动保存机制
- 建议实现乐观锁（version 字段）防止并发冲突

**错误响应**:
- 404: 台本不存在
- 409: 版本冲突

### 3.5 重新生成场景内容（异步）

**接口**: `POST /api/scripts/{id}/regenerate`

**认证**: 必需

**路径参数**:
- `id`: string - 台本ID

**请求头**:
- `Idempotency-Key`: 推荐

**请求体**:
```typescript
{
  sceneId: string;      // 要重新生成的场景ID
  parameters?: object;  // 可选，生成参数（覆盖原参数）
}
```

**响应 202** (异步模式):
```typescript
{
  taskId: string;
  status: 'queued';
  estimatedSeconds: 15;
}
```

**响应 200** (同步模式 - 仅开发环境):
```typescript
{
  scriptId: string;
  sceneId: string;
  candidates: Array<{
    id: string;
    text: string;
    rank: number;
  }>;
  regeneratedAt: string;
}
```

**说明**:
- **生产环境推荐异步模式**：返回 202，任务完成后结果包含 `candidates` 数组
- **开发环境可同步**：直接返回候选内容
- 用于单个场景的重写/重新生成
- 前端可展示多个候选项供用户选择

**错误响应**:
- 404: 台本或场景不存在
- 400: sceneId 缺失

---

## 四、灵感推荐接口

### 4.1 获取灵感推荐

**接口**: `GET /api/inspirations`

**认证**: 必需

**查询参数**:
```typescript
{
  projectId: string;    // 必填，项目ID
  category?: 'quotes' | 'topics' | 'interactions' | 'hotspots';
}
```

**响应 200**:
```typescript
{
  data: Inspiration[];
}
```

**说明**: 
- 基于当前项目上下文实时推荐相关素材
- 推荐应包含金句、话题、互动玩法、热点梗等不同类型
- 灵感与项目关联，不与具体台本绑定，可跨台本复用
- 建议缓存 5 分钟

**错误响应**:
- 400: projectId 缺失
- 404: 项目不存在

### 4.2 刷新灵感推荐（异步） [已删除]

**接口**: ~~`POST /api/inspirations/refresh`~~ **已删除**

> **注意**: 此接口已在代码中删除。请使用 `POST /api/inspirations/{projectId}/recommend`。详见 `BACKEND_API_SPEC_V3_ADDENDUM.md`。

**认证**: 必需

**请求头**:
- `Idempotency-Key`: 推荐

**请求体**:
```typescript
{
  projectId: string;    // 必填，项目ID
  locale?: string;      // 可选，语言代码（默认 zh-CN）
}
```

**响应 202** (异步模式):
```typescript
{
  taskId: string;
  status: 'queued';
  estimatedSeconds: 10;
}
```

**响应 200** (同步模式 - 仅开发环境):
```typescript
{
  data: Inspiration[];
}
```

**响应头**:
- `X-Stub: true` - 标记当前为占位实现（开发环境）

**说明**:
- **生产环境推荐异步模式**：依据项目内容调用 AI 生成灵感
- **开发环境可同步**：返回静态假数据或快速生成
- 灵感基于项目级别，可在项目内所有台本间共享

**错误响应**:
- 400: projectId 缺失
- 404: 项目不存在

### 4.3 收藏灵感

**接口**: `POST /api/inspirations/favorite`

**认证**: 必需

**请求体**:
```typescript
{
  inspirationId: string;
}
```

**响应 200**:
```typescript
{
  inspirationId: string;
  isFavorite: boolean;
}
```

**说明**: 
- 支持切换收藏状态（toggle）
- 收藏数据与用户关联

### 4.4 获取收藏列表

**接口**: `GET /api/inspirations/favorites`

**认证**: 必需

**响应 200**:
```typescript
{
  data: Inspiration[];
}
```

---

## 五、人设管理接口

### 5.1 获取人设列表

**接口**: `GET /api/personas`

**认证**: 必需

**响应 200**:
```typescript
{
  data: Persona[];
}
```

### 5.2 获取人设详情

**接口**: `GET /api/personas/{id}`

**认证**: 必需

**路径参数**:
- `id`: string - 人设ID

**响应 200**:
```typescript
Persona
```

**错误响应**:
- 404: 人设不存在

---

## 六、文本润色接口

### 6.1 文本润色

**接口**: `POST /api/polish`

**认证**: 必需

**请求体**:
```typescript
{
  text: string;         // 待润色的文本（最多 5000 字符）
  style?: 'humorous' | 'formal' | 'enthusiastic' | 'custom';
  personaId?: string;   // 关联的人设ID（用于一致性校验）
  operation?: 'enhance' | 'simplify' | 'adjust_tone';
}
```

**响应 200**:
```typescript
{
  original: string;
  polished: string;
  explanation: string;
}
```

**说明**: 
- AI 服务应根据人设约束进行润色
- 保留专有名词和关键信息
- 提供修改原因说明
- 建议 < 10 秒响应

**错误响应**:
- 400: 文本为空或超长
- 404: personaId 不存在

---

## 七、异步任务查询

### 7.1 查询任务状态

**接口**: `GET /api/tasks/{taskId}`

**认证**: 必需

**路径参数**:
- `taskId`: string - 任务ID

**响应 200**:
```typescript
{
  taskId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  progress?: number;        // 0-100，可选
  result?: any;             // 任务成功时的结果
  error?: {                 // 任务失败时的错误
    code: string;
    message: string;
    retryable: boolean;
  };
  createdAt: string;
  updatedAt: string;
  estimatedSeconds?: number;
}
```

**轮询建议**:
- 初始间隔 1 秒
- 逐步增加到 3 秒
- 最大轮询时间 2 分钟
- 超时后展示错误提示

**错误响应**:
- 404: 任务不存在或已过期（建议保留 24 小时）

---

## 数据模型定义

### Project
```typescript
{
  id: string;           // 格式: proj_...
  name: string;
  description?: string;
  createdAt: string;    // ISO8601
  updatedAt: string;
  scriptCount: number;
}
```

### ScriptSummary
```typescript
{
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}
```

### Script
```typescript
{
  id: string;           // 格式: script_...
  title: string;
  projectId: string;
  type: 'product' | 'game' | 'talk' | 'interview' | 'custom';
  style: 'humorous' | 'formal' | 'enthusiastic' | 'custom';
  status: 'draft' | 'published' | 'archived';
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}
```

### Scene
```typescript
{
  id: string;           // 格式: scene_...
  title: string;        // 场景名称 (1-80字符)
  order: number;        // 排序序号 (>=1)
  content: Block[];     // 场景内容块列表
}
```

### Block
```typescript
{
  id: string;
  label: string;        // 区块标签（如"开场暖场"）
  text: string;         // 内容文本
}
```

### Inspiration
```typescript
{
  id: string;
  text: string;         // 灵感内容
  category: 'quotes' | 'topics' | 'interactions' | 'hotspots';
  relevance: number;    // 相关度评分 (0-1)
  source: string;       // 来源说明
}
```

### Persona
```typescript
{
  id: string;
  name: string;
  styleTags: string[];
  speechFeatures: {
    catchphrases: string[];
    tabooWords: string[];
    sentencePatterns?: string;
  };
}
```

---

## 技术要求

### 1. AI 集成

- **台本生成** (`POST /api/scripts`)：需集成 AI 服务生成结构化台本
- **场景重生成** (`POST /api/scripts/{id}/regenerate`)：针对单场景生成多个候选
- **灵感推荐** (`POST /api/inspirations/refresh`)：基于上下文的实时推荐
- **文本润色** (`POST /api/polish`)：保持人设一致性的文本优化

### 2. 数据校验

- 场景排序 (`Scene.order`) 应连续且唯一
- 台本生成后应包含至少 5 个场景
- Block 的 `label` 和 `text` 字段必填
- 禁忌词校验应在润色和保存时执行

### 3. 性能要求（SLO）

| 接口类型 | P95 延迟 | 说明 |
|---------|---------|------|
| 查询接口 | < 200ms | 项目/台本列表、详情 |
| 变更接口 | < 500ms | 创建/更新/删除 |
| 同步生成 | < 15s | 单场景重生成（开发环境） |
| 异步任务 | 队列等待 < 5s<br>总时长 < 120s | 完整台本生成 |
| 灵感推荐 | < 2s | 实时推荐 |

### 4. 并发与限流

**全局限流**:
- 每 IP：100 req/min
- 每用户：1000 req/hour

**生成类限流**:
- 台本生成：10 req/hour/user
- 场景重生成：30 req/hour/user
- 灵感刷新：20 req/hour/user

**响应头**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1697123456
```

### 5. 超时与重试

**客户端超时**:
- 查询接口：5 秒
- 变更接口：10 秒
- 任务轮询：单次 5 秒，总计 2 分钟

**服务端超时**:
- 上游 AI 调用：30-60 秒
- 数据库查询：5 秒
- 任务最大执行时间：120 秒

**重试策略**:
- 仅对 `retryable: true` 的错误重试
- 指数退避：1s, 2s, 4s
- 最大重试 3 次
- 使用幂等键保证安全

### 6. 幂等性保证

**实现方式**:
- Redis 存储幂等键 → 响应映射
- TTL 24 小时
- 相同键返回缓存结果（200 而非 201）

**适用接口**:
- `POST /api/projects`
- `POST /api/scripts`
- `POST /api/scripts/{id}/regenerate`
- `POST /api/inspirations/refresh`

### 7. 错误处理

- 所有接口应返回清晰的错误信息
- AI 服务失败时提供降级方案（如返回结构骨架）
- 使用标准 HTTP 状态码
- 包含 `requestId` 用于追踪

### 8. 可观测性

**日志**:
- 结构化 JSON 格式
- 包含 `requestId`、`userId`、`duration`
- 记录所有错误堆栈

**指标**:
- 请求 QPS/延迟分布
- 错误率（按接口/错误码）
- 任务队列长度/等待时间
- AI 调用成功率/延迟

**追踪**:
- OpenTelemetry 分布式追踪
- 关联前后端请求链路

---

## 高性能后端推荐方案

### 架构概览

```
[Client] → [Nginx/Cloudflare] → [API Service (Fastify)] → [PostgreSQL]
                                         ↓                      ↓
                                    [Redis Cache]         [Redis Queue]
                                                               ↓
                                                          [Worker Pool]
                                                               ↓
                                                          [AI Service]
```

### 技术栈选型

| 组件 | 推荐方案 | 原因 |
|------|---------|------|
| **网关** | Nginx / Cloudflare | 限流、缓存、SSL 终止，隔离瞬时流量 |
| **API 服务** | Node.js (Fastify) + TypeScript | 与前端同栈、生态成熟、I/O 并发优秀 |
| **队列** | Redis + BullMQ | 简单可靠、延时/重试/并发控制易用 |
| **Worker** | 独立进程池 | 隔离 CPU 密集任务与 AI 调用 |
| **数据库** | PostgreSQL | 事务支持、结构化数据、成熟稳定 |
| **缓存** | Redis | 会话、幂等键、短期缓存 |
| **观测** | OpenTelemetry + Prometheus | 标准化追踪、指标采集 |
| **部署** | Docker + K8s | 水平扩展、HPA 按负载自动扩缩 |

### 为什么选择这套方案

1. **I/O 密集特性**：Node.js 事件循环天然适合高并发 I/O，AI 生成等待期间不阻塞
2. **队列解耦**：长耗时任务异步化，释放 API 服务吞吐，失败可重试
3. **成本可控**：高峰期队列缓冲，Worker 按需扩展，避免过度预留资源
4. **可观测性**：统一追踪链路，快速定位瓶颈（AI 延迟 vs 数据库 vs 队列）
5. **渐进式扩展**：初期单机部署，后期水平扩展 API/Worker 副本

### 并发控制

**API 服务**:
- 每实例 1000 并发连接
- 数据库连接池 20-50
- Redis 连接池 10

**Worker 池**:
- 每 Worker 并发 AI 调用：3-5（避免上游限流）
- 使用 `p-limit` 控制并发度
- 独立队列优先级：高优（重生成）> 普通（完整生成）

**数据库**:
- 读写分离（主从复制）
- 查询接口走从库
- 变更接口走主库

### 扩展策略

**水平扩展触发条件**:
- API 服务：CPU > 70% 或 QPS > 800/实例
- Worker：队列长度 > 50 或等待时间 > 10s

**自动扩缩容（HPA）**:
```yaml
minReplicas: 2
maxReplicas: 10
metrics:
  - type: Resource
    resource:
      name: cpu
      target: 70%
  - type: External
    external:
      metric: queue_length
      target: 50
```

### 成本估算（参考）

**小规模（< 1000 用户）**:
- API: 2 实例 × 2 core = 4 core
- Worker: 2 实例 × 2 core = 4 core
- PostgreSQL: 1 主 + 1 从 = 4 core
- Redis: 1 实例 = 2 core
- **总计**: ~14 core + AI API 成本

**中规模（1000-10000 用户）**:
- API: 5 实例 = 10 core
- Worker: 5 实例 = 10 core
- PostgreSQL: 1 主 + 2 从 = 8 core
- Redis: 2 实例（主从）= 4 core
- **总计**: ~32 core + AI API 成本

---

## 附录：接口清单

| 模块 | 方法 | 接口路径 | 说明 | 异步 |
|------|------|----------|------|------|
| 健康检查 | GET | /api/health | 健康检查 | - |
| 项目管理 | GET | /api/projects | 获取项目列表 | - |
| 项目管理 | POST | /api/projects | 创建项目 | - |
| 项目管理 | GET | /api/projects/{id} | 获取项目详情 | - |
| 项目管理 | PUT | /api/projects/{id} | 更新项目 | - |
| 项目管理 | DELETE | /api/projects/{id} | 删除项目 | - |
| 台本管理 | GET | /api/scripts | 获取台本列表 | - |
| 台本管理 | POST | /api/scripts | 创建/生成台本 | ✓ |
| 台本管理 | GET | /api/scripts/{id} | 获取台本详情 | - |
| 台本管理 | PATCH | /api/scripts/{id}/content | 更新台本内容 | - |
| 台本管理 | POST | /api/scripts/{id}/regenerate | 重新生成场景 | ✓ |
| 灵感推荐 | GET | /api/inspirations | 获取灵感推荐 | - |
| 灵感推荐 | POST | /api/inspirations/refresh | 刷新灵感推荐 | ✓ |
| 灵感推荐 | POST | /api/inspirations/favorite | 收藏灵感 | - |
| 灵感推荐 | GET | /api/inspirations/favorites | 获取收藏列表 | - |
| 人设管理 | GET | /api/personas | 获取人设列表 | - |
| 人设管理 | GET | /api/personas/{id} | 获取人设详情 | - |
| 文本润色 | POST | /api/polish | 文本润色 | - |
| 任务查询 | GET | /api/tasks/{taskId} | 查询任务状态 | - |

**共计**: 19 个接口（含新增任务查询）

---

## 示例请求与响应

### 示例 1: 创建台本（异步）

**请求**:
```http
POST /api/scripts HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJhbGc...
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "projectId": "proj_abc123",
  "title": "直播带货·新品发布",
  "type": "product",
  "style": "enthusiastic",
  "parameters": {
    "topic": "智能手表新品",
    "goal": "展示核心功能，引导下单",
    "scene": "直播间",
    "currentEvents": "双十一预热"
  }
}
```

**响应 202**:
```http
HTTP/1.1 202 Accepted
Content-Type: application/json
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1697127056

{
  "taskId": "task_def456",
  "status": "queued",
  "estimatedSeconds": 30
}
```

### 示例 2: 轮询任务状态

**请求**:
```http
GET /api/tasks/task_def456 HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJhbGc...
```

**响应 200（进行中）**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "taskId": "task_def456",
  "status": "running",
  "progress": 45,
  "createdAt": "2025-10-16T10:30:00Z",
  "updatedAt": "2025-10-16T10:30:15Z",
  "estimatedSeconds": 15
}
```

**响应 200（成功）**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "taskId": "task_def456",
  "status": "succeeded",
  "progress": 100,
  "result": {
    "id": "script_xyz789",
    "title": "直播带货·新品发布",
    "projectId": "proj_abc123",
    "type": "product",
    "style": "enthusiastic",
    "status": "draft",
    "scenes": [
      {
        "id": "scene_001",
        "title": "开场暖场",
        "order": 1,
        "content": [
          {
            "id": "block_001",
            "label": "主持人开场",
            "text": "家人们晚上好！今天给大家带来一款超级惊喜的智能手表..."
          }
        ]
      }
    ],
    "createdAt": "2025-10-16T10:30:30Z",
    "updatedAt": "2025-10-16T10:30:30Z"
  },
  "createdAt": "2025-10-16T10:30:00Z",
  "updatedAt": "2025-10-16T10:30:30Z"
}
```

### 示例 3: 错误响应（限流）

**响应 429**:
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1697127056
Retry-After: 60

{
  "error": {
    "code": "RATE_LIMITED",
    "message": "生成台本请求过于频繁，请稍后再试",
    "details": {
      "limit": 10,
      "window": "1 hour"
    },
    "retryable": true
  },
  "requestId": "req_abc123def456"
}
```

### 示例 4: 错误响应（AI 超时）

**响应 504**:
```http
HTTP/1.1 504 Gateway Timeout
Content-Type: application/json

{
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "AI 服务响应超时，请重试",
    "details": {
      "service": "openai",
      "timeout": 60
    },
    "retryable": true
  },
  "requestId": "req_xyz789ghi012"
}
```

---

## 迁移指南

### 从同步到异步

**前端适配步骤**:

1. **检测响应状态码**:
```typescript
const response = await fetch('/api/scripts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Idempotency-Key': uuid(),
  },
  body: JSON.stringify(data),
});

if (response.status === 202) {
  // 异步模式
  const { taskId } = await response.json();
  const result = await pollTask(taskId);
} else if (response.status === 201) {
  // 同步模式（开发环境）
  const script = await response.json();
}
```

2. **实现轮询函数**:
```typescript
async function pollTask(taskId: string, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`/api/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const task = await response.json();
    
    if (task.status === 'succeeded') {
      return task.result;
    } else if (task.status === 'failed') {
      throw new Error(task.error.message);
    }
    
    // 指数退避：1s, 2s, 3s
    await sleep(Math.min(i + 1, 3) * 1000);
  }
  throw new Error('Task timeout');
}
```

3. **UI 反馈**:
- 显示进度条（使用 `progress` 字段）
- 提供取消按钮（可选）
- 超时后提示用户稍后查看

---

## 附录：内部服务集成规范（可选）

### 概述

本附录定义 Node.js API 服务与内部 AI 服务（如 Python AgentOS）的集成规范。**对外 OpenAPI 契约保持不变**，本规范仅约束服务间调用。

### 适用场景

- 使用 Python/AgentOS 作为 AI 计算微服务
- Node Worker 调用 AgentOS 完成生成任务
- 需要统一错误模型与追踪链路

### 服务间通信协议

#### 请求头透传

| 头部 | 是否透传 | 说明 |
|------|---------|------|
| `Authorization` | ❌ 否 | 外部 Bearer Token 不透传，使用服务间认证 |
| `X-Request-Id` | ✅ 是 | 追踪请求链路 |
| `traceparent` | ✅ 是 | OpenTelemetry W3C Trace Context |
| `Idempotency-Key` | 可选 | 如需幂等保证可透传 |

**示例**:
```http
POST /agentos/generate_script HTTP/1.1
Host: agentos-service:8000
Content-Type: application/json
X-Request-Id: req_abc123
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

{
  "projectId": "proj_123",
  "title": "直播带货·新品发布"
}
```

#### 服务间认证

**开发环境**:
- 内网直连，无需认证
- 通过网络隔离保证安全

**生产环境**（二选一）:

1. **mTLS（推荐）**:
```yaml
# K8s Service Mesh (Istio/Linkerd)
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: agentos-mtls
spec:
  selector:
    matchLabels:
      app: agentos
  mtls:
    mode: STRICT
```

2. **服务 JWT**:
```typescript
// Node Worker 生成服务 Token
const serviceToken = jwt.sign(
  {
    service: 'node-worker',
    audience: 'agentos',
  },
  process.env.SERVICE_JWT_SECRET,
  { expiresIn: '5m' }
);

headers: {
  'Authorization': `Bearer ${serviceToken}`,
}
```

### 错误映射规范

#### AgentOS → Node 统一错误码

| AgentOS HTTP 状态 | Node 错误码 | retryable | 说明 |
|------------------|------------|-----------|------|
| 400 Bad Request | `INVALID_INPUT` | false | 参数校验失败 |
| 404 Not Found | `NOT_FOUND` | false | 资源不存在 |
| 408 Timeout | `UPSTREAM_TIMEOUT` | true | 请求超时 |
| 422 Unprocessable | `INVALID_INPUT` | false | 业务逻辑校验失败 |
| 429 Too Many Requests | `RATE_LIMITED` | true | 限流 |
| 499 Client Closed | `UPSTREAM_TIMEOUT` | true | 客户端取消 |
| 500 Internal Error | `INTERNAL_ERROR` | true | 服务器错误 |
| 502 Bad Gateway | `INTERNAL_ERROR` | true | 上游服务不可用 |
| 503 Service Unavailable | `SERVICE_UNAVAILABLE` | true | 服务暂时不可用 |
| 504 Gateway Timeout | `UPSTREAM_TIMEOUT` | true | 网关超时 |

#### 实现示例

```typescript
// src/workers/error-mapper.ts
export function mapAgentOSError(err: Error): {
  code: string;
  message: string;
  retryable: boolean;
} {
  const msg = err.message;
  
  if (/AGENTOS_400|AGENTOS_422/.test(msg)) {
    return {
      code: 'INVALID_INPUT',
      message: 'AI 服务参数校验失败',
      retryable: false,
    };
  }
  
  if (/AGENTOS_404/.test(msg)) {
    return {
      code: 'NOT_FOUND',
      message: '请求的资源不存在',
      retryable: false,
    };
  }
  
  if (/AGENTOS_429/.test(msg)) {
    return {
      code: 'RATE_LIMITED',
      message: 'AI 服务请求频率超限',
      retryable: true,
    };
  }
  
  if (/AGENTOS_408|AGENTOS_499|AGENTOS_504|abort/.test(msg)) {
    return {
      code: 'UPSTREAM_TIMEOUT',
      message: 'AI 服务响应超时',
      retryable: true,
    };
  }
  
  if (/AGENTOS_5\d\d/.test(msg)) {
    return {
      code: 'INTERNAL_ERROR',
      message: 'AI 服务内部错误',
      retryable: true,
    };
  }
  
  return {
    code: 'INTERNAL_ERROR',
    message: '未知错误',
    retryable: true,
  };
}
```

### 重试与幂等策略

#### 重试规则

- **Node Worker 负责重试**：AgentOS 请求失败时，由 Node Worker 根据 `retryable` 字段决定是否重试
- **指数退避**：1s → 2s → 4s，最多 3 次
- **幂等保证**：Node 侧管理幂等键，AgentOS 请求尽量幂等（避免写副作用）

```typescript
// src/workers/retry.ts
import pRetry from 'p-retry';

export async function callAgentOSWithRetry<T>(
  path: string,
  body: unknown,
  opts?: { requestId?: string }
): Promise<T> {
  return pRetry(
    async () => {
      try {
        return await callAgentOS<T>(path, body, opts);
      } catch (err) {
        const mapped = mapAgentOSError(err as Error);
        if (!mapped.retryable) {
          throw new pRetry.AbortError(mapped.message);
        }
        throw err;
      }
    },
    {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 4000,
      onFailedAttempt: (err) => {
        logger.warn(
          { attempt: err.attemptNumber, retriesLeft: err.retriesLeft },
          'AgentOS call failed, retrying...'
        );
      },
    }
  );
}
```

#### 幂等性保证

- **Node 侧**：使用 Redis 存储幂等键 → 响应映射（TTL 24 小时）
- **AgentOS 侧**：请求设计为幂等（相同输入返回相同结果，不产生副作用）

```typescript
// src/workers/idempotency.ts
export async function callWithIdempotency<T>(
  idempotencyKey: string,
  fn: () => Promise<T>
): Promise<T> {
  // 检查缓存
  const cached = await redis.get(`idempotency:${idempotencyKey}`);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 执行请求
  const result = await fn();
  
  // 缓存结果
  await redis.setex(
    `idempotency:${idempotencyKey}`,
    86400, // 24 小时
    JSON.stringify(result)
  );
  
  return result;
}
```

### 超时与断路器

#### 超时配置

| 层级 | 超时时间 | 说明 |
|------|---------|------|
| Node Worker HTTP 调用 | 65 秒 | 略大于 AgentOS 超时 |
| AgentOS LLM 调用 | 60 秒 | 上游 AI 服务超时 |
| 任务总时长 | 120 秒 | 符合 SLO |

#### 断路器配置

```typescript
// src/workers/circuit-breaker.ts
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(callAgentOS, {
  timeout: 65000, // 65 秒超时
  errorThresholdPercentage: 50, // 错误率 > 50% 打开
  resetTimeout: 30000, // 30 秒后尝试恢复
  volumeThreshold: 10, // 至少 10 个请求才计算错误率
});

breaker.on('open', () => {
  logger.error('AgentOS circuit breaker opened');
  metrics.increment('agentos.circuit_breaker.open');
});

breaker.on('halfOpen', () => {
  logger.info('AgentOS circuit breaker half-open, testing...');
});

breaker.on('close', () => {
  logger.info('AgentOS circuit breaker closed');
  metrics.increment('agentos.circuit_breaker.close');
});

export async function callAgentOSWithBreaker<T>(
  path: string,
  body: unknown
): Promise<T> {
  try {
    return await breaker.fire(path, body);
  } catch (err) {
    if (breaker.opened) {
      // 断路器打开，回退到 Node 实现
      logger.warn('Falling back to Node implementation');
      return fallbackToNodeImplementation(body);
    }
    throw err;
  }
}
```

### 可观测性

#### 指标采集

**Node Worker 侧**（Prometheus）:

```typescript
// src/workers/metrics.ts
import { Histogram, Counter } from 'prom-client';

export const agentosHttpDuration = new Histogram({
  name: 'agentos_http_duration_seconds',
  help: 'AgentOS HTTP call duration in seconds',
  labelNames: ['path', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});

export const agentosHttpErrors = new Counter({
  name: 'agentos_http_errors_total',
  help: 'Total AgentOS HTTP call errors',
  labelNames: ['path', 'code'],
});

export const agentosJobsInflight = new Gauge({
  name: 'agentos_jobs_inflight',
  help: 'Number of in-flight AgentOS jobs',
});

// 使用示例
export async function callAgentOSWithMetrics<T>(
  path: string,
  body: unknown
): Promise<T> {
  const end = agentosHttpDuration.startTimer({ path });
  agentosJobsInflight.inc();
  
  try {
    const result = await callAgentOS<T>(path, body);
    end({ status: '200' });
    return result;
  } catch (err) {
    const mapped = mapAgentOSError(err as Error);
    agentosHttpErrors.inc({ path, code: mapped.code });
    end({ status: 'error' });
    throw err;
  } finally {
    agentosJobsInflight.dec();
  }
}
```

#### 分布式追踪

```typescript
// src/workers/tracing.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('node-worker');

export async function callAgentOSWithTrace<T>(
  path: string,
  body: unknown,
  opts?: { requestId?: string }
): Promise<T> {
  return tracer.startActiveSpan('agentos.call', async (span) => {
    span.setAttribute('agentos.path', path);
    span.setAttribute('request.id', opts?.requestId ?? '');
    
    try {
      const result = await callAgentOS<T>(path, body, {
        ...opts,
        traceparent: generateTraceparent(span.spanContext()),
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (err as Error).message,
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

function generateTraceparent(ctx: SpanContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-01`;
}
```

### 灰度与回滚

#### 灰度策略

```typescript
// src/workers/strategy.ts
export function shouldUseAgentOS(
  taskType: string,
  userId: string
): boolean {
  // 从配置中心读取灰度比例
  const grayRatio = config.get('agentos.grayRatio', 0);
  
  if (grayRatio === 0) {
    return false; // 完全关闭
  }
  
  if (grayRatio === 1) {
    return true; // 完全开启
  }
  
  // 按用户 ID 一致性哈希
  const hash = hashCode(userId);
  return (hash % 100) < (grayRatio * 100);
}

// 使用示例
export async function handleGenerateScript(job: Job) {
  const useAgentOS = shouldUseAgentOS('script_generation', job.data.userId);
  
  if (useAgentOS) {
    logger.info({ jobId: job.id }, 'Using AgentOS for script generation');
    return handleWithAgentOS(job);
  } else {
    logger.info({ jobId: job.id }, 'Using Node implementation');
    return handleWithNode(job);
  }
}
```

#### 自动回滚

```typescript
// src/workers/auto-rollback.ts
import { EventEmitter } from 'events';

const rollbackEmitter = new EventEmitter();

// 监控错误率
setInterval(async () => {
  const errorRate = await getAgentOSErrorRate(); // 从 Prometheus 查询
  const p95Latency = await getAgentOSP95Latency();
  
  if (errorRate > 0.1 || p95Latency > 90000) {
    logger.error(
      { errorRate, p95Latency },
      'AgentOS degraded, triggering rollback'
    );
    
    // 关闭灰度
    await config.set('agentos.grayRatio', 0);
    
    // 发送告警
    rollbackEmitter.emit('rollback', {
      reason: errorRate > 0.1 ? 'high_error_rate' : 'high_latency',
      errorRate,
      p95Latency,
    });
  }
}, 60000); // 每分钟检查一次

rollbackEmitter.on('rollback', (data) => {
  // 发送 Slack/PagerDuty 告警
  alerting.send({
    severity: 'critical',
    title: 'AgentOS Auto Rollback Triggered',
    message: `Reason: ${data.reason}, Error Rate: ${data.errorRate}, P95: ${data.p95Latency}ms`,
  });
});
```

### 最佳实践

1. **始终保留 Node 实现**：作为回退方案，确保 AgentOS 故障时系统可用
2. **渐进式灰度**：从 10% → 50% → 100%，每个阶段观察 1-2 天
3. **监控先行**：在灰度前部署完整指标与告警
4. **压测验证**：模拟高并发场景，验证 AgentOS 稳定性
5. **文档同步**：更新运维手册与故障排查指南

### 参考资源

- [高并发架构方案](BACKEND_ARCHITECTURE.md#python-agentos-融合方案可选)
- [AgentOS 集成示例](AGENTOS_INTEGRATION.md)
- [Agno 官方文档](https://docs.agno.com/introduction)

---

*文档版本*: 2.0  
*生成时间*: 2025-10-16  
*对应前端项目*: story_agent_front  
*OpenAPI 规范*: public/openapi.json, specs/001-ai-ai-ai/contracts/openapi.yaml
