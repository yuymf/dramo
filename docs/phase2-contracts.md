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

`/outline` `/beats` `/props` `/worldview`。世界观放在「更多」。
