# 后端 API 规范 v3.0 补充文档

**更新日期**: 2025-10-17  
**版本**: 3.0 (单项目单台本架构)  
**基于**: BACKEND_API_SPEC.md v2.0

---

## 🎯 核心架构变更

### 一个项目对应一个台本

**v2.0 架构** (已废弃):
```
Project (1) ──has many──> Scripts (N)
```

**v3.0 架构** (当前):
```
Project (1) ──has one──> Script (1)
                          ├─ form: linear | branching | storyboard
                          ├─ acts: Act[]
                          └─ scenes: Scene[]
```

### 台本三种形式

| 形式 | 枚举值 | 说明 | 前端路由 |
|------|--------|------|---------|
| 台本式 | `linear` | 线性叙事（默认） | `/projects/[id]/scripts` |
| 分支式 | `branching` | 对话树/分支剧情 | `/projects/[id]/scripts/dialogue` |
| 分镜式 | `storyboard` | 好莱坞分镜头脚本 | `/projects/[id]/scripts/hollywood` |

---

## 📋 新增接口 (v3.0)

### 1. 项目台本管理

#### 1.1 获取项目台本

**接口**: `GET /api/projects/{projectId}/script`

**认证**: 必需

**路径参数**:
- `projectId`: string - 项目ID

**响应 200**:
```typescript
{
  id: string;
  projectId: string;
  title: string;
  topic?: string;                    // 主题/关键词
  form: 'linear'|'branching'|'storyboard';
  contentType: 'live'|'film'|'short_drama'|'short_video'|'vlog';
  styles: string[];                  // 复选风格
  goal?: string;                     // 创作目标
  status: 'draft'|'published'|'archived';
  acts: Act[];
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}
```

**错误响应**:
- 404: 项目不存在或尚未创建台本

---

#### 1.2 创建/生成台本

**接口**: `POST /api/projects/{projectId}/script`

**认证**: 必需

**请求头**:
- `Idempotency-Key`: 推荐，防止重复生成

**请求体类型 A - 结构化构建**:
```typescript
{
  source: 'structured';
  form: 'linear'|'branching'|'storyboard';
  contentType: 'live'|'film'|'short_drama'|'short_video'|'vlog';
  styles?: Array<
    'humorous'|'bizarre'|'healing'|'passionate'|'sad'|
    'suspense'|'horror'|'absurd'|'realistic'|'retro'|
    'acg'|'literary'
  >;
  goal?: 'chitchat'|'gaming'|'discussion'|'education'|'commerce'|string;
  keyword?: string;          // 主题关键词
  target?: string;           // 目标方向
  topic?: string;            // 标题
  situation?: string;        // 场景说明
  hot_stuffs?: string;       // 最近时事
}
```

**内容类型说明**:
- `live`: 直播（默认推荐）
- `film`: 电影
- `short_drama`: 短剧
- `short_video`: 短视频
- `vlog`: Vlog

**请求体类型 B - 成段剧本输入**:
```typescript
{
  source: 'raw_text';
  form: 'linear'|'branching'|'storyboard';
  contentType?: 'film'|'short_drama'|'short_video'|'vlog';
  rawText?: string;          // 文本内容
  fileId?: string;           // 或上传文件ID
}
```

**响应 201** (开发环境同步):
```typescript
Script  // 完整台本对象
```

**响应 202** (生产环境异步):
```typescript
{
  taskId: string;
  status: 'queued';
  estimatedSeconds: 30;
}
```

---

#### 1.3 保存台本内容

**接口**: `PATCH /api/projects/{projectId}/script/content`

**认证**: 必需

**请求体**:
```typescript
{
  scenes: Scene[];
  acts?: Act[];
}
```

**响应 200**:
```typescript
Script  // 更新后的台本
```

---

#### 1.4 重新生成场景

**接口**: `POST /api/projects/{projectId}/script/scenes/{sceneId}/regenerate`

**认证**: 必需

**请求体**:
```typescript
{
  actOrder?: number;         // 在哪一幕（决定生成位置）
  script?: Script;           // 当前台本完整内容（背景）
  styles?: string[];         // 风格控制
  goal?: string;             // 创作目标
  promptText?: string;       // 用户自定义指令（可选）
}
```

**响应 200** (开发环境):
```typescript
{
  scene: Scene;              // 重生成的场景
  candidates: Array<{        // 候选内容
    id: string;
    text: string;
    rank: number;
  }>;
}
```

**响应 202** (生产环境):
```typescript
{
  taskId: string;
  status: 'queued';
  estimatedSeconds: 15;
}
```

---

### 2. 灵感推荐 v2（轻重分离）

#### 2.1 轻量获取（进入项目时）

**接口**: `GET /api/inspirations/{projectId}`

**认证**: 必需

**查询参数**:
- `category?`: `quotes`|`topics`|`interactions`|`hotspots`

**响应 200**:
```typescript
{
  data: Inspiration[];
  projectId: string;
}
```

**说明**:
- 返回已存储/缓存的灵感列表
- 用于进入项目时自动加载
- 建议前端缓存5分钟

---

#### 2.2 重上下文推荐（编辑时精准推荐）

**接口**: `POST /api/inspirations/{projectId}/recommend`

**认证**: 必需

**请求体**:
```typescript
{
  script?: Script;           // 完整台本内容
  position?: {               // 当前编辑位置
    actOrder?: number;
    sceneOrder?: number;
    blockOrder?: number;
  };
  category?: 'quotes'|'topics'|'interactions'|'hotspots';
}
```

**响应 200**:
```typescript
{
  data: Inspiration[];
  projectId: string;
  context: {
    hasScript: boolean;
    position?: object;
  };
}
```

**说明**:
- 基于完整台本上下文和当前位置生成精准推荐
- 可指定风格、目标等参数
- 返回相关度更高的灵感

---

### 3. AI 对话（项目维度）

#### 3.1 获取对话历史

**接口**: `GET /api/chat/{projectId}/messages`

**认证**: 必需

**响应 200**:
```typescript
{
  data: ChatMessage[];
  projectId: string;
}
```

---

#### 3.2 发送消息

**接口**: `POST /api/chat/{projectId}/messages`

**认证**: 必需

**请求体**:
```typescript
{
  role: 'user'|'assistant'|'system';
  content: string;
  blocks?: Array<{           // 可附带剧本片段
    label: string;
    text: string;
  }>;
  stream?: boolean;          // 是否流式输出
}
```

**响应 200**:
```typescript
{
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}
```

**响应 (流式)**:
```
text/event-stream
data: {"content": "..."}
data: {"content": "..."}
data: [DONE]
```

---

#### 3.3 重置对话

**接口**: `POST /api/chat/{projectId}/reset`

**认证**: 必需

**响应 200**:
```typescript
{
  projectId: string;
  reset: true;
  message: '对话历史已重置';
}
```

---

### 4. 角色三视图生成

#### 4.1 生成三视图

**接口**: `POST /api/projects/{projectId}/characters/generate-3view`

**认证**: 必需

**请求体**:
```typescript
{
  name?: string;
  description?: string;
  notes?: string;
  script?: Script;
  characterProfile?: Character;
  artStyle?: 'sketch'|'comic';
  referenceImages?: string[];
}
```

**响应 201**:
```typescript
{
  id: string;
  characterName: string;
  assets: {
    front: string;           // 正面图URL
    side: string;            // 侧面图URL
    back: string;            // 背面图URL
  };
  createdAt: string;
}
```

---

#### 4.2 获取角色资产列表

**接口**: `GET /api/projects/{projectId}/characters/assets`

**认证**: 必需

**响应 200**:
```typescript
{
  data: Character3ViewAsset[];
  projectId: string;
}
```

---

### 5. 地点图生成

#### 5.1 生成地点图

**接口**: `POST /api/projects/{projectId}/locations/generate-image`

**认证**: 必需

**请求体**:
```typescript
{
  name?: string;
  description?: string;
  notes?: string;
  script?: Script;
  style?: string;
  referenceImages?: string[];
}
```

**响应 201**:
```typescript
{
  id: string;
  locationName: string;
  assets: {
    image: string;           // 地点图URL
  };
  createdAt: string;
}
```

---

#### 5.2 获取地点资产列表

**接口**: `GET /api/projects/{projectId}/locations/assets`

**认证**: 必需

**响应 200**:
```typescript
{
  data: LocationImageAsset[];
  projectId: string;
}
```

---

### 6. 历史版本管理

#### 6.1 获取版本列表

**接口**: `GET /api/projects/{projectId}/script/versions`

**认证**: 必需

**响应 200**:
```typescript
{
  data: Array<{
    id: string;
    scriptId: string;
    version: number;
    summary: string;
    author?: string;
    createdAt: string;
    // content 不包含在列表中，仅元数据
  }>;
  projectId: string;
  scriptId: string;
}
```

---

#### 6.2 回滚到指定版本

**接口**: `POST /api/projects/{projectId}/script/versions/{versionId}/revert`

**认证**: 必需

**响应 200**:
```typescript
{
  success: true;
  versionId: string;
  script: Script;            // 回滚后的台本
  message: string;
}
```

---

### 7. 角色管理（原"人设"更名）

#### 7.1 获取角色列表

**接口**: `GET /api/characters`

**认证**: 必需

**响应 200**:
```typescript
{
  data: Character[];
}
```

---

#### 7.2 获取角色详情

**接口**: `GET /api/characters/{id}`

**认证**: 必需

**响应 200**:
```typescript
Character
```

---

### 8. 文本润色增强

**接口**: `POST /api/polish`

**认证**: 必需

**请求体**:
```typescript
{
  text: string;              // 待处理文本
  operation?: 'adjust_style'|'simplify'|'expand'|'rewrite';
  styles?: string[];         // 风格列表
  characterId?: string;      // 角色ID（用于一致性）
  instruction?: string;      // 自定义指令（可选）
}
```

**响应 200**:
```typescript
{
  original: string;
  polished: string;
  explanation: string;
}
```

**说明**:
- `adjust_style`: 改变风格（默认）
- `simplify`: 简化内容
- `expand`: 扩写内容
- `rewrite`: 重新生成

---

## ❌ 已删除接口

以下接口的代码已从代码库中完全移除，不再可用：

### GET /api/scripts

**状态**: 已删除  
**迁移**: 使用 `GET /api/projects/{projectId}/script`  
**删除日期**: 2025-01-XX（代码清理）

> **注意**: 此接口的代码已完全移除，不再提供任何响应。所有调用方必须迁移到新接口。

---

### POST /api/scripts

**状态**: 已删除  
**迁移**: 使用 `POST /api/projects/{projectId}/script`  
**删除日期**: 2025-01-XX（代码清理）

> **注意**: 此接口的代码已完全移除，不再提供任何响应。所有调用方必须迁移到新接口。

---

### POST /api/inspirations/refresh

**状态**: 已删除  
**迁移**: 使用 `POST /api/inspirations/{projectId}/recommend`  
**删除日期**: 2025-01-XX（代码清理）

> **注意**: 此接口的代码已完全移除，不再提供任何响应。所有调用方必须迁移到新接口。

---

## 📊 数据模型变更

### Script (v3.0)

```typescript
{
  id: string;
  projectId: string;         // 新增：所属项目
  title: string;
  topic?: string;            // 新增：主题关键词
  form: ScriptForm;          // 新增：台本形式
  contentType: ContentType;  // 新增：内容类型
  styles: ScriptStyle[];     // 新增：复选风格
  goal?: ScriptGoal;         // 新增：创作目标
  status: 'draft'|'published'|'archived';
  acts: Act[];               // 新增：幕结构
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}

type ScriptForm = 'linear' | 'branching' | 'storyboard';

type ContentType = 'film' | 'short_drama' | 'short_video' | 'vlog';

type ScriptStyle = 
  | 'humorous' | 'bizarre' | 'healing' | 'passionate'
  | 'sad' | 'suspense' | 'horror' | 'absurd'
  | 'realistic' | 'retro' | 'acg' | 'literary';

type ScriptGoal = 'chitchat' | 'gaming' | 'discussion' | 'education' | 'commerce' | string;
```

---

### Scene (v3.0)

```typescript
{
  id: string;
  title: string;
  description?: string;      // 新增：场景描述
  isEXT?: boolean;           // 新增：是否室外
  isDay?: boolean;           // 新增：是否日间
  order: number;
  content: Block[];
}
```

---

### Act (新增)

```typescript
{
  id: string;
  name: string;              // 幕名称（如"幕一·开场画面"）
  order: number;
  sceneIds: string[];        // 包含的场景ID列表
}
```

---

### Character (原Persona)

```typescript
{
  id: string;
  name: string;
  styleTags: string[];
  speechFeatures: {
    catchphrases: string[];
    tabooWords: string[];
    sentencePatterns?: string;
  };
}
```

---

### ChatMessage (新增)

```typescript
{
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  blocks?: Array<{
    label: string;
    text: string;
  }>;
  createdAt: string;
}
```

---

### Character3ViewAsset (新增)

```typescript
{
  id: string;
  characterName: string;
  assets: {
    front: string;
    side: string;
    back: string;
  };
  createdAt: string;
}
```

---

### LocationImageAsset (新增)

```typescript
{
  id: string;
  locationName: string;
  assets: {
    image: string;
  };
  createdAt: string;
}
```

---

### ScriptVersion (新增)

```typescript
{
  id: string;
  scriptId: string;
  version: number;
  summary: string;
  author?: string;
  createdAt: string;
  content: Script;           // 完整快照
}
```

---

## 🔄 迁移指南

### 从 v2.0 迁移到 v3.0

#### 1. 台本列表 → 单台本

**v2.0**:
```typescript
GET /api/scripts?projectId=xxx
→ { data: Script[], pagination: {...} }
```

**v3.0**:
```typescript
GET /api/projects/xxx/script
→ Script
```

---

#### 2. 创建台本

**v2.0**:
```typescript
POST /api/scripts
Body: { projectId, title, type, style, parameters }
```

**v3.0**:
```typescript
POST /api/projects/xxx/script
Body: {
  source: 'structured'|'raw_text',
  form: 'linear',
  contentType: 'short_video',
  styles: ['humorous', 'healing'],
  goal: 'education',
  ...
}
```

---

#### 3. 重生成场景

**v2.0**:
```typescript
POST /api/scripts/{scriptId}/regenerate
Body: { sceneId, parameters }
```

**v3.0**:
```typescript
POST /api/projects/{projectId}/script/scenes/{sceneId}/regenerate
Body: {
  script: {...},           // 新增：完整台本上下文
  styles: [...],           // 新增：风格控制
  goal: '...',             // 新增：目标控制
  promptText: '...'        // 新增：用户指令
}
```

---

#### 4. 灵感刷新

**v2.0**:
```typescript
POST /api/inspirations/refresh
Body: { projectId, locale }
```

**v3.0**:
```typescript
POST /api/inspirations/{projectId}/recommend
Body: {
  script: {...},           // 新增：台本上下文
  position: {...},         // 新增：编辑位置
  category: '...'
}
```

---

### 数据迁移

如果已有多台本数据：

1. **选择主台本**: 每个项目选择最新或"主台本"
2. **字段映射**:
   ```typescript
   {
     form: 'linear',                        // 默认线性
     contentType: mapOldType(script.type),  // film/short_video等
     styles: [],                             // 初始为空
     acts: deriveActsFromScenes(scenes),    // 自动分幕
   }
   ```
3. **迁移脚本**: 参考 `ensureConsistency()` 函数实现

---

## 🎯 接口清单总览 (v3.0)

| 模块 | 方法 | 接口路径 | 状态 | 异步 |
|------|------|----------|------|------|
| 项目台本 | GET | /api/projects/{id}/script | ✅ 新增 | - |
| 项目台本 | POST | /api/projects/{id}/script | ✅ 新增 | ✅ |
| 项目台本 | PATCH | /api/projects/{id}/script/content | ✅ 新增 | - |
| 场景重生 | POST | /api/projects/{id}/script/scenes/{sceneId}/regenerate | ✅ 新增 | ✅ |
| 灵感轻量 | GET | /api/inspirations/{projectId} | ✅ 新增 | - |
| 灵感重量 | POST | /api/inspirations/{projectId}/recommend | ✅ 新增 | ✅ |
| AI对话 | GET | /api/chat/{projectId}/messages | ✅ 新增 | - |
| AI对话 | POST | /api/chat/{projectId}/messages | ✅ 新增 | - |
| AI对话 | POST | /api/chat/{projectId}/reset | ✅ 新增 | - |
| 角色三视图 | POST | /api/projects/{id}/characters/generate-3view | ✅ 新增 | ✅ |
| 角色资产 | GET | /api/projects/{id}/characters/assets | ✅ 新增 | - |
| 地点生成 | POST | /api/projects/{id}/locations/generate-image | ✅ 新增 | ✅ |
| 地点资产 | GET | /api/projects/{id}/locations/assets | ✅ 新增 | - |
| 版本历史 | GET | /api/projects/{id}/script/versions | ✅ 新增 | - |
| 版本回滚 | POST | /api/projects/{id}/script/versions/{versionId}/revert | ✅ 新增 | - |
| 角色管理 | GET | /api/characters | ✅ 重命名 | - |
| 角色详情 | GET | /api/characters/{id} | ✅ 重命名 | - |
| 文本润色 | POST | /api/polish | ✅ 扩展 | - |
| ~~台本列表~~ | ~~GET~~ | ~~/api/scripts~~ | ❌ **已删除** | - |
| ~~创建台本~~ | ~~POST~~ | ~~/api/scripts~~ | ❌ **已删除** | - |
| ~~灵感刷新~~ | ~~POST~~ | ~~/api/inspirations/refresh~~ | ❌ **已删除** | - |

**共计**: 19个接口（15个新增/扩展，3个已删除）

---

*文档版本*: 3.0  
*生成时间*: 2025-10-17  
*对应前端项目*: story_agent_front  
*完整规范*: 请参考 BACKEND_API_SPEC.md v2.0 + 本补充文档

