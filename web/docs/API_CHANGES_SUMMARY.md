# API 契约变更总结

**更新日期**: 2025-10-17  
**版本**: v3.0 (单项目单台本架构)

## 核心架构变更

### 1. 一个项目对应一个台本

**变更前**: 每个项目可以有多个台本（`GET /api/scripts` 返回列表）  
**变更后**: 每个项目仅有一个台本，支持三种形式（linear/branching/storyboard）

### 2. 台本三种形式

- `linear`: 台本式（默认，线性叙事）
- `branching`: 分支式（对话树/分支剧情）
- `storyboard`: 分镜式（好莱坞分镜头脚本）

---

## 新增接口

### 项目台本管理

#### GET /api/projects/{projectId}/script
获取项目的唯一台本（不存在返回 404）

**响应 200**:
```json
{
  "id": "script_xxx",
  "projectId": "proj_xxx",
  "title": "台本标题",
  "topic": "主题关键词",
  "form": "linear",
  "contentType": "short_video",
  "styles": ["humorous", "healing"],
  "goal": "education",
  "status": "draft",
  "acts": [...],
  "scenes": [...],
  "createdAt": "2025-10-17T...",
  "updatedAt": "2025-10-17T..."
}
```

#### POST /api/projects/{projectId}/script
创建/生成台本（支持两种输入）

**输入类型 A - 结构化构建**:
```json
{
  "source": "structured",
  "form": "linear",
  "contentType": "short_video",
  "styles": ["humorous", "healing"],
  "goal": "education",
  "keyword": "主题关键词",
  "target": "目标方向",
  "topic": "标题",
  "situation": "场景说明",
  "hot_stuffs": "最近时事"
}
```

**输入类型 B - 成段剧本**:
```json
{
  "source": "raw_text",
  "form": "linear",
  "contentType": "short_video",
  "rawText": "完整剧本文本...",
  "fileId": "file_xxx"
}
```

**响应 201** (开发环境同步) / **202** (生产异步+taskId)

#### PATCH /api/projects/{projectId}/script/content
保存编辑后的台本内容

**请求体**:
```json
{
  "scenes": [...],
  "acts": [...]
}
```

#### POST /api/projects/{projectId}/script/scenes/{sceneId}/regenerate
重新生成指定场景

**请求体**:
```json
{
  "actOrder": 1,
  "script": {...},
  "styles": ["humorous"],
  "goal": "education",
  "promptText": "用户自定义指令（可选）"
}
```

**响应**:
```json
{
  "scene": {...},
  "candidates": [
    { "id": "cand_1", "text": "...", "rank": 1 }
  ]
}
```

---

### 灵感推荐 v2（轻重分离）

#### GET /api/inspirations/{projectId}
轻量接口，返回已存储/缓存的灵感（用于进入项目时自动加载）

**查询参数**: `?category=quotes|topics|interactions|hotspots`

#### POST /api/inspirations/{projectId}/recommend
重上下文精准推荐

**请求体**:
```json
{
  "script": {...},
  "position": {
    "actOrder": 1,
    "sceneOrder": 2,
    "blockOrder": 3
  },
  "category": "quotes"
}
```

---

### AI 对话（项目维度）

#### GET /api/chat/{projectId}/messages
获取项目对话历史

#### POST /api/chat/{projectId}/messages
发送消息（支持附带剧本blocks）

**请求体**:
```json
{
  "role": "user",
  "content": "消息内容",
  "blocks": [
    { "label": "开场暖场", "text": "<p>...</p>" }
  ],
  "stream": false
}
```

#### POST /api/chat/{projectId}/reset
重置对话历史

---

### 角色三视图生成

#### POST /api/projects/{projectId}/characters/generate-3view
生成角色三视图

**请求体**:
```json
{
  "name": "角色名",
  "description": "角色描述",
  "notes": "补充说明",
  "script": {...},
  "characterProfile": {...},
  "artStyle": "sketch",
  "referenceImages": ["url1", "url2"]
}
```

**响应**:
```json
{
  "id": "char3view_xxx",
  "characterName": "角色名",
  "assets": {
    "front": "/path/to/front.png",
    "side": "/path/to/side.png",
    "back": "/path/to/back.png"
  },
  "createdAt": "..."
}
```

#### GET /api/projects/{projectId}/characters/assets
获取已生成的角色资产列表

---

### 地点图生成

#### POST /api/projects/{projectId}/locations/generate-image
生成地点图

#### GET /api/projects/{projectId}/locations/assets
获取已生成的地点资产列表

---

### 历史版本

#### GET /api/projects/{projectId}/script/versions
获取台本历史版本列表

#### POST /api/projects/{projectId}/script/versions/{versionId}/revert
回滚到指定版本

---

### 角色接口（原"人设"更名）

#### GET /api/characters
获取角色列表（原 `/api/personas`）

#### GET /api/characters/{id}
获取角色详情

---

### 文本润色增强

#### POST /api/polish
扩展后的润色接口

**新增操作类型**:
- `adjust_style`: 改变风格（默认）
- `simplify`: 简化
- `expand`: 扩写
- `rewrite`: 重写

**请求体**:
```json
{
  "text": "待处理文本",
  "operation": "rewrite",
  "styles": ["humorous", "healing"],
  "characterId": "char_xxx",
  "instruction": "自定义指令（可选）"
}
```

---

## 已删除接口

以下接口已在代码中完全移除，不再可用：

### GET /api/scripts
**状态**: 已删除  
**迁移**: 使用 `GET /api/projects/{projectId}/script`  
**原因**: 一个项目仅一个台本，不再需要列表接口  
**删除日期**: 2025-01-XX（代码清理）

### POST /api/scripts
**状态**: 已删除  
**迁移**: 使用 `POST /api/projects/{projectId}/script`  
**删除日期**: 2025-01-XX（代码清理）

### POST /api/inspirations/refresh
**状态**: 已删除  
**迁移**: 使用 `POST /api/inspirations/{projectId}/recommend`  
**删除日期**: 2025-01-XX（代码清理）

> **注意**: 这些接口的代码已从代码库中完全移除。如果您的代码中仍在使用这些接口，请立即迁移到新的接口。

---

## 数据模型变更

### Script (新)
```typescript
{
  id: string;
  projectId: string;
  title: string;
  topic?: string;
  form: 'linear' | 'branching' | 'storyboard';
  contentType: 'film' | 'short_drama' | 'short_video' | 'vlog';
  styles: ScriptStyle[];  // 复选
  goal?: ScriptGoal;
  status: 'draft' | 'published' | 'archived';
  acts: Act[];
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}
```

### Scene (新增字段)
```typescript
{
  id: string;
  title: string;
  description?: string;
  isEXT?: boolean;      // 是否室外
  isDay?: boolean;      // 是否日间
  order: number;
  content: Block[];
}
```

### ScriptStyle (枚举扩展)
```typescript
'humorous' | 'bizarre' | 'healing' | 'passionate' | 'sad' | 
'suspense' | 'horror' | 'absurd' | 'realistic' | 'retro' | 
'acg' | 'literary'
```

### ContentType (新)
```typescript
'film' | 'short_drama' | 'short_video' | 'vlog'
```

### ScriptGoal (新)
```typescript
'chitchat' | 'gaming' | 'discussion' | 'education' | 'commerce' | string
```

---

## 前端适配变更

### 修复的 Bug

1. **Bug #11**: `/projects/[id]` 页面文本栏点击跳转
   - **修复**: 侧栏"脚本"链接改为 `/projects/[id]/scripts`

2. **Bug #12**: Scripts 页面 Radio 切换无响应
   - **修复**: AppHeader 的 Tabs 组件绑定路由跳转逻辑

### 路由更新

| 路径 | 对应形式 |
|------|---------|
| `/projects/[id]/scripts` | 台本式 (linear) - 默认 |
| `/projects/[id]/scripts/dialogue` | 分支式 (branching) |
| `/projects/[id]/scripts/hollywood` | 分镜式 (storyboard) |

---

## 迁移指南

### 从旧API迁移（已强制迁移）

以下接口已在代码中删除，必须迁移到新接口：

1. **台本列表 → 单台本** ✅ 已完成迁移
   ```diff
   - GET /api/scripts?projectId=xxx  [已删除]
   + GET /api/projects/xxx/script
   ```

2. **创建台本** ✅ 已完成迁移
   ```diff
   - POST /api/scripts  [已删除]
   + POST /api/projects/xxx/script
   ```

3. **重生成场景** ✅ 已完成迁移
   ```diff
   - POST /api/scripts/{scriptId}/regenerate  [已删除]
   + POST /api/projects/{projectId}/script/scenes/{sceneId}/regenerate
   ```

4. **灵感刷新** ✅ 已完成迁移
   ```diff
   - POST /api/inspirations/refresh  [已删除]
   + POST /api/inspirations/{projectId}/recommend
   ```

> **迁移状态**: 所有旧接口已从代码库中移除，前端已全部迁移到新接口。

### 数据迁移

如果已有多台本数据：
1. 选择每个项目的"主台本"或最新台本
2. 迁移时设置：
   - `form`: `'linear'` (默认)
   - `contentType`: 根据旧 `type` 映射
   - `styles`: `[]` (空数组)

---

## 前端实现状态

### ✅ 已完成的前端功能

#### 核心功能
- ✅ 所有新API路由占位实现（Mock数据）
- ✅ 旧接口代码完全移除（GET/POST /api/scripts, POST /api/inspirations/refresh）
- ✅ 前端已全部迁移到新接口
- ✅ 数据模型更新

#### 新增组件与页面
- ✅ **AI 对话**: `components/chat/AIChatPanel.tsx` - 项目级别的 AI 对话历史
- ✅ **角色三视图管理**: `components/characters/Character3ViewGenerator.tsx` - 三视图生成
- ✅ **地点图管理**: `components/locations/LocationImageGenerator.tsx` - 地点图生成
- ✅ **历史版本管理**: `components/history/ScriptVersionHistory.tsx` - 版本对比和回滚
- ✅ **润色功能增强**: `components/editor/EditorBlock.tsx` - 支持改变风格、简化、扩写、重写

#### 集成更新
- ✅ 脚本编辑器使用新接口
- ✅ 灵感面板轻/重分离实现
- ✅ 场景重生成接口适配
- ✅ 前端两处Bug修复（项目页面导航、脚本模式切换）

#### 代码重构
- ✅ 合并 AgentOS 客户端（`agentos.client.ts` → `agentos-client.ts`）
- ✅ 移除重复代码
- ✅ 统一错误处理
- ✅ 大文件拆分（`useGenerationJobs.tsx`、`storyboard/page.tsx`）
- ✅ 类型安全改进

### ⏳ 待实现
- 后端文档 BACKEND_API_SPEC.md 详细更新
- OpenAPI YAML 规范更新

---

## 技术说明

- **开发环境**: 所有生成类接口返回 201 同步结果（Mock）
- **生产环境**: 应返回 202 + taskId，客户端轮询 `/api/tasks/{taskId}`
- **向后兼容**: 废弃接口保留3个版本周期，返回410或带deprecation标记
- **测试**: 所有新接口已实现Mock，可本地测试路由与数据格式

---

## 后续任务

1. 更新 `docs/BACKEND_API_SPEC.md` 完整规范文档
2. 更新 `specs/001-ai-ai-ai/contracts/openapi.yaml`
3. 更新 `public/openapi.json`
4. 前端UI组件开发（灵感、对话、资产管理等）
5. 集成真实AI服务替换Mock

---

**联系人**: AI Agent  
**文档维护**: /docs/API_CHANGES_SUMMARY.md

