# 第四期共享契约

范围：Cinema 与 Script 分离。Reel 五阶段、项目级美术/画幅、15 秒成片、Cinema 助手。静帧走 SD 池，成片走独立视频编码器，不得用 SD 连帧冒充成片。

## 项目

`Project.type = cinema`。创建时写入 `cinemaSettings`，不建 `Screenplay`。

```ts
interface CinemaSettings {
  aspectRatio: '16:9' | '9:16' | '2.39:1' | '4:3'
  productionKind: string
  cameraStyle: string
  artStyle: string
}
```

默认：`16:9` / `短片` / 空摄影 / 空美术。

## Reel

挂在 `Episode` 上，不复用 Script 的 `Scene` / `Shot`。

```ts
type ReelStage = 'scene' | 'performance' | 'text_storyboard' | 'storyboard_images' | 'film'

interface ReelShot { id: string; description: string; camera: string }
interface ReelImage { shotId: string; url: string; taskId?: string }
interface ReelFilmRecord { id: string; url: string; durationSec: 15; createdAt: string }
```

阶段由数据推导，不存库：有成片 → `film`；有分镜图 → `storyboard_images`；有文字镜头 → `text_storyboard`；表演合法 → `performance`；否则 `scene`。

## 表演

`@角色` `#道具` 引号对白（`"..."` / `"..."` / `「...」` / `『...』`）。合法表演：trim 后长度 ≥ 2，且至少有一个 `@角色` 或一句引号对白。保存表演后 upsert Character / Prop，不覆盖 description / images。

## 前置

| 动作 | 拒绝文案 |
|------|----------|
| 出文字分镜 | `没有表演不能出文字分镜` |
| 出分镜图 | `没有镜头不能出分镜图` |
| 出成片 | `没有分镜图不能出成片` |
| 非制片项目调 Cinema API | `这不是制片项目` |
| 无视频编码器 | `没有可用的视频编码器` |
| 无 SD worker（静帧） | `没有可用的 Stable Diffusion worker` |

成片固定 15 秒，可多次生成（多版本）。下一 Reel 可把上一 Reel `lastFrameUrl` 作开场锚点。Cinema 不导入 FDX。助手只改当前 Reel 的场景 / 表演 / 文字镜头。

## HTTP

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:id/episodes/:eid/reels` | `{ reels }` |
| POST | `/projects/:id/episodes/:eid/reels` | `{ name?, previousReelId? }` |
| GET | `/projects/:id/reels/:rid` | 单条 Reel（含 films、stage） |
| PATCH | `/projects/:id/reels/:rid` | `{ name?, sceneText?, performance?, shots?, previousReelId? }` |
| POST | `/projects/:id/reels/:rid/storyboard` | 由场景+表演生成文字分镜 |
| POST | `/projects/:id/reels/:rid/images` | 分镜图，走 SD 池 |
| POST | `/projects/:id/reels/:rid/films` | 15 秒成片，走视频编码器 |
| POST | `/projects/:id/reels/:rid/assist` | `{ target: scene\|performance\|shots, instruction }` |
| PATCH | `/projects/:id` | 可附 `cinemaSettings` |

## 前端

新建默认两张卡片：剧本项目、制片项目（Cinema）。口播弱化。Cinema 轨：Reels、角色、道具、任务。落地 `/reels`。Cinema 对话框不出现 FDX。
