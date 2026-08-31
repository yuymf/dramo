# 第三期共享契约

范围：场景、镜头、分镜三视图、FDX 导入导出、资产空间。镜头设计字段与出图分开。

## 推导

每次保存 nodes 后，场次标题 upsert `Scene`（`@@unique([episodeId, heading])`）。标题从正文消失时，挂在该场上的镜头标 `stale=true`，不删。

## HTTP

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:id/episodes/:eid/scenes` | 推导出的场 |
| GET/PUT | `/projects/:id/episodes/:eid/shots` | `{ shots: [{ id?, sceneHeading, description, camera, design }] }` 超过 6 条拒绝 |
| GET | `/projects/:id/episodes/:eid/export/fdx` | `{ filename, xml }` |
| POST | `/projects/import-fdx` | `{ xml, name? }` 始终新建 Script 项目 |
| GET | `/projects/:id/assets` | `{ assets, tasks }` |

## 前端

轨：分镜、资产。分镜页三视图：面板 / 表格 / 画布。导出菜单加 FDX。项目列表可导入 FDX。
