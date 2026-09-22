# 数据库模型参考

Prisma：`server/src/db/schema.prisma`。PostgreSQL：`postgres:15-alpine`。

没有 `default-local-user`。`User` 是注册账号，带 `passwordHash` 和 `Session[]`。

没有 `GenerationJob` / `Script` / `CharacterAsset` / `LocationAsset` / `Storyboard` / `Task` / `Inspiration`。出图表是 `GenerationTask`。

## 模型

| 模型 | 用途 |
|------|------|
| `User` | 账号（email unique, passwordHash） |
| `Session` | cookie token，`expiresAt` |
| `UserLLMConfig` | 文本 LLM；`type` 仅 `TEXT_LLM` |
| `Project` | 工作区（type / format / share / published） |
| `ProjectMember` | 成员 + 角色 |
| `Episode` | 集；挂 screenplay / outline / beats / scenes / shots / reels |
| `Screenplay` | 正文 JSON `nodes` + `crdt` |
| `ScreenplayVersion` | 剧本版本 |
| `Outline` `Beat` | 规划 |
| `Scene` `Shot` | 前期场次 / 镜头 |
| `Reel` `ReelFilm` | Cinema |
| `Character` `Location` `Prop` | 实体 |
| `KnowledgeFile` `WorldviewRule` | 知识 / 世界观 |
| `Asset` | 生成或上传的文件 |
| `GenerationTask` | SD 池出图队列 |
| `ChatSession` `ChatMessage` | 对话 |
| `Comment` `ProjectVersion` | 协作批注 / 快照 |
| `LibraryDiscussion` | 公开库讨论 |

## 约束（摘）

- `User.email @unique`
- `Session.token @unique`
- `UserLLMConfig @@unique([userId, name])`
- `ProjectMember @@unique([projectId, userId])`
- `Project.shareToken @unique`
- `Screenplay.episodeId @unique`
- `ScreenplayVersion @@unique([screenplayId, version])`
- `Character` / `Location` / `Prop`：`@@unique([projectId, name])`
- `WorldviewRule @@unique([projectId, key])`

## 关系

```
User
 ├── Session[]
 ├── UserLLMConfig[]
 ├── ProjectMember[] → Project
 ├── GenerationTask[]
 ├── Comment[]
 └── LibraryDiscussion[]

Project
 ├── ProjectMember[]
 ├── Episode[]
 │    ├── Screenplay → ScreenplayVersion[]
 │    ├── Outline / Beat[]
 │    ├── Scene[] → Shot[]
 │    └── Reel[] → ReelFilm[]
 ├── Character[] / Location[] / Prop[]
 ├── KnowledgeFile[] / WorldviewRule[]
 ├── Asset[] / GenerationTask[]
 ├── ChatSession[] → ChatMessage[]
 ├── Comment[] / ProjectVersion[]
 └── LibraryDiscussion[]
```

## 迁移

`server/src/db/migrations/`。

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```
