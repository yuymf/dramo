# 数据库模型参考

> Prisma schema 位于 `server/src/db/schema.prisma`，本地 PostgreSQL 容器（`postgres:15-alpine`）。

## 模型总览（18 张表）

| 模型 | 用途 | 关键字段 |
|------|------|---------|
| `User` | 默认用户记录（无认证） | email, name |
| `UserLLMConfig` | 用户自定义 LLM 配置 | type (TEXT_LLM/IMAGE_GEN), apiKey (AES-256-GCM 加密), baseUrl, modelId, isDefault |
| `Project` | 项目工作区 | userId, name, description |
| `Script` | 台本 | projectId, type/style/form, scenes (JSON), acts (JSON), status |
| `ScriptScene` | 场景行（拆开存储）| scriptId, actIndex, order, content, parentSceneId |
| `ScriptVersion` | 台本版本历史 | scriptId, version, content (JSON) |
| `CharacterAsset` | 角色资产（多图）| projectId, name, alias, description, images (JSON) |
| `LocationAsset` | 场景资产（多图）| projectId, name, alias, description, images (JSON) |
| `CharacterRelation` | 角色关系图（无向边）| projectId, nodeAId（较小 ID）, nodeBId（较大 ID）, type, weight |
| `Storyboard` | 分镜数据 | projectId（unique）, frames (JSON) |
| `StoryboardShot` | 分镜镜头（拆开存储）| storyboardId, sceneOrder, shotOrder, payload |
| `StoryboardFrameImage` | 分镜帧图片 | projectId, frameId, image (JSON) |
| `GenerationJob` | 图片生成队列 | userId, projectId, status, progress, params, resultUrl, error |
| `ChatSession` | 对话会话 | projectId, title, lastMessageAt |
| `ChatMessage` | 对话消息 | projectId, sessionId, role, content, messageType, options, selectedOption |
| `Task` | 通用异步任务 | userId, type, status, input, result, error |
| `PipelineRun` | 多步工作流 | projectId, status, requirements, currentStep, stepResults |
| `Inspiration` | 灵感库 | projectId, text, category, isFavorite |

> 默认用户：`id=default-local-user`、`email=local@dramo.tool`，由 `server/src/lib/default-user.ts` 在启动时 `upsert`。

## 关键约束

- `User`: `email @unique`
- `UserLLMConfig`: `@@unique([userId, name])` — 同一用户配置名唯一
- `CharacterRelation`: `@@unique([projectId, nodeAId, nodeBId, type])` — 关系边唯一，nodeA 始终 < nodeB（归一化）
- `Storyboard`: `projectId @unique` — 每项目一个分镜
- `StoryboardFrameImage`: `@@unique([projectId, frameId])` — 每帧一张图
- `ScriptVersion`: `@@unique([scriptId, version])` — 版本号唯一

## 关系图

```
User (default-local-user, 单用户)
 ├── Project[]
 │    ├── Script[] → ScriptVersion[]、ScriptScene[]
 │    ├── CharacterAsset[] ←→ CharacterRelation[]
 │    ├── LocationAsset[]
 │    ├── Storyboard (1:1) → StoryboardShot[]、StoryboardFrameImage[]
 │    ├── GenerationJob[]
 │    ├── ChatSession[] → ChatMessage[]
 │    ├── PipelineRun[]
 │    └── Inspiration[]
 └── UserLLMConfig[]
```

## 索引策略

核心查询模式均有对应索引：
- `@@index([userId])` — 按用户查项目、配置、任务
- `@@index([projectId])` — 按项目查子资源
- `@@index([status])` — 按状态筛选任务、生成任务
- `@@index([createdAt])` — 按时间排序
- 复合索引：`[userId, type, isDefault]`、`[userId, status]`、`[status, createdAt]`、`[scriptId, actIndex, order]`

## 迁移

迁移目录：`server/src/db/migrations/`（由 `package.json` 中的 `prisma.schema` 指向 `src/db/schema.prisma` 决定）。

```bash
npm run prisma:generate   # 生成 Prisma Client（schema 变更后必须）
npm run prisma:migrate    # 运行数据库迁移
npm run prisma:studio     # 打开数据库浏览器
```

> 旧的 `server/prisma/migrations/MANUAL_p0_v1_to_v2/` 已被 `20260501020000_p0_drop_v1_asset_tables` 等正式迁移取代，仅保留 README 作为历史说明。
