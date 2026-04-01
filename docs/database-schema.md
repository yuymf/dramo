# 数据库模型参考

> Prisma schema 位于 `server/src/db/schema.prisma`，PostgreSQL (Supabase)。

## 模型总览 (17 张表)

| 模型 | 用途 | 关键字段 |
|------|------|---------|
| `User` | 用户认证 | email, password (bcrypt) |
| `UserLLMConfig` | 用户自定义 LLM 配置 | type (TEXT_LLM/IMAGE_GEN), apiKey (AES-256-GCM 加密), baseUrl, modelId, isDefault |
| `Project` | 项目工作区 | userId, name, description |
| `Script` | 台本 | projectId, type/style/form, scenes (JSON), acts (JSON), status |
| `ScriptVersion` | 台本版本历史 | scriptId, version, content (JSON) |
| `CharacterAsset` | 角色资产 (V2 多图) | projectId, name, description, alias, images (JSON) |
| `LocationAsset` | 场景资产 (V2 多图) | projectId, name, description, alias, images (JSON) |
| `CharacterRelation` | 角色关系图 (无向边) | projectId, nodeAId (较小ID), nodeBId (较大ID), type, weight |
| `Character3ViewAsset` | 角色三视图 (V1) | characterName, front/side/back |
| `LocationImageAsset` | 场景图片 (V1) | locationName, image |
| `Storyboard` | 分镜数据 | projectId (unique), frames (JSON) |
| `StoryboardFrameImage` | 分镜帧图片 | projectId, frameId, image (JSON) |
| `GenerationJob` | 图片生成队列 | userId, projectId, status, progress, params, resultUrl, error |
| `ChatMessage` | 对话历史 | projectId, role, content, messageType (text/options/progress) |
| `Task` | 通用异步任务 | userId, type, status, input, result, error |
| `PipelineRun` | 多步工作流 | projectId, status, requirements, currentStep |
| `Inspiration` | 灵感库 | projectId, text, category, isFavorite |
| `Subscription` | Stripe 订阅 | userId, stripeCustomerId, planId, status |

## 关键约束

- `UserLLMConfig`: `@@unique([userId, name])` — 同一用户配置名唯一
- `CharacterRelation`: `@@unique([projectId, nodeAId, nodeBId, type])` — 关系边唯一，nodeA 始终 < nodeB (归一化)
- `Storyboard`: `projectId @unique` — 每项目一个分镜
- `StoryboardFrameImage`: `@@unique([projectId, frameId])` — 每帧一张图
- `ScriptVersion`: `@@unique([scriptId, version])` — 版本号唯一

## 关系图

```
User
 ├── Project[]
 │    ├── Script[] → ScriptVersion[]
 │    ├── CharacterAsset[] ←→ CharacterRelation[]
 │    ├── LocationAsset[]
 │    ├── Character3ViewAsset[]
 │    ├── LocationImageAsset[]
 │    ├── Storyboard (1:1) → StoryboardFrameImage[]
 │    ├── GenerationJob[]
 │    ├── ChatMessage[]
 │    ├── PipelineRun[]
 │    └── Inspiration[]
 ├── Subscription (1:1)
 └── UserLLMConfig[]
```

## 索引策略

核心查询模式均有对应索引:
- `@@index([userId])` — 按用户查项目、配置、任务
- `@@index([projectId])` — 按项目查子资源
- `@@index([status])` — 按状态筛选任务、生成任务
- `@@index([createdAt])` — 按时间排序
- 复合索引: `[userId, type, isDefault]`、`[userId, status]`、`[status, createdAt]`

## 常用命令

```bash
npm run prisma:generate   # 生成 Prisma Client (schema 变更后必须)
npm run prisma:migrate    # 运行数据库迁移
npm run prisma:studio     # 打开数据库浏览器
```
