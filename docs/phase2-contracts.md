# 第二期共享契约

范围：大纲、Beats、道具、世界观、选角/勘景备注。剧本节点模型不变。

## 推导

正文任意节点里的 `#道具名`（1–32 字，遇空白或中英文标点结束）upsert `Prop`。已有 description / holder / continuity / images 不覆盖。不自动删。

## HTTP（前端 `/api/...`，后端 `/api/v1/...`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PUT | `/projects/:id/episodes/:eid/outline` | `{ markdown }` |
| GET/PUT | `/projects/:id/episodes/:eid/beats` | `{ beats: [{ id?, action, intent, outcome }] }` 整表按数组顺序重排 |
| GET | `/projects/:id/episodes/:eid/beats/coverage` | `{ beats: [{ id, covered, action, intent, outcome }] }` |
| GET | `/projects/:id/props` | 推导出的道具 |
| PATCH | `/projects/:id/props/:propId` | `{ description?, holder?, continuity? }` |
| GET/PUT | `/projects/:id/worldview` | `{ rules: [{ key, value }] }`，用户手写；空 key 丢弃 |
| PATCH | `/projects/:id/characters/:id` | 可附 `castingNotes` |
| PATCH | `/projects/:id/locations/:id` | 可附 `storyPlace`、`shootPlace` |

Viewer 只读。PUT 空 beats 数组表示清空。

## 覆盖规则

把该集 `nodes[].text` 拼成一份纯文本。beat 的 action / intent / outcome 里任意一段 trim 后长度 ≥ 2 且作为子串出现，则 `covered=true`。

## 前端路由

`/outline` `/beats` `/props` `/worldview` `/knowledge` `/advisors` `/cold-start`。世界观、知识、顾问、冷启动放在「更多」。

## 知识 / 顾问 / 冷启动 / 医生 / 微续写

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:id/knowledge` | `{ data: KnowledgeFile[] }` |
| POST | `/projects/:id/knowledge` | `{ name, filename, text, mime? }` 存纯文本 |
| DELETE | `/projects/:id/knowledge/:fileId` | 删除一条 |
| GET | `/advisors` | 内置方法论目录 |
| GET/PUT | `/projects/:id/advisor` | `{ id }`，`id=null` 解聘；项目至多一个 |
| GET/PUT | `/projects/:id/episodes/:eid/cold-start` | 五关进度与答案 |
| GET | `/projects/:id/episodes/:eid/doctor` | 只诊断不改稿 |
| POST | `/projects/:id/episodes/:eid/micro-continue` | `{ afterNodeId }` → `{ suggestion }` 约 50–100 字，采纳才进文档 |

顾问目录：`three-act` / `save-the-cat` / `story-circle`。知识只存文本，TXT/MD 直接读入，PDF/DOCX 粘贴正文。AI 未获本轮授权不得写世界观。
