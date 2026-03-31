# Dramo 对话驱动重构设计

## 概述

将 Dramo 从"表单输入 + 独立编辑"模式重构为"对话驱动 + 渐进生成"模式。右侧对话面板成为唯一交互入口（台本版 Claude Code），左侧保留现有 tab 编辑器作为内容展示和编辑区域。

## 核心决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 整体架构 | 对话驱动型（方案 A） | 对话是唯一入口，用户心智模型最简单 |
| 需求澄清 | 创意 Brainstorming 式 | 非模板问答，AI 动态生成选项，像创意顾问 |
| 选项卡片 | 至少 3 个 + 自由输入 | 参考 Superpowers brainstorming 模式 |
| 生成流程 | 自动管线式 | 台本→角色→场景→分镜，自动推进，用户可打断 |
| 左侧展示 | 保持 tab 切换 | 复用现有编辑器，生成时自动切换到对应 tab |
| 打断机制 | 停止按钮 + 对话继续 | 保留已生成内容，用户可在对话中调整后继续 |
| 对话面板位置 | 可调整固定面板 | 默认固定右侧，可拖拽调宽度，可收起 |
| 管线编排 | 前端编排 | 复用已有 API，用户可打断/编辑/恢复，更灵活 |

---

## 1. 页面架构

### 1.1 Home 页改造

现有 `CreativeInput` 组件保持不变，仅修改提交后行为：

```
用户输入创意文本 → createProject() → sessionStorage 存 initialMessage
→ 跳转 /projects/{id}
→ 项目页加载后，ChatPanel 自动读取 initialMessage
→ 进入需求澄清流程
```

### 1.2 项目页三栏布局

**现有**：左侧 sidebar + 中间 @content + 右侧 AIChatDrawer（抽屉覆盖式）

**改为**：左侧 sidebar + 中间 @content + 右侧固定 ChatPanel（可拖拽调宽/收起）

```
┌─────────┬──────────────────┬─────────────────┐
│ Sidebar │    @content      │   ChatPanel     │
│  200px  │    flex: 1       │   可拖拽宽度     │
│  固定    │                  │   320-600px     │
│         │                  │   可收起到 0     │
└─────────┴──────────────────┴─────────────────┘
```

- 移除 `input` 路由和 sidebar 菜单项
- 移除 `AIChatDrawer`（抽屉覆盖式），改为布局级的固定右侧面板
- 分割线可拖拽，ChatPanel 最小宽度 320px，可收起

### 1.3 ChatPanel 内部结构

```
┌──────────────────────┐
│ 📋 任务列表    [▼折叠] │
│ ✅ 需求澄清           │
│ ✅ 台本生成           │
│ 🔄 角色提取  ← 当前   │
│ ○  场景提取           │
│ ○  分镜生成           │
├──────────────────────┤
│                      │
│  对话消息流           │
│                      │
├──────────────────────┤
│ [  输入框  ]  [停止]  │
└──────────────────────┘
```

**任务列表行为**：
- 管线启动时自动创建（澄清→台本→角色→场景→分镜）
- 每个任务有状态：`pending ○` → `in_progress 🔄` → `completed ✅` → `paused ⏸` → `skipped ⏭`
- 用户打断改细节时，当前任务暂停但列表始终可见
- 点击已完成任务可触发重新生成
- 点击任务项自动跳转左侧对应 tab
- 默认展开，用户可折叠

---

## 2. 需求澄清（创意 Brainstorming）

### 2.1 核心理念

不是"把表单拆成聊天"，而是**创意顾问式对话**。Agent 理解用户的创意意图，主动提出有见地的方向建议，帮用户想清楚要做什么。

### 2.2 对话模式示例

```
用户输入: "一只住在月球上的猫，每天对着地球思考人类的故事"

Agent: "这个概念有趣。一只月球上的猫+人类观察，
可以在不同情绪基调下展开——"

 ┌─────────────────────────────────────────┐
 │ 🌙 哲思治愈                              │
 │ 猫是安静的观察者，用温柔视角解读人类的喜怒  │
 │ 哀乐，每集像一封写给地球的信，适合深夜场景   │
 └─────────────────────────────────────────┘
 ┌─────────────────────────────────────────┐
 │ 😂 荒诞喜剧                              │
 │ 猫用严肃科学态度分析人类行为，得出完全离谱的 │
 │ 结论，核心是一本正经地胡说八道的反差感       │
 └─────────────────────────────────────────┘
 ┌─────────────────────────────────────────┐
 │ 💔 温暖悬念                              │
 │ 猫在等一个不会回来的人，但每集结尾都有一个小 │
 │ 线索暗示主人可能还活着，观众会追着看         │
 └─────────────────────────────────────────┘
 ┌─────────────────────────────────────────┐
 │ ✏️ 我有别的想法...                        │
 └─────────────────────────────────────────┘

用户: 选了"荒诞喜剧" + 补充"但结尾要有一点温暖"

Agent: "好，荒诞外壳+温暖内核——
前面都在搞笑，最后10秒猫说一句真心话，
观众笑着笑着突然被戳到。这种反转效果很强。

那受众和平台方向呢？这会影响节奏和时长——"

 ┌──────────────────────────────────────────┐
 │ 📱 抖音/快手短视频                        │
 │ 60秒以内，开头3秒要有钩子，节奏快，         │
 │ 适合碎片消费，需要强视觉和字幕              │
 └──────────────────────────────────────────┘
 ┌──────────────────────────────────────────┐
 │ 🅱️ B站中视频                             │
 │ 3-5分钟，可以铺垫更多，观众耐心更好，       │
 │ 适合有深度的内容，弹幕互动是加分项          │
 └──────────────────────────────────────────┘
 ┌──────────────────────────────────────────┐
 │ 🎬 视频号/小红书                          │
 │ 1-3分钟，偏生活化和情感向，                 │
 │ 适合治愈类内容，分享驱动传播                │
 └──────────────────────────────────────────┘
 ┌──────────────────────────────────────────┐
 │ ✏️ 我有别的想法...                        │
 └──────────────────────────────────────────┘

...多轮讨论...

Agent: "方向明确了：
  📝 月球猫系列 | 治愈+搞笑短视频
  🎯 每集1分钟，铺垫→误解→反转
  🐱 猫有正式学术腔的内心独白
  🌙 核心卖点：反差萌 + 孤独治愈

还有什么想补充的？"

 ┌──────────────────┐ ┌──────────────────┐
 │ 🚀 开始生成       │ │ ✋ 我还想聊聊     │
 └──────────────────┘ └──────────────────┘
 ┌──────────────────────────────────────────┐
 │ ✏️ 我有别的想法...                        │
 └──────────────────────────────────────────┘
```

### 2.3 卡片选项规范

**数据结构**：

```typescript
interface OptionCard {
  id: string
  label: string         // 短标题 2-4 字
  icon: string          // emoji
  description: string   // 1-2 句，说清核心特点和适用场景
}

interface ChatMessageOptions {
  multiSelect: boolean
  items: OptionCard[]         // 至少 3 个，AI 动态生成
  customInput: true           // 始终允许，渲染为"我有别的想法..."
  skipAction?: {              // 可选快捷操作
    label: string
    icon: string
  }
}
```

**AI 生成选项的规则**（写入 ClarificationWorkflow 的 system prompt）：

| 规则 | 说明 |
|---|---|
| 至少 3 个选项 | 每次提供方向建议时，不少于 3 个差异化选项 |
| 每个选项有 label + description | label 简短，description 说清选了意味着什么 |
| 选项之间差异化 | 不是微调差异，而是真正不同的方向 |
| 推荐项在对话文本中说明理由 | 不在卡片上标"推荐" |
| 始终有自由输入 | 最后一张卡"我有别的想法..." |
| 不是每轮都需要卡片 | 追问细节或回应修改时，纯文字即可 |
| 智能跳过 | 用户输入已包含足够信息时，跳过已知步骤 |

**卡片交互规则**：
- 单选：点击即选中并自动发送
- 多选：点击选中/取消，有"确认"按钮提交
- 已回答的卡片变灰色，显示选择结果，不可再改
- 用户直接在输入框打字发送，等同于自由输入回答当前问题

### 2.4 后端 ClarificationWorkflow

```
输入: 对话历史 + 用户初始输入
输出:
  - 对话回复（含可选的卡片选项）
  - 或 StructuredRequirements（当 agent 判断需求已明确时）

Agent 职责:
1. 理解创意方向，提出有见地的建议
2. 在合适的时机提供选项卡片（辅助，非必须）
3. 主动指出模糊点或潜在问题
4. 判断何时需求足够明确，提议开始生成
5. 将自由讨论结果映射为 StructuredRequirements
```

**StructuredRequirements**（复用现有 ProStructuredForm 字段，管线可直接使用）：

```typescript
interface StructuredRequirements {
  contentType: 'live' | 'film' | 'short_drama' | 'short_video' | 'vlog'
  styles: string[]
  goal: string
  keyword: string
  topic?: string
  situation?: string
  hotStuffs?: string
  extraRequirements?: string
}
```

---

## 3. 自动管线与渐进展示

### 3.1 管线流程

```
需求澄清完成
    ↓
任务列表激活：
  ✅ 需求澄清
  🔄 台本生成    ← 开始
  ○  角色提取
  ○  场景提取
  ○  分镜生成
    ↓
对话: Agent: "方向明确了，我开始生成第一版台本——"
左侧自动切换到 [台本] tab
    ↓
SSE 流式推送，左侧台本编辑器逐场景渲染
    ↓
台本完成 → 对话: Agent: "台本初稿完成，开始提取角色——"
左侧自动切换到 [角色] tab
    ↓
角色逐个渐入
    ↓
... 场景提取 → 分镜生成 ...
    ↓
全部完成
  Agent: "全部生成完毕！你可以在左侧各 tab 查看和编辑。
  有什么需要调整的随时告诉我。"
```

### 3.2 前端管线编排器

管线由前端控制，逐步调用已有 API 端点：

```typescript
class PipelineController {
  private steps = ['script', 'characters', 'locations', 'storyboard']
  private currentStep = 0
  private aborted = false

  async run(requirements: StructuredRequirements) {
    for (const step of this.steps) {
      if (this.aborted) break

      updateTaskStatus(step, 'in_progress')
      switchLeftTab(step)

      await executeStep(step, {
        requirements,
        previousResults,
        onChunk: (chunk) => {
          renderIncremental(step, chunk)
        }
      })

      updateTaskStatus(step, 'completed')
    }
  }

  abort() {
    this.aborted = true
    abortCurrentSSE()
  }

  resumeFrom(step: string) {
    this.aborted = false
    this.currentStep = this.steps.indexOf(step)
    this.run(...)
  }
}
```

**前端编排的理由**：
- 用户打断/恢复需要即时响应
- 每步之间用户可能修改内容，前端能拿到最新编辑结果传给下一步
- 复用已有独立 API 端点，后端无需新增编排逻辑
- 单步失败不影响其他步骤

### 3.3 渐进展示策略

**台本 tab**：
- 标题先出现
- Block 文字逐行流入（打字效果）
- Scene 逐个淡入，自动滚动跟随

**角色 tab**：
- 角色卡片逐个 scale-in 出现
- 卡片内：名字先出，描述流入，标签逐个弹出
- 关系图在所有角色完成后渲染

**场景 tab**：
- 场景卡片逐个出现
- 名称 + 类型标签先出，描述文字流入
- 图片占位符（后续手动触发生成）

**分镜 tab**：
- Frame 卡片逐个出现
- 镜号 + 景别标签先出
- 场景描述、对白、导演备注依次流入
- 图片占位符

### 3.4 SSE 事件协议

```typescript
type PipelineEvent =
  | { type: 'task_start',    step: string }
  | { type: 'task_complete', step: string }
  | { type: 'chunk',         step: string, data: any }
  | { type: 'tab_switch',    tab: string }
  | { type: 'pipeline_done' }
  | { type: 'pipeline_error', step: string, error: string }

// chunk.data 按 step 不同：
// script:     { sceneId, blockId, text_delta }
// characters: { characterId, field, value }
// locations:  { locationId, field, value }
// storyboard: { frameId, field, value }
```

### 3.5 打断与恢复

```
用户点击 [停止生成]
    ↓
PipelineController.abort()
  ├── 中断当前 SSE
  ├── 任务列表：当前步骤标记为 ⏸ 暂停
  └── 对话: Agent: "已停止。当前台本已生成3/5个场景。
            你可以先编辑已有内容，然后告诉我继续。"
    ↓
用户编辑左侧内容 / 在对话中提修改意见
    ↓
用户: "角色名字改一下，然后继续"
    ↓
Agent: 应用修改 → 恢复管线
  ├── 修改影响后续步骤 → agent 判断是否需要重新生成
  └── 小改 → 直接继续
```

### 3.6 管线运行中的对话交互

管线运行期间，用户可以在对话中随时提需求：

```
[管线运行中，台本生成到 Scene 3]

用户: "第二个场景的开场太长了，压缩一下"
    ↓
Agent: 暂停管线 → 调用 PolishWorkflow 修改 Scene 2
     → "已精简。继续生成剩余场景。"
     → 恢复管线

用户: "整体风格再搞笑一点"
    ↓
Agent: "好的。已生成的部分需要一起改吗？"

 ┌────────────────────┐ ┌────────────────────┐
 │ 🔄 全部重新生成      │ │ ➡️ 只调整后续部分   │
 └────────────────────┘ └────────────────────┘
 ┌────────────────────────────────────────────┐
 │ ✏️ 我有别的想法...                          │
 └────────────────────────────────────────────┘
```

---

## 4. 技术改动清单

### 4.1 前端文件改动

**删除**：

| 文件 | 理由 |
|---|---|
| `web/app/projects/[id]/@content/input/page.tsx` | 移除 input 路由 |
| `web/components/input/ProStructuredForm.tsx` | 不再需要表单式输入 |
| `web/components/input/DramaTextInput.tsx` | 同上 |
| `web/components/input/BaseChatInput.tsx` | 同上 |
| `web/components/projects/AIChatDrawer.tsx` | 替换为固定面板 |
| `web/components/projects/AIChatTriggerButton.tsx` | 不再需要触发按钮 |

**重构**：

| 文件 | 改动 |
|---|---|
| `web/app/projects/[id]/layout.tsx` | 三栏布局，嵌入 ChatPanel + ResizableHandle |
| `web/components/chat/AIChatPanel.tsx` | 适配新消息类型、管线状态 |
| `web/components/sidebar/ProjectSidebar.tsx` | 移除 input 菜单项 |
| `web/components/home/CreativeInput.tsx` | 提交后跳转行为微调 |

**新建**：

| 文件 | 说明 |
|---|---|
| `web/components/chat/ChatPanel.tsx` | 面板主容器（任务列表 + 消息流 + 输入框） |
| `web/components/chat/TaskList.tsx` | 可折叠管线任务进度列表 |
| `web/components/chat/OptionCards.tsx` | 选项卡片组件（≥3 选项 + 自由输入） |
| `web/components/chat/MessageRenderer.tsx` | 消息渲染器（文字/卡片/进度） |
| `web/components/chat/ProgressMessage.tsx` | 生成进度消息（带动画） |
| `web/components/chat/StopButton.tsx` | 停止生成按钮 |
| `web/lib/pipeline-controller.ts` | 前端管线编排器 |
| `web/lib/stores/pipeline-store.ts` | 管线状态 Zustand store |

### 4.2 状态管理

新增 pipeline store：

```typescript
interface PipelineStore {
  tasks: Array<{
    id: string
    step: 'clarification' | 'script' | 'characters' | 'locations' | 'storyboard'
    label: string
    status: 'pending' | 'in_progress' | 'completed' | 'paused' | 'skipped'
  }>
  pipelineStatus: 'idle' | 'clarifying' | 'running' | 'paused' | 'done'
  currentStep: string | null
  abortController: AbortController | null

  startPipeline: (requirements: StructuredRequirements) => void
  pausePipeline: () => void
  resumePipeline: (fromStep?: string) => void
  updateTaskStatus: (step: string, status: TaskStatus) => void
  switchTab: (tab: string) => void
}
```

现有 `useAIChat` context 继续管理对话消息。`usePipeline` store 管理管线状态。ChatPanel 协调两者。

### 4.3 后端改动

**AgentOS 新增**：

| 文件 | 说明 |
|---|---|
| `agentos/workflows/clarification_workflow.py` | 创意 brainstorming agent |
| `agentos/prompts/clarification/system.md` | 澄清 agent 的 system prompt |

**Hono Server 修改**：

| 文件 | 改动 |
|---|---|
| `server/src/routes/chat.ts` | 支持新消息类型（options、clarificationComplete） |
| `server/src/services/chat.service.ts` | 路由澄清消息到 ClarificationWorkflow |

### 4.4 数据库改动

```prisma
// ChatMessage 表新增字段
model ChatMessage {
  // ... 现有字段
  messageType    String?    // 'text' | 'options' | 'progress'
  options        Json?      // 选项卡片数据
  selectedOption Json?      // 用户选择结果
}

// 新增 PipelineRun 表
model PipelineRun {
  id            String   @id @default(cuid())
  projectId     String
  status        String   // 'running' | 'completed' | 'paused' | 'failed'
  requirements  Json     // StructuredRequirements
  currentStep   String?
  stepResults   Json?    // 每步完成状态和结果引用
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  project       Project  @relation(fields: [projectId], references: [id])
}
```

### 4.5 消息类型定义

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string                           // AI 对话文本（始终有）
  messageType?: 'text' | 'options' | 'progress'
  options?: {                               // AI 觉得需要时才附带
    multiSelect: boolean
    items: Array<{
      id: string
      label: string
      icon?: string
      description?: string
    }>
    customInput: true
    skipAction?: {
      label: string
      icon: string
    }
  }
  clarificationComplete?: StructuredRequirements  // 澄清完成时附带
}
```

### 4.6 不改动的部分

以下保持原样，管线直接复用：
- 所有 AgentOS workflows（script、characters、locations、storyboard、polish）
- 左侧各 tab 编辑器组件（TipTap 编辑器、角色卡片、分镜卡片等）
- 图片生成流程
- 认证/授权
- 版本历史
- 导出功能

---

## 5. 数据流

### 5.1 完整流程

```
Home CreativeInput
    ↓ createProject + sessionStorage
Projects/[id] 页面加载
    ↓ 读取 initialMessage
ChatPanel 启动对话
    ↓ POST /api/chat/{id}/messages (clarification mode)
    ↓ ← Agent 回复 + 选项卡片
    ↓ 多轮 brainstorming
    ↓ ← clarificationComplete: StructuredRequirements
    ↓
PipelineController.run(requirements)
    ↓
Step 1: POST /api/projects/{id}/script (SSE)
    ├── 任务列表: 台本 🔄
    ├── 左侧切换: [台本] tab
    ├── SSE chunks → 逐场景渐进渲染
    └── 完成 → 任务列表: 台本 ✅
    ↓
Step 2: POST /api/projects/{id}/characters/extract (SSE)
    ├── 任务列表: 角色 🔄
    ├── 左侧切换: [角色] tab
    ├── SSE chunks → 逐角色渐进渲染
    └── 完成 → 任务列表: 角色 ✅
    ↓
Step 3: POST /api/projects/{id}/locations/extract (SSE)
    ├── 同上模式
    ↓
Step 4: POST /api/projects/{id}/storyboard/generate (SSE)
    ├── 同上模式
    ↓
Pipeline done → Agent: "全部完成！有什么需要调整的告诉我。"
```

### 5.2 打断流程

```
用户点击 [停止] 或在对话中提修改意见
    ↓
PipelineController.abort()
    ↓
保留已生成内容 → 用户编辑/对话调整
    ↓
用户确认继续 → PipelineController.resumeFrom(step)
    ↓
Agent 判断是否需要重跑之前步骤 → 继续或重新生成
```

---

## 6. 边界情况与错误处理

### 6.1 网络/生成失败

- 单步 SSE 连接断开：自动重试 1 次，仍失败则任务标记为 `failed`，对话中提示用户可手动重试
- AgentOS 超时（55s）：同上处理，保留已接收的部分内容
- 对话面板显示具体错误信息，提供"重试"按钮

### 6.2 页面刷新/重新进入

- `PipelineRun` 表记录管线状态，页面重载后读取恢复
- 管线 `running` 状态但 SSE 已断：标记为 `paused`，对话提示用户选择继续或重新开始
- 已生成内容已持久化到数据库（各 workflow 完成时存储），不会丢失

### 6.3 并发编辑

- 管线运行中用户编辑左侧内容：不自动暂停管线（之前讨论确认为停止按钮模式）
- 当前步骤完成后，下一步自动使用数据库最新数据（含用户编辑）
- 如果用户编辑的是当前正在生成的内容（如正在生成 Scene 3 时编辑 Scene 2），SSE 完成后以数据库版本为准，用户编辑不会被覆盖（乐观锁：比较 updatedAt）

### 6.4 空项目进入

- 用户直接访问 `/projects/{id}` 但没有 initialMessage：对话面板显示欢迎消息 + 输入提示
- Agent: "你好！描述你想创建的台本，或者上传一个剧本文件，我来帮你完善。"

### 6.5 已有内容的项目

- 用户重新打开已完成管线的项目：任务列表显示全部 ✅，对话显示历史记录
- 用户可以在对话中继续修改：Agent 根据上下文判断是局部修改还是需要重跑某步
