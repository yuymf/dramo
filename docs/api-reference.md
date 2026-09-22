# API 接口参考

后端挂在 `/api/v1/*`。浏览器走 `/api/*`（生产 nginx 改写，本地 Next.js catch-all）。

除 `/auth/*` 与 `/health` 外需要 cookie `dramo_session`。未登录 401 `UNAUTHORIZED`。实现：`server/src/middleware/session.ts`。

16 个模块：`server/src/app.ts`。

## 错误信封

```json
{
  "error": { "code": "ERROR_CODE", "message": "用户友好消息", "retryable": true },
  "requestId": "uuid"
}
```

---

## 健康 (`health.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 探活（公开） |
| GET | `/api/health/deep` | 含 AgentOS |

## 账号 (`auth.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | `{ email, name, password }` → 201 + Set-Cookie |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | 删 session |
| GET | `/api/auth/me` | 当前用户 |

## 项目 (`projects.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 分页列表 |
| POST | `/api/projects` | `{ name, description?, type?, format?, cinemaSettings? }` |
| GET | `/api/projects/:id` | 详情 |
| PATCH | `/api/projects/:id` | `{ name, format, cinemaSettings }` |
| DELETE | `/api/projects/:id` | 204 |

## 剧本 (`screenplay.ts`)

前缀：`/api/projects/:projectId/episodes/:episodeId/screenplay`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `.../screenplay` | 正文 |
| PUT | `.../screenplay` | 存盘 |
| GET | `.../screenplay/versions` | 版本 |
| POST | `.../screenplay/versions/:vid/revert` | 回滚 |
| POST | `.../screenplay/revise` | `{ instruction, scope }` → ReviseWorkflow |

## 角色 / 地点 (`entities.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/:projectId/characters` | 角色 |
| PATCH | `/api/projects/:projectId/characters/:characterId` | 更新 |
| GET | `/api/projects/:projectId/locations` | 地点 |
| PATCH | `/api/projects/:projectId/locations/:locationId` | 更新 |

## 规划 (`planning.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PUT | `/api/projects/:pid/episodes/:eid/outline` | 大纲 |
| GET/PUT | `.../beats` | Beats |
| GET | `.../beats/coverage` | 覆盖 |
| GET | `/api/projects/:pid/props` | 道具 |
| PATCH | `/api/projects/:pid/props/:propId` | 更新道具 |
| GET/PUT | `/api/projects/:pid/worldview` | 世界观 |

## 辅助 (`assist.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/advisors` | 顾问目录 |
| GET/POST | `/api/projects/:pid/knowledge` | 知识库 |
| DELETE | `/api/projects/:pid/knowledge/:fileId` | 删文件 |
| GET/PUT | `/api/projects/:pid/advisor` | 项目顾问 |
| GET/PUT | `/api/projects/:pid/episodes/:eid/cold-start` | 冷启动 |
| GET | `.../doctor` | 剧本医生 |
| POST | `.../micro-continue` | 微续写 |

## 前期 (`preproduction.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `.../episodes/:eid/scenes` | 场次 |
| GET/PUT | `.../episodes/:eid/shots` | 镜头 |
| GET | `.../episodes/:eid/export/fdx` | 导出 FDX |
| POST | `/api/projects/import-fdx` | 导入 FDX |
| GET | `/api/projects/:pid/assets` | 资产 |

## Cinema (`cinema.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `.../episodes/:eid/reels` | Reel 列表 / 创建 |
| GET/PATCH | `/api/projects/:pid/reels/:reelId` | 单个 Reel |
| POST | `.../reels/:reelId/storyboard` | 分镜 |
| POST | `.../reels/:reelId/images` | 出图 |
| POST | `.../reels/:reelId/films` | 成片 |
| POST | `.../reels/:reelId/assist` | 辅助 |

## 协作 (`collab.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/share/:token` | 解析分享（仍需登录） |
| GET/PATCH | `/api/projects/:pid/share` | 分享设置 |
| GET/POST | `/api/projects/:pid/members` | 成员 |
| GET/POST | `/api/projects/:pid/comments` | 评论 |
| GET/POST | `/api/projects/:pid/versions` | 项目快照 |
| POST | `/api/projects/:pid/versions/:versionId/restore` | 恢复 |
| POST | `/api/projects/:pid/publish` `/unpublish` | 公开库 |
| GET | `/api/library` `/library/:projectId` | 公开库 |
| POST | `/api/library/:projectId/copy` | 拷贝 |
| GET/POST | `/api/library/:projectId/discussions` | 讨论 |

## 对话 (`chat.ts`, `chat-sessions.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/chat/:pid/messages` | 消息（POST 可 SSE） |
| POST | `/api/chat/:pid/reset` | 清空 |
| GET/POST | `/api/chat/:pid/sessions` | 会话 |
| PATCH/DELETE | `/api/chat/:pid/sessions/:sessionId` | 单会话 |

## 出图 (`generation-tasks.ts`)

`GenerationTask` + SD 池。肖像/场景与 Cinema 分镜共用 `TaskRunnerService.runTxt2Img`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/images/generations` | `{ projectId, kind: portrait\|location, entityId, prompt, aspectRatio? }`，返回任务行（`id`） |
| GET | `/api/tasks` | 任务列表 `{ tasks, total }` |
| GET | `/api/tasks/stream` | SSE |
| GET | `/api/tasks/:id` | 状态 |
| POST | `/api/tasks/:id/cancel` | 取消 |
| POST | `/api/tasks/:id/retry` | 重试 |

## LLM 配置 (`llm-config.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/llm-configs` | 列表 / 创建（Key AES-256-GCM） |
| PUT/DELETE | `/api/llm-configs/:id` | 更新 / 删除 |
| POST | `/api/llm-configs/:id/set-default` | 默认 |
| POST | `/api/llm-configs/verify` | 探活 |

## 文件

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects/:pid/uploads/image` | 上传 |
| GET | `/api/files/projects/:pid/:filename` | 读文件 |
