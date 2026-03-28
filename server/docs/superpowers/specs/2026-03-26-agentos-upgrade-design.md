# AgentOS 全面升级设计文档

**日期**: 2026-03-26
**范围**: agentos Python 层全部 + TS 层资产注入 + 3 个新 service/routes
**目标**: 对标 waoowaoo 完整 AI 短剧生产链路，全面提升分镜质量并建立完整 Workflow 体系

---

## 背景

当前 agentos 有 4 个 Workflow（Storyboard / Characters / Locations / Polish），分镜采用单 Agent 3步 Map-Reduce 架构，仅有 3 个提示词文件。通过对 waoowaoo 仓库的深度分析，发现以下关键差距：

1. 缺少 screenplay 结构化中间层（文本理解与镜头设计耦合）
2. 分镜单阶段生成，无摄影包 + 表演指导专项 Agent
3. 提示词缺乏 JSON 安全约束、可视化强制规则、镜头密度量化等工程规范
4. 缺少 VoiceAnalysis / ShotVariant / TransitionPanel 等扩展能力
5. 角色/场景资产库未注入分镜生成流程

---

## 核心决策

- **资产数据流**: TS 层持久化，agentos 无状态。资产随每次 workflow 调用作为参数传入，agentos 不维护数据库。
- **ScreenplayWorkflow**: 作为 StoryboardWorkflow 内部第一步（Phase 0），不暴露为独立 endpoint，TS 层调用方式不变。
- **向后兼容**: 所有现有接口格式保持不变，新字段全部 optional / additive。
- **新 Workflow 调用层**: VoiceAnalysis / ShotVariant / TransitionPanel 同步写好 TS service + routes。

---

## 整体架构

### 新增 Workflow 全景

```
现有（保留/升级）                新增
────────────────────────────    ────────────────────────────────
StoryboardWorkflow (重构)        CharacterVisualWorkflow
CharactersWorkflow (升级)        VoiceAnalysisWorkflow
LocationsWorkflow  (升级)        ShotVariantWorkflow
PolishWorkflow     (不变)        TransitionPanelWorkflow
```

ScreenplayWorkflow 内嵌于 StoryboardWorkflow Phase 0，不独立注册。

### 核心业务流程

```
用户上传剧本文本
      │
      ▼
[1] StoryboardWorkflow（含 Phase 0: screenplay 结构化）
    Phase 0: screenplay_conversion  文本 → 结构化 clips JSON
    Phase 1: plan_panels            clips → panels 草稿（per clip 并发）
    Phase 2a: cinematographer       摄影包（与 2b 并行）
    Phase 2b: acting_direction      表演指导（与 2a 并行）
    Phase 3: detail_refiner         整合 → 最终 Shot[]
      │
      ├── [可选] VoiceAnalysisWorkflow   对话提取 + 情绪强度
      ├── [可选] ShotVariantWorkflow     单镜头变体生成
      └── [可选] TransitionPanelWorkflow 过渡面板插入

[并行/独立]
[2] CharactersWorkflow（升级 schema）
    → 输出 role_level / visual_keywords / aliases / costume_tier

[3] LocationsWorkflow（升级 schema）
    → 输出 atmosphere / suggested_props / era_context

[4] CharacterVisualWorkflow（新增）
    输入: characters_lib
    → 每角色每外观 3 variants 视觉描述
```

### 资产数据流

```
TS 层（Prisma DB 持久化）              agentos（无状态计算）
         │                                      │
         │  characters_lib (CharacterImageAsset) │
         │  locations_lib  (LocationImageAssetV2)│
         │─────────────────────────────────────►│
         │                                      │  每次调用时注入
         │◄─────────── 返回结构化输出 ───────────│
         │  存入 DB / 返回前端                   │
```

---

## 一、StoryboardWorkflow 重构（4 阶段）

### 输入

```typescript
{
  projectId: string
  text: string                        // 剧本原文（必填）
  characters_lib?: Array<{            // 来自 CharacterImageAsset（可选）
    name: string
    description?: string
    alias?: string
  }>
  locations_lib?: Array<{             // 来自 LocationImageAssetV2（可选）
    name: string
    description?: string
    alias?: string
  }>
  _llm_config: object                 // 用户 LLM 配置（必填，现有机制）
}
```

`characters_lib` / `locations_lib` 为空时工作流正常运行，不影响现有无资产用户。

### 4 阶段执行

```
Phase 0: validate_and_prepare
  - 验证 LLM config
  - screenplay_conversion：文本 → clips[]
  - 构建 assets_context（characters_lib + locations_lib）

Phase 1: plan_panels（per clip，ThreadPoolExecutor 并发）
  输入: clip_json + assets_context
  输出: panels[] 草稿
    字段: panel_number, description, shot_type, camera_move,
          source_text（原文锚点 ≥5字符）, scene_type,
          characters[], location

Phase 2: enrich_panels（per clip，2a + 2b 并行提交同一 executor）
  2a: cinematographer
    输出 per panel: composition, lighting, color_palette, atmosphere
  2b: acting_direction
    输出 per panel per character:
      emotional_state, facial_expression, body_language, gaze_direction

Phase 3: detail_refiner（per clip）
  整合 Phase1 + 2a + 2b → 最终 Shot[]
  映射到现有字段 + 新增字段
```

### 输出（向后兼容）

```json
{
  "projectId": "...",
  "scenes": [
    {
      "id": "scene-001",
      "title": "场景标题",
      "summary": "场景摘要",
      "shots": [
        {
          "shot_number": "001",
          "shot_size": "近景",
          "duration_seconds": 3,
          "scene_description": "...",
          "director_notes": "...",
          "audio_description": "...",
          "camera_angle": "平视",
          "camera_movement": "固定",
          "focal_length": "85mm",
          "characters": ["李明"],
          "locations": ["办公室"],
          "dialogues": [{"speaker": "李明", "text": "...", "type": "dialogue"}],
          "prompts": {
            "textToImage": "...",
            "textToVideo": "..."
          },
          "scene_type": "emotion",
          "source_text": "李明转过身",
          "cinematography": {
            "composition": "三分法则，主体右侧",
            "lighting": "侧逆光",
            "color_palette": "冷蓝色调",
            "atmosphere": "压抑对峙"
          },
          "acting_direction": [
            {
              "character": "李明",
              "emotional_state": "愤怒压制中",
              "facial_expression": "眉头紧锁，嘴唇紧抿",
              "body_language": "双臂交叉胸前",
              "gaze_direction": "直视对方"
            }
          ]
        }
      ]
    }
  ]
}
```

所有新字段（`scene_type`, `source_text`, `cinematography`, `acting_direction`）均为 optional，前端现有代码不受影响。

---

## 二、CharactersWorkflow 升级

### 新增输出字段

```json
{
  "characters": [...],
  "new_characters": [
    {
      "name": "李明",
      "aliases": ["李总", "老李"],
      "role": "protagonist",
      "role_level": "S",
      "archetype": "hero",
      "description": "...",
      "personality_traits": ["冷静", "果断"],
      "visual_keywords": ["西装", "眼镜"],
      "costume_tier": 3,
      "age_range": "30-35",
      "gender": "male",
      "relationships": [{"character": "王芳", "relationship": "colleague"}],
      "appearances": [
        {"id": "app-001", "description": "第一幕正装"}
      ]
    }
  ],
  "updated_characters": []
}
```

**差量输出**：`characters`（已有无变化）/ `new_characters`（新发现）/ `updated_characters`（需更新）三分，TS 层按需合并，避免全量覆盖。

---

## 三、LocationsWorkflow 升级

### 新增输出字段

每个 location 新增：
- `atmosphere`：氛围描述（可视化，禁止情绪词）
- `suggested_props`：常见道具列表
- `era_context`：时代背景
- `lighting_default`：默认光线条件

---

## 四、CharacterVisualWorkflow（新增）

**职责**：为每个角色每个外观生成纯视觉描述，专供图像生成使用。

**硬性约束（提示词层面强制）**：
- 禁止：表情、动作、背景、情节叙述
- 禁止：肤色、眼色、唇色（跨模型生成一致性）
- 每个外观必须输出 3 个备选描述

**输入**：`characters_lib`（CharactersWorkflow 输出）
**输出**：
```json
{
  "characters": [
    {
      "name": "李明",
      "appearances": [
        {
          "id": "app-001",
          "descriptions": ["描述A（服饰角度）", "描述B（整体轮廓）", "描述C（细节特征）"]
        }
      ]
    }
  ]
}
```

---

## 五、VoiceAnalysisWorkflow（新增）

**职责**：从分镜 Shot[] 中提取对话，对齐面板，估算情绪强度，供 TTS 使用。

**输入**：`panels: Shot[]`
**输出**：
```json
[
  {
    "line_index": 1,
    "speaker": "李明",
    "content": "台词文本",
    "emotion_strength": 0.3,
    "matched_panel": "001"
  }
]
```

**约束**：
- `emotion_strength` 严格限定 0.1–0.5
- 仅提取口语对白，排除纯旁白/动作/场景描述
- 面板匹配：顺序 + 说话者 + 语义三维对齐

---

## 六、ShotVariantWorkflow（新增）

**职责**：为单个镜头生成多个变体方案，供用户选择。

**输入**：`panel: Shot`, `variant_count?: number`（默认 3）
**输出**：
```json
{
  "variants": [
    {
      "id": "variant-001",
      "title": "正面对峙版",
      "description": "...",
      "shot_type": "近景",
      "camera_move": "固定",
      "video_prompt": "...",
      "creative_score": 8
    }
  ]
}
```

**约束**：至少 3 个变体，每个变体差异化明显（镜头类型/角度/运动三者至少一项不同）。

---

## 七、TransitionPanelWorkflow（新增）

**职责**：在两个相邻镜头之间插入过渡面板，增强叙事连贯性。

**输入**：`prev_panel: Shot`, `next_panel: Shot`, `user_hint?: string`
**输出**：恰好 1 个完整 Shot 对象（与现有 FrameData 完全兼容）

---

## 八、提示词工程规范

### 目录结构

```
agentos/prompts/
├── storyboard/
│   ├── plan_panels.md
│   ├── cinematographer.md
│   ├── acting_direction.md
│   └── detail_refiner.md
├── screenplay/
│   └── screenplay_conversion.md
├── characters/
│   ├── characters_system.md    (升级)
│   └── character_visual.md     (新增)
├── locations/
│   └── locations_system.md     (升级)
├── voice/
│   └── voice_analysis.md       (新增)
├── shot_variant/
│   └── shot_variant.md         (新增)
├── transition/
│   └── transition_panel.md     (新增)
└── (storyboard_system.md 等保留，标记 deprecated)
```

### 全局强制规范（所有输出 JSON 的提示词必须包含）

**1. JSON 安全约束**
```
⚠️ JSON 安全：文本值中的所有引号（""''）必须转换为「」，
绝不在 JSON 字符串值内使用原始 ASCII 双引号。
```

**2. 可视化约束**
```
❌ 禁止主观情绪词："气氛尴尬"、"显得悲伤"、"感觉紧张"
✅ 只描述可观察的视觉元素："眉头紧锁"、"嘴角下垂"、"攥紧拳头"
```

**3. 角色名称约束**
```
❌ 禁止身份替代："母亲"、"老师"、"男主"
✅ 必须使用 characters_lib 中的具体角色名
```

**4. 镜头密度量化（plan_panels 专用）**
```
目标比例：每 15 个汉字 ≈ 1 个镜头
对话场景：每句台词至少 1 个独立镜头（说话者近景/特写）
```

**5. video_prompt 独立字段规范**
```
scene_description：静态画面构图（供图像生成）
video_prompt：运动流程描述，50-150字（供视频生成）
两者内容分离，不重复
```

**6. source_text 必填规范（plan_panels 专用）**
```
每个 panel 的 source_text 必须是原文的精确摘录（≥5字符）
用于前端追溯和 debug，不允许为空或改写
```

---

## 九、TS 层改动

### storyboard.service.ts 修改

```typescript
// 调 AgentOS 前注入资产
const [characters, locations] = await Promise.all([
  assetService.getCharacterAssets(projectId),
  assetService.getLocationAssets(projectId),
])

const agentInput = {
  projectId,
  text,
  characters_lib: characters.map(c => ({
    name: c.characterName,
    description: c.description ?? undefined,
    alias: c.alias ?? undefined,
  })),
  locations_lib: locations.map(l => ({
    name: l.locationName,
    description: l.description ?? undefined,
    alias: l.alias ?? undefined,
  })),
}
```

### 新增 service 接口

```typescript
// voice-analysis.service.ts
interface VoiceAnalysisRequest { panels: Shot[] }
interface VoiceAnalysisResult {
  lines: Array<{
    line_index: number; speaker: string; content: string
    emotion_strength: number; matched_panel: string
  }>
}

// shot-variant.service.ts
interface ShotVariantRequest { panel: Shot; variant_count?: number }
interface ShotVariantResult {
  variants: Array<{
    id: string; title: string; description: string
    shot_type: string; camera_move: string
    video_prompt: string; creative_score: number
  }>
}

// transition-panel.service.ts
interface TransitionPanelRequest {
  prev_panel: Shot; next_panel: Shot; user_hint?: string
}
interface TransitionPanelResult { panel: Shot }
```

### 新增路由

```typescript
// 挂载在现有 auth middleware 下
POST /api/projects/:projectId/voice-analysis
POST /api/projects/:projectId/shot-variant
POST /api/projects/:projectId/transition-panel
```

### agentos-client.ts 新增函数

```typescript
runVoiceAnalysis(panels, llmHeaders) → Promise<VoiceAnalysisResult>
runShotVariant(panel, variantCount, llmHeaders) → Promise<ShotVariantResult>
runTransitionPanel(prevPanel, nextPanel, userHint, llmHeaders) → Promise<TransitionPanelResult>
```

全部走同步 JSON 模式（非 SSE），响应体小，不需要流式。

---

## 十、测试策略

### Python 层

```
agentos/tests/
├── test_screenplay_workflow.py
├── test_storyboard_workflow_v2.py   (4阶段)
├── test_character_visual.py
├── test_voice_analysis.py
├── test_shot_variant.py
├── test_transition_panel.py
└── fixtures/
    ├── sample_script.txt
    ├── sample_characters_lib.json
    └── expected_outputs/
```

每个 Workflow 覆盖：正常路径 JSON schema 验证、JSON 容错（markdown 块/原始引号）、空资产库不崩溃、并发安全。

### 提示词 Guard 脚本

```
agentos/tools/
├── prompt_json_guard.py    检查所有提示词含 JSON 安全约束
└── prompt_field_guard.py   检查关键字段名未被误删
```

### TS 层

```
src/services/__tests__/
├── storyboard.service.test.ts    资产注入逻辑
├── voice-analysis.service.test.ts
├── shot-variant.service.test.ts
└── transition-panel.service.test.ts
```

---

## 十一、向后兼容保障

| 风险点 | 保障措施 |
|--------|---------|
| TS 层调用 StoryboardWorkflow 接口不变 | 输入仍接受 `{projectId, text}`，`characters_lib` 为可选 |
| 前端 FrameData 新字段处理 | 新字段全部 optional，前端忽略不崩溃 |
| `scenes[].shots[]` 结构不变 | detail_refiner 输出严格映射到原有字段 |
| AgentOS endpoint 名称不变 | `storyboardworkflow` 路径保持，内部重构透明 |
| CharactersWorkflow 输出结构 | 原有字段保留，差量字段新增 |

---

## 十二、迁移计划

### Phase 0 — 准备（1-2天）
- 建立 `agentos/tests/fixtures/` 测试数据集
- 实现 prompt guard 脚本
- 收集现有 JSON 解析失败案例清单

### Phase 1 — 核心升级（5-7天）⭐ 优先
1. `ScreenplayWorkflow`（内嵌）+ 提示词（2天）
2. `StoryboardWorkflow` 4阶段重构 + 4个提示词文件（3天）
3. `CharactersWorkflow` / `LocationsWorkflow` schema 升级（1天）
4. `storyboard.service.ts` 资产注入（0.5天）

**Phase 1 验收标准**：
- 同一剧本片段，新分镜 `source_text` 字段覆盖率 100%
- `scene_type` 非空率 100%
- `video_prompt` 与 `textToImage` 内容分离
- 对话角色均有对应独立镜头

### Phase 2 — 扩展 Workflow（3-4天）
1. `CharacterVisualWorkflow`（1天）
2. `VoiceAnalysisWorkflow`（1天）
3. `ShotVariantWorkflow` + `TransitionPanelWorkflow`（1天）
4. TS 层 3 个新 service + routes（1天）

### Phase 3 — 收尾（1-2天）
- 旧提示词文件归档（标记 deprecated，保留 fallback）
- P95 延迟性能测试（4阶段 vs 原 3步）
- 更新 CLAUDE.md agentos 架构描述

**总估时**：10-15 个工作日
