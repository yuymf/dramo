# 第五期共享契约

范围：分享链接、Yjs CRDT、在线状态、离线本地层、锚定评论、项目级快照、公开库。

## 分享

每个项目创建时生成固定 `shareToken`。模式：

| shareMode | 含义 |
|-----------|------|
| `invite` | 仅成员 |
| `anyone_view` | 已登录用户可看 |
| `anyone_edit` | 已登录用户可编（不当成成员写入） |

链接：`/s/:token`。Viewer 可评不可改稿。

## CRDT

剧本节点、大纲、beats 进 Yjs 文档（房间 `episode:{episodeId}`）。评论 / 知识 / 世界观 / 顾问 / 任务 / 资产不进 CRDT。

- 服务端用 `yjs` + `y-protocols` 做 WebSocket 同步，状态落 `Screenplay.crdt`（base64）。
- 节点 JSON 是物化快照，给导出 / 推导 / AI 读。
- 前端 `y-websocket` + `y-indexeddb`。

## HTTP

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/share/:token` | `{ projectId, shareMode }` |
| PATCH | `/projects/:id/share` | `{ shareMode }` OWNER/ADMIN |
| GET/POST | `/projects/:id/members` | 邀请 `{ email, role }` |
| GET/POST | `/projects/:id/comments` | `{ anchorType, anchorId, body, episodeId? }` |
| GET/POST | `/projects/:id/versions` | `{ name? }` 无名即自动点 |
| POST | `/projects/:id/versions/:vid/restore` | 整档回滚，先确认 |
| POST | `/projects/:id/publish` | `{ allowCopy? }` 进入公开库 |
| POST | `/projects/:id/unpublish` | 撤下 |
| GET | `/library` | 已发布列表 |
| GET | `/library/:id` | 公开阅读 |
| POST | `/library/:id/copy` | 复制到私有项目 |
| GET/POST | `/library/:id/discussions` | 公开讨论 |

## 前端

项目面板：分享、版本。剧本页：节点评论。`/library` 公开库。`/s/:token` 进项目。
