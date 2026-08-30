# 第一期共享契约

所有 agent 必须按本文件实现。字段名、路径、枚举值改一个都会把并行轨道打崩。

---

## 枚举

```ts
type ProjectType = 'script' | 'cinema' | 'spoken'
type ScreenplayFormat = 'hollywood' | 'asian'
type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
type NodeType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'comment'
  | 'subtitle'
type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled'
type AssetKind = 'portrait' | 'location' | 'prop' | 'storyboard' | 'poster'
```

---

## 节点与封面

```ts
interface ScreenplayNode {
  id: string
  type: NodeType
  text: string
}

interface Cover {
  title: string
  author: string
  contact: string
  draftDate: string
}

interface ScreenplayDoc {
  id: string
  episodeId: string
  title: string
  format: ScreenplayFormat
  cover: Cover
  nodes: ScreenplayNode[]
  updatedAt: string
}
```

`text` 是纯文本，禁止 HTML。场次标题建议写成 `INT. 咖啡馆 - DAY` 或 `内景 咖啡馆 - 日`。

---

## 推导规则

`derive.service.ts` 在每次成功 PUT nodes 后同步执行：

1. `scene_heading`：去掉 `INT./EXT./内景/外景` 与时间后缀，剩下的地点名 trim 后 upsert `Location`（`@@unique([projectId, name])`）。
2. `character`：整行 trim、去 `（V.O.）` / `(CONT'D)` 等修饰，upsert `Character`（`@@unique([projectId, name])`）。
3. 已有记录只保证存在，不覆盖用户后来写的 `description` / `images`。
4. 第一期不自动删实体（避免误删）。

---

## HTTP（前端 `/api/...`，后端 `/api/v1/...`）

会话 Cookie 名：`dramo_session`。CORS 必须 `credentials: true`，不能再 `origin: '*'`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/register` | `{ email, name, password }` → `{ user }` + Set-Cookie |
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/logout` | 清 Cookie |
| GET | `/auth/me` | `{ user }` |
| GET | `/projects` | 分页列表，含 `type` |
| POST | `/projects` | `{ name, type?, format? }` 默认 `script` + `hollywood` |
| GET | `/projects/:id` | 含 `episodes[]`、`members[]` |
| PATCH | `/projects/:id` | `{ name, format }` |
| GET | `/projects/:id/episodes/:episodeId/screenplay` | `ScreenplayDoc` |
| PUT | `/projects/:id/episodes/:episodeId/screenplay` | `{ title?, cover?, nodes }` → 存盘 + 推导 + 自动版本 |
| GET | `/projects/:id/episodes/:episodeId/screenplay/versions` | 版本列表 |
| POST | `/projects/:id/episodes/:episodeId/screenplay/versions/:vid/revert` | 整份回滚 |
| POST | `/projects/:id/episodes/:episodeId/screenplay/revise` | `{ instruction, scope: { type: 'selection'\|'scene', nodeIds: string[] } }` |
| GET | `/projects/:id/characters` | 推导出的角色 |
| PATCH | `/projects/:id/characters/:characterId` | `{ description }` |
| GET | `/projects/:id/locations` | 推导出的地点 |
| PATCH | `/projects/:id/locations/:locationId` | `{ description }` |
| POST | `/images/generations` | `{ projectId, kind: 'portrait'\|'location', entityId, prompt, aspectRatio? }` |
| GET | `/jobs` `/jobs/:id` | GenerationTask |
| GET | `/jobs/stream` | SSE |

未登录除 `/auth/*` 与 `/health` 外一律 401。

---

## 修订 API 语义

- `nodeIds` 为空 → 400。
- 模型只返回这些 id 的替换节点（可增删范围内的行，但不得改范围外 id）。
- 服务端把补丁打进原 `nodes` 数组后存盘、推导。
- Viewer 不可调用。

---

## SD_WORKERS

```bash
SD_WORKERS=[{"id":"sd-1","baseUrl":"http://127.0.0.1:7860","weight":1,"capabilities":["txt2img","img2img"]},{"id":"sd-2","baseUrl":"http://127.0.0.1:7861","weight":1,"capabilities":["txt2img"]}]
```

协议：Automatic1111 `POST {baseUrl}/sdapi/v1/txt2img`，body `{ prompt, width, height, steps }`。探活 `GET {baseUrl}/sdapi/v1/sd-models`。无 worker 或全挂时任务 `failed`，错误信息可读。禁止回退 Seedream。

---

## 前端路由

| URL | 维度 |
|-----|------|
| `/login` `/register` | 账号 |
| `/projects/:id` `/projects/:id/screenplay` | 正文 |
| `/projects/:id/cover` | 封面 |
| `/projects/:id/characters` | 角色 |
| `/projects/:id/locations` | 地点 |
| `/projects/:id/spoken` | 口播（更多） |

删除：`/scripts/hollywood`、`/scripts/dialogue`、`/scripts/script`。

---

## 共享类型文件

两端各一份，字段必须相同：

- `web/lib/types/screenplay.ts`
- `server/src/types/screenplay.ts`
