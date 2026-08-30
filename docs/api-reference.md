# API 接口参考

> 完整的后端 API 端点列表。**无认证** —— 所有请求自动关联 `default-local-user`。

后端实际挂载在 `/api/v1/*`。浏览器走 `/api/*`，生产由 nginx 改写，本地由 Next.js catch-all 转发。

## 统一错误信封

所有错误返回统一格式：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "用户友好消息",
    "retryable": true
  },
  "requestId": "uuid"
}
```

---

## 项目 (`/api/projects/`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表（分页）|
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/:id` | 获取项目详情 |
| PUT/PATCH | `/api/projects/:id` | 更新项目 |
| DELETE | `/api/projects/:id` | 删除项目 |

## 台本 (`/api/projects/:projectId/script`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/:pid/script` | 获取台本 |
| POST | `/api/projects/:pid/script` | 生成台本（同步调用 AgentOS）|
| PATCH | `/api/projects/:pid/script/content` | 更新 scenes/acts |
| POST | `/api/projects/:pid/script/scenes/:sceneId/regenerate` | 重新生成单个场景 |
| GET | `/api/projects/:pid/script/versions` | 版本历史 |
| POST | `/api/projects/:pid/script/versions/:vid/revert` | 回退版本 |

## 角色 (`/api/projects/:projectId/characters/`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `.../characters/extract/stream` | 角色提取（SSE 流）|
| POST | `.../characters/extract` | 角色提取（JSON）|
| POST | `.../characters/generate-3view` | 生成角色三视图 |
| GET | `.../characters/assets` | 角色资产列表 |
| POST | `.../characters/assets` | 创建角色资产 |
| PUT | `.../characters/assets/:assetId` | 更新角色资产 |
| DELETE | `.../characters/assets/:assetId` | 删除角色资产 |

## 角色关系 (`/api/projects/:projectId/characters/relations`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `.../relations` | 获取关系图 |
| POST | `.../relations` | 创建关系边 |
| PUT | `.../relations/:relationId` | 更新关系边 |
| DELETE | `.../relations/:relationId` | 删除关系边 |
| POST | `.../relations/cleanup` | 自动清理孤立边 |

## 场景 (`/api/projects/:projectId/locations/`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `.../locations/extract/stream` | 场景提取（SSE 流）|
| POST | `.../locations/extract` | 场景提取（JSON）|
| POST | `.../locations/generate-image` | 生成场景图片 |
| GET | `.../locations/assets` | 场景资产列表 |
| POST | `.../locations/assets` | 创建场景资产 |
| PUT | `.../locations/assets/:assetId` | 更新场景资产 |
| DELETE | `.../locations/assets/:assetId` | 删除场景资产 |

## 分镜 (`/api/projects/:projectId/storyboard`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `.../storyboard/import/stream` | 导入分镜（SSE 流）|
| POST | `.../storyboard/import` | 导入分镜（后台任务，返回 taskId）|
| GET | `.../storyboard-data` | 获取持久化分镜 |
| POST | `.../storyboard-data` | 保存分镜帧 |
| GET | `.../storyboard-data/frames/:frameId` | 获取帧详情 |
| PATCH | `.../storyboard-data/frames/:frameId` | 更新帧数据 |

## 润色 (`/api/projects/:projectId/polish`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `.../polish/stream` | 台本润色（SSE 流）|
| POST | `.../polish` | 台本润色（JSON）|

## 对话 (`/api/chat/:projectId/`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/chat/:pid/messages` | 获取历史消息 |
| POST | `/api/chat/:pid/messages` | 发送消息（支持 SSE 流）|
| POST | `/api/chat/:pid/reset` | 清空对话 |
| GET | `/api/chat/:pid/sessions` | 列出会话 |
| POST | `/api/chat/:pid/sessions` | 创建新会话 |
| GET/PUT/DELETE | `/api/chat/:pid/sessions/:sessionId` | 单会话操作 |

## 图片生成与任务 (`/api/images/`, `/api/jobs/`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/images/generations` | 创建图片生成任务 |
| GET | `/api/jobs` | 任务列表 |
| GET | `/api/jobs/stream` | 任务更新流（SSE，55s 超时 + 自动重连）|
| GET | `/api/jobs/:jobId` | 任务状态 |
| POST | `/api/jobs/:jobId/cancel` | 取消任务 |
| POST | `/api/jobs/:jobId/retry` | 重试任务 |

## LLM 配置 (`/api/llm-configs`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/llm-configs` | 列出用户配置 |
| POST | `/api/llm-configs` | 创建配置（API Key AES-256-GCM 加密存储）|
| PUT | `/api/llm-configs/:id` | 更新配置 |
| DELETE | `/api/llm-configs/:id` | 删除配置 |
| POST | `/api/llm-configs/:id/set-default` | 设为默认 |
| POST | `/api/llm-configs/verify` | 验证配置可达性 |

## AI 供应商 (`/api/ai/`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai/providers` | 可用供应商列表（OpenAI、Hunyuan）|
| GET | `/api/ai/provider` | 当前活跃供应商 |

## 灵感 (`/api/inspirations/`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/inspirations` | 全部灵感 |
| GET | `/api/inspirations/:projectId` | 项目灵感 |
| POST | `/api/inspirations/:projectId/recommend` | AI 推荐灵感 |
| POST | `/api/inspirations/favorite` | 收藏 |
| DELETE | `/api/inspirations/favorites` | 取消收藏 |

## 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/tasks/:taskId` | 异步任务状态查询 |
| POST | `/api/projects/:pid/uploads/image` | 图片上传（返回 url + path）|
