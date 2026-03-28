# AgentOS 升级 Phase 1：核心工作流重构

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 StoryboardWorkflow 重构为 4 阶段并行架构，引入 screenplay 中间层，升级 Characters/Locations schema，并让 TS 层在调用分镜时注入资产库。

**Architecture:** StoryboardWorkflow 内嵌 screenplay_conversion 作为 Phase 0，Phase 1 plan_panels + Phase 2(cinematographer‖acting_direction 并行) + Phase 3 detail_refiner per-clip 流水线。资产库由 TS 层从 DB 查出后作为 `characters_lib`/`locations_lib` 参数传入，agentos 保持无状态。

**Tech Stack:** Python 3.11+, agno framework (Workflow/Agent/Step), pydantic, concurrent.futures.ThreadPoolExecutor; TypeScript/Hono, Prisma, existing `startWorkflowRun`/`postAgentOS` helpers.

---

## 文件地图

### 新建文件

| 文件 | 职责 |
|------|------|
| `agentos/prompts/screenplay/screenplay_conversion.md` | screenplay 结构化提示词 |
| `agentos/prompts/storyboard/plan_panels.md` | Phase 1 镜头规划提示词 |
| `agentos/prompts/storyboard/cinematographer.md` | Phase 2a 摄影包提示词 |
| `agentos/prompts/storyboard/acting_direction.md` | Phase 2b 表演指导提示词 |
| `agentos/prompts/storyboard/detail_refiner.md` | Phase 3 整合提示词 |
| `agentos/prompts/characters/characters_system.md` | 升级版角色提取提示词 |
| `agentos/prompts/locations/locations_system.md` | 升级版场景提取提示词 |
| `agentos/lib/json_utils.py` | JSON 修复/容错解析工具 |
| `agentos/tests/fixtures/sample_script.txt` | 测试用剧本片段（短剧风格，约 600 字） |
| `agentos/tests/fixtures/sample_assets.json` | 测试用资产库（3 角色 + 2 场景） |
| `agentos/tests/test_storyboard_v2.py` | StoryboardWorkflow v2 测试 |
| `agentos/tests/test_characters_v2.py` | CharactersWorkflow v2 测试 |
| `agentos/tests/test_locations_v2.py` | LocationsWorkflow v2 测试 |
| `agentos/tools/prompt_json_guard.py` | 检查提示词含 JSON 安全约束 |

### 修改文件

| 文件 | 改动内容 |
|------|---------|
| `agentos/workflows/storyboard_workflow.py` | 完全重写为 4 阶段架构 |
| `agentos/workflows/characters_workflow.py` | 升级输出 schema（新增 role_level 等字段） |
| `agentos/workflows/locations_workflow.py` | 升级输出 schema（新增 atmosphere 等字段） |
| `src/routes/storyboard.ts` | 调 AgentOS 前注入 characters_lib / locations_lib |
| `src/services/asset.service.ts` | 暴露 `getCharacterLibItems` / `getLocationLibItems` helper |

---

## Task 0: 测试夹具 + JSON 工具

**Files:**
- Create: `agentos/tests/fixtures/sample_script.txt`
- Create: `agentos/tests/fixtures/sample_assets.json`
- Create: `agentos/lib/json_utils.py`
- Test: `agentos/tests/test_json_utils.py`

- [ ] **Step 1: 创建测试剧本文件**

创建 `agentos/tests/fixtures/sample_script.txt`，内容为一段约 600 字的短剧脚本：

```
第一幕：咖啡馆相遇

下午三点，阳光透过落地窗斜射进来。

李明坐在角落的位置，笔记本摊开在桌上，手里的咖啡已经凉了。他盯着屏幕，眉头紧锁，手指反复敲击着同一个键。

王芳推开玻璃门走进来，风衣上还带着室外的凉意。她扫了一眼全场，目光在李明身上停了一秒。

王芳：（走近）这位置有人吗？

李明抬起头，看到王芳，愣了一下。

李明：没有，请坐。

王芳放下包，拉开椅子坐下。她掏出手机，开始翻看消息。

沉默持续了两分钟。

李明合上笔记本。

李明：你是做设计的？

王芳放下手机，看向他。

王芳：你怎么知道？

李明：你的包——Pantone 色卡挂件。

王芳低头看了看包，嘴角微微上扬。

王芳：观察力不错。你呢？

李明：程序员。

王芳：（点头）所以才一直盯着屏幕发呆？

李明：（轻笑）我在想一个 bug。

王芳：什么 bug？

李明停顿了一下，把笔记本重新打开，转向王芳。

第二幕：问题的核心

屏幕上是密密麻麻的代码。

王芳：（皱眉）这是什么语言？

李明：Python。这里——（指着屏幕）这个函数应该返回列表，但一直返回空。

王芳俯身看屏幕，距离拉近了一些。

王芳：这里缩进有问题吧？

李明定睛一看，僵住了。

李明：……你懂代码？

王芳：（直起身）学过一点。设计师现在不懂点代码很难混。

李明盯着屏幕，快速改了一行，运行。

终端输出了正确的结果。

李明长舒一口气，转向王芳。

李明：谢谢你。

王芳：（站起来）应该的。我去点咖啡了。

她走向吧台。李明看着她的背影，若有所思。
```

- [ ] **Step 2: 创建资产库夹具**

创建 `agentos/tests/fixtures/sample_assets.json`：

```json
{
  "characters_lib": [
    {
      "name": "李明",
      "description": "程序员，30岁，戴眼镜，穿格子衬衫",
      "alias": "明哥"
    },
    {
      "name": "王芳",
      "description": "设计师，28岁，短发，穿风衣",
      "alias": null
    }
  ],
  "locations_lib": [
    {
      "name": "咖啡馆",
      "description": "现代风格咖啡馆，落地窗，暖色调灯光",
      "alias": null
    }
  ]
}
```

- [ ] **Step 3: 写 json_utils.py 的失败测试**

创建 `agentos/tests/test_json_utils.py`：

```python
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.json_utils import safe_parse_json, strip_markdown_fences

class TestStripMarkdownFences:
    def test_strips_json_fence(self):
        raw = "```json\n[{\"a\": 1}]\n```"
        assert strip_markdown_fences(raw) == '[{"a": 1}]'

    def test_strips_plain_fence(self):
        raw = "```\n[{\"a\": 1}]\n```"
        assert strip_markdown_fences(raw) == '[{"a": 1}]'

    def test_passthrough_clean_json(self):
        raw = '[{"a": 1}]'
        assert strip_markdown_fences(raw) == '[{"a": 1}]'

class TestSafeParseJson:
    def test_parses_clean_list(self):
        result = safe_parse_json('[{"name": "李明"}]', expected_type=list)
        assert result == [{"name": "李明"}]

    def test_parses_after_stripping_fence(self):
        raw = '```json\n[{"name": "李明"}]\n```'
        result = safe_parse_json(raw, expected_type=list)
        assert result == [{"name": "李明"}]

    def test_returns_fallback_on_invalid(self):
        result = safe_parse_json("not json", expected_type=list, fallback=[])
        assert result == []

    def test_wraps_dict_in_list_when_list_expected(self):
        result = safe_parse_json('{"name": "李明"}', expected_type=list)
        assert result == [{"name": "李明"}]

    def test_parses_dict(self):
        result = safe_parse_json('{"scenes": []}', expected_type=dict)
        assert result == {"scenes": []}
```

- [ ] **Step 4: 运行测试，确认失败**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python -m pytest tests/test_json_utils.py -v
```

预期输出：`ModuleNotFoundError: No module named 'lib.json_utils'`

- [ ] **Step 5: 实现 json_utils.py**

创建 `agentos/lib/__init__.py`（空文件）

创建 `agentos/lib/json_utils.py`：

```python
"""
JSON 容错解析工具
处理 LLM 输出的常见格式噪声：markdown 代码块、额外空白、单dict包装等
"""
import json
import re
import logging
from typing import Any, Optional, Type, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar('T')


def strip_markdown_fences(text: str) -> str:
    """移除 LLM 输出中的 markdown 代码块标记"""
    text = text.strip()
    # 匹配 ```json ... ``` 或 ``` ... ```
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return text.strip()


def safe_parse_json(
    text: str,
    expected_type: Type[T] = dict,
    fallback: Optional[Any] = None,
) -> Any:
    """
    容错解析 LLM 输出的 JSON 字符串。

    处理：
    - markdown 代码块包裹
    - 前后多余空白
    - 期望 list 但收到 dict 时自动包装

    Args:
        text: LLM 返回的原始字符串
        expected_type: 期望的顶层类型，list 或 dict
        fallback: 解析失败时的默认值，默认 None

    Returns:
        解析结果，失败时返回 fallback
    """
    if not isinstance(text, str):
        if isinstance(text, expected_type):
            return text
        return fallback

    cleaned = strip_markdown_fences(text)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning(f"[safe_parse_json] JSON parse failed: {e}. Input preview: {cleaned[:200]}")
        if fallback is None and expected_type == list:
            return []
        if fallback is None and expected_type == dict:
            return {}
        return fallback

    # 期望 list 但收到 dict 时自动包装
    if expected_type == list and isinstance(result, dict):
        logger.info("[safe_parse_json] Got dict but expected list, wrapping in list")
        return [result]

    return result
```

- [ ] **Step 6: 运行测试，确认通过**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python -m pytest tests/test_json_utils.py -v
```

预期输出：`5 passed`

- [ ] **Step 7: Commit**

```bash
cd /Users/halyu/Documents/Code/story_agent
git add agentos/lib/__init__.py agentos/lib/json_utils.py \
        agentos/tests/test_json_utils.py \
        agentos/tests/fixtures/sample_script.txt \
        agentos/tests/fixtures/sample_assets.json
git commit -m "feat(agentos): add json_utils and test fixtures for workflow v2"
```

---

## Task 1: 提示词文件 — screenplay_conversion

**Files:**
- Create: `agentos/prompts/screenplay/screenplay_conversion.md`
- Create: `agentos/tools/prompt_json_guard.py`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p /Users/halyu/Documents/Code/story_agent/agentos/prompts/screenplay
mkdir -p /Users/halyu/Documents/Code/story_agent/agentos/prompts/storyboard
mkdir -p /Users/halyu/Documents/Code/story_agent/agentos/prompts/characters
mkdir -p /Users/halyu/Documents/Code/story_agent/agentos/prompts/locations
mkdir -p /Users/halyu/Documents/Code/story_agent/agentos/tools
```

- [ ] **Step 2: 创建 screenplay_conversion.md**

创建 `agentos/prompts/screenplay/screenplay_conversion.md`：

```markdown
你是一位专业剧本结构分析师。你的任务是将剧本原文拆分为结构化的 clip（场景片段）JSON 数组。

## 输入

完整剧本原文（中文），可能包含场景标题、动作描述、对话、旁白。

## 输出格式

严格输出 JSON 数组，每个元素代表一个 clip：

```json
[
  {
    "clip_id": "clip-001",
    "summary": "场景摘要（20-50字，描述核心动作和情绪转变）",
    "location": "地点名称（与剧本一致，无则填「未指定」）",
    "characters": ["出现的角色名1", "角色名2"],
    "content": [
      {"type": "action", "text": "动作/场景描述原文"},
      {"type": "dialogue", "character": "角色名", "text": "台词原文"},
      {"type": "voiceover", "character": "旁白", "text": "旁白原文"}
    ]
  }
]
```

## 切分规则

1. **场景边界**：时间/地点明显变化时切分新 clip
2. **叙事节奏**：同一地点内，情绪基调或主要动作发生重大转变时切分
3. **合理粒度**：每个 clip 建议 100-400 字原文，过短则合并，过长则切分
4. **完整性**：不遗漏任何原文内容，action/dialogue/voiceover 覆盖全部原文

## 角色名规范

- 使用剧本中出现的确切角色名，不使用「主角」「他」等替代
- 如出现「我」等第一人称，根据上下文推断具体角色名

## 质量要求

- summary 必须描述可观察的行动，不使用主观情绪词
  - ❌ 「两人气氛尴尬」
  - ✅ 「李明合上笔记本，王芳站起来走向吧台」
- content 中的 text 保留原文，不改写、不总结

⚠️ JSON 安全：文本值中的所有引号（""''）必须转换为「」，绝不在 JSON 字符串值内使用原始 ASCII 双引号。

只输出 JSON 数组，不添加任何说明文字或 markdown 标记。
```

- [ ] **Step 3: 创建 prompt_json_guard.py**

创建 `agentos/tools/prompt_json_guard.py`：

```python
#!/usr/bin/env python3
"""
检查所有提示词文件是否包含 JSON 安全约束声明。
用于 CI 保障：防止提示词文件被修改后丢失关键约束。
"""
import os
import sys
from pathlib import Path

REQUIRED_PHRASE = "JSON 安全"
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
# 不需要 JSON 输出的提示词可加入豁免列表（文件名相对于 prompts/）
EXEMPT_FILES: set[str] = set()


def check_prompts() -> int:
    """返回违规文件数量"""
    violations = []

    for md_file in PROMPTS_DIR.rglob("*.md"):
        rel = str(md_file.relative_to(PROMPTS_DIR))
        if rel in EXEMPT_FILES:
            continue
        content = md_file.read_text(encoding="utf-8")
        if REQUIRED_PHRASE not in content:
            violations.append(rel)

    if violations:
        print("❌ 以下提示词文件缺少 JSON 安全约束：")
        for v in violations:
            print(f"   prompts/{v}")
        print(f"\n请在文件末尾添加：")
        print("⚠️ JSON 安全：文本值中的所有引号（\"\"''）必须转换为「」，绝不在 JSON 字符串值内使用原始 ASCII 双引号。")
        return len(violations)

    print(f"✅ 所有 {sum(1 for _ in PROMPTS_DIR.rglob('*.md'))} 个提示词文件均包含 JSON 安全约束。")
    return 0


if __name__ == "__main__":
    sys.exit(check_prompts())
```

- [ ] **Step 4: 运行 guard 脚本（预期有违规）**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python tools/prompt_json_guard.py
```

预期：列出旧的 `storyboard_system.md` 等文件（它们没有该约束），这是正常的，后续 Phase 3 清理时处理。新建的 `screenplay_conversion.md` 不应出现在违规列表中。

- [ ] **Step 5: Commit**

```bash
cd /Users/halyu/Documents/Code/story_agent
git add agentos/prompts/screenplay/screenplay_conversion.md \
        agentos/tools/prompt_json_guard.py
git commit -m "feat(agentos): add screenplay_conversion prompt and prompt_json_guard"
```

---

## Task 2: 提示词文件 — 4 个分镜阶段

**Files:**
- Create: `agentos/prompts/storyboard/plan_panels.md`
- Create: `agentos/prompts/storyboard/cinematographer.md`
- Create: `agentos/prompts/storyboard/acting_direction.md`
- Create: `agentos/prompts/storyboard/detail_refiner.md`

- [ ] **Step 1: 创建 plan_panels.md**

创建 `agentos/prompts/storyboard/plan_panels.md`：

```markdown
你是一位专业分镜导演。根据提供的剧本 clip 和资产库，为这个 clip 规划完整的镜头序列草稿。

## 输入变量

- `{clip_json}`：结构化的 clip 数据（含 content 数组）
- `{characters_lib}`：角色资产库 JSON 数组（可能为空）
- `{locations_lib}`：场景资产库 JSON 数组（可能为空）

## 输出格式

输出 JSON 数组，每个元素代表一个面板草稿：

```json
[
  {
    "panel_number": 1,
    "description": "画面描述（可观察的视觉内容，不含情绪词）",
    "shot_type": "远景|中景|近景|特写|大远景",
    "camera_move": "固定|推进|拉远|跟随|摇镜|环绕",
    "source_text": "对应原文的精确摘录（≥5字符）",
    "scene_type": "daily|emotion|action|epic|suspense",
    "characters": ["出现的角色名"],
    "location": "地点名"
  }
]
```

## 镜头规划规则

### 密度规则
- 目标：每 15 个汉字 ≈ 1 个镜头
- 450 字 ≈ 30 个镜头（超出则合并，不足则拆分）

### 对话强制规则
⚠️ 每句台词必须有一个独立镜头，聚焦说话者的近景或特写
- 对话场景使用「镜头-反打镜头」：说话者近景 → 听者反应近景 → 说话者近景
- 说话者镜头必须在 characters 数组中包含该说话者

### 镜头合理性规则
- 特写、反打镜头不需要描述镜头外的角色
- 「李明特写」时，不需要在描述中提及镜头外的王芳在做什么

### 角色名规范
❌ 禁止身份替代：「母亲」「老师」「男主」
✅ 必须使用 characters_lib 中的确切角色名；若角色不在库中，使用剧本中的名字

### 可视化规范
❌ 禁止主观情绪词：「气氛尴尬」「感觉紧张」「显得悲伤」
✅ 只描述可观察的视觉元素：「眉头紧锁」「嘴角下垂」「攥紧拳头」

### source_text 规范
- 必须是原文的精确摘录，≥5 个字符
- 用于追溯该镜头对应剧本位置，不允许改写或总结

## 示例输出（部分）

```json
[
  {
    "panel_number": 1,
    "description": "咖啡馆内景，阳光从落地窗斜射进来，李明坐在角落，笔记本摊开，盯着屏幕",
    "shot_type": "远景",
    "camera_move": "固定",
    "source_text": "李明坐在角落的位置，笔记本摊开在桌上",
    "scene_type": "daily",
    "characters": ["李明"],
    "location": "咖啡馆"
  },
  {
    "panel_number": 2,
    "description": "李明面部，眉头紧锁，手指反复敲击同一个键",
    "shot_type": "特写",
    "camera_move": "固定",
    "source_text": "手里的咖啡已经凉了。他盯着屏幕，眉头紧锁",
    "scene_type": "emotion",
    "characters": ["李明"],
    "location": "咖啡馆"
  }
]
```

⚠️ JSON 安全：文本值中的所有引号（""''）必须转换为「」，绝不在 JSON 字符串值内使用原始 ASCII 双引号。

只输出 JSON 数组，不添加任何说明文字或 markdown 标记。
```

- [ ] **Step 2: 创建 cinematographer.md**

创建 `agentos/prompts/storyboard/cinematographer.md`：

```markdown
你是一位专业摄影指导。根据提供的面板草稿序列，为每个面板生成摄影规则包。

## 输入变量

- `{panels_json}`：面板草稿数组（来自 plan_panels 阶段）
- `{locations_lib}`：场景资产库（含场景描述，可能为空）

## 输出格式

输出 JSON 数组，长度必须与输入 panels_json 完全一致：

```json
[
  {
    "panel_number": 1,
    "composition": "构图描述（如：三分法则，主体在右侧三分之一）",
    "lighting": "光线描述（如：侧逆光，营造轮廓感）",
    "color_palette": "色调描述（如：暖橙色调，高饱和度）",
    "atmosphere": "氛围描述（可观察的视觉感受，不用情绪词）"
  }
]
```

## 摄影规则

### 色调连贯性
- 同一场景内相邻面板保持色调连贯
- 场景切换时可引入色调变化，但需有过渡

### atmosphere 可视化规范
❌ 禁止：「悲伤的氛围」「尴尬的气氛」
✅ 正确：「冷蓝色调，阴影比例高，对比度强」「暖黄灯光，散景柔和，画面松弛」

### scene_type 适配
- daily：自然光，平和构图，标准焦距
- emotion：柔焦或浅景深，强调面部，暖冷色对比
- action：动感构图，稍倾斜，广角强化空间
- epic：宽画幅构图，强光影对比，低机位仰视
- suspense：不对称构图，高对比度，冷色调

### 输出数量
输出面板数量必须等于输入 `{panel_count}` 个，多一个或少一个都是错误。

⚠️ JSON 安全：文本值中的所有引号（""''）必须转换为「」，绝不在 JSON 字符串值内使用原始 ASCII 双引号。

只输出 JSON 数组，不添加任何说明文字或 markdown 标记。
```

- [ ] **Step 3: 创建 acting_direction.md**

创建 `agentos/prompts/storyboard/acting_direction.md`：

```markdown
你是一位资深表演指导。根据提供的面板草稿和角色信息，为每个面板中出现的每个角色生成表演指导。

## 输入变量

- `{panels_json}`：面板草稿数组
- `{characters_lib}`：角色资产库（含角色描述，可能为空）

## 输出格式

输出 JSON 数组，每个元素对应一个面板的所有角色表演指导：

```json
[
  {
    "panel_number": 1,
    "acting": [
      {
        "character": "角色名",
        "emotional_state": "情绪状态（用可观察的词语，如「强作镇定」而非「紧张」）",
        "facial_expression": "面部表情具体描述（如「眉头微蹙，嘴角绷紧」）",
        "body_language": "身体姿态描述（如「双臂交叉胸前，身体微微后仰」）",
        "gaze_direction": "视线方向（如「直视对方，目光锐利」）"
      }
    ]
  }
]
```

## 表演规则

### 可观察性原则
所有描述必须是摄影机可以拍到的内容：
❌「她感到很难过」→ 摄影机拍不到「难过」
✅「她垂下眼睑，嘴角微微下压，手指无意识地摩挲着杯口」

### 仅描述镜头内角色
- 每个面板只为 characters 数组中出现的角色生成表演指导
- 镜头外的角色不需要表演指导

### 输出数量
输出数组长度必须等于输入面板数量，panel_number 必须与输入一一对应。

⚠️ JSON 安全：文本值中的所有引号（""''）必须转换为「」，绝不在 JSON 字符串值内使用原始 ASCII 双引号。

只输出 JSON 数组，不添加任何说明文字或 markdown 标记。
```

- [ ] **Step 4: 创建 detail_refiner.md**

创建 `agentos/prompts/storyboard/detail_refiner.md`：

```markdown
你是一位专业分镜执行导演。将面板草稿、摄影规则和表演指导整合为最终可执行的分镜面板。

## 输入变量

- `{panels_json}`：Phase 1 面板草稿
- `{cinematography_json}`：Phase 2a 摄影规则（与 panels 一一对应）
- `{acting_json}`：Phase 2b 表演指导（与 panels 一一对应）
- `{clip_content}`：原始 clip 内容（含 dialogues）

## 输出格式

输出 JSON 数组，每个元素是完整的 Shot 对象：

```json
[
  {
    "shot_number": "001",
    "shot_size": "远景|中景|近景|特写|大远景",
    "duration_seconds": 3,
    "scene_description": "整合摄影规则的完整画面描述（含构图、光线、色调、人物动作）",
    "director_notes": "整合表演指导的导演注记（包含关键表演要点和节奏控制）",
    "audio_description": "音效和音乐描述（环境音、动作音、对话、音乐风格）",
    "camera_angle": "平视|俯视|仰视|倾斜",
    "camera_movement": "固定|推进|拉远|跟随|摇镜|环绕|缓慢推进",
    "focal_length": "16mm|24mm|35mm|50mm|85mm|135mm",
    "characters": ["出现角色名"],
    "locations": ["地点名"],
    "dialogues": [
      {"speaker": "角色名", "text": "台词原文", "type": "dialogue"},
      {"speaker": "旁白", "text": "旁白原文", "type": "narration"}
    ],
    "prompts": {
      "textToImage": "风格描述, 地点, 景别, 机位, 画面静态描述（保留角色原名）",
      "textToVideo": "运动流程描述，50-150字，强调动作时序和镜头运动"
    },
    "scene_type": "daily|emotion|action|epic|suspense",
    "source_text": "对应原文精确摘录"
  }
]
```

## 整合规则

### scene_description 整合
将面板草稿 description + 摄影规则（composition/lighting/color_palette）整合为完整画面描述：
「[摄影构图]，[光线氛围]，[色调]，[人物动作描述]」

### director_notes 整合
将表演指导（facial_expression/body_language/gaze_direction）整合为导演注记：
「[情绪基调]：[角色名][面部表情]，[身体姿态]，视线[方向]」

### dialogues 提取
从 clip_content 中匹配当前镜头的对话，source_text 是最佳匹配锚点。

### duration_seconds 规则
- 大远景/远景：3-8 秒
- 中景：2-5 秒
- 近景/特写：1-3 秒
- 对话镜头：根据台词长度，每10字≈1秒

### prompts.textToImage 规范
格式：「[风格], [地点], [景别], [机位], [画面描述]」
示例：「写实风格, 咖啡馆, 近景, 平视, 李明看着屏幕，眉头紧锁，手指悬停在键盘上」
注意：保留角色原始名称，前端会根据资产库做图像参考替换。

### prompts.textToVideo 规范
强调运动、时序、镜头动作：
示例：「镜头缓慢推进李明面部，捕捉他听到王芳指出 bug 时的微表情变化：眉头逐渐舒展，嘴角微微上扬，随即快速转头看向屏幕。」

⚠️ JSON 安全：文本值中的所有引号（""''）必须转换为「」，绝不在 JSON 字符串值内使用原始 ASCII 双引号。

只输出 JSON 数组，不添加任何说明文字或 markdown 标记。
```

- [ ] **Step 5: Commit**

```bash
cd /Users/halyu/Documents/Code/story_agent
git add agentos/prompts/storyboard/
git commit -m "feat(agentos): add 4-phase storyboard prompts (plan/cinematographer/acting/refiner)"
```

---

## Task 3: 升级 Characters + Locations 提示词

**Files:**
- Create: `agentos/prompts/characters/characters_system.md`
- Create: `agentos/prompts/locations/locations_system.md`

- [ ] **Step 1: 创建 characters_system.md**

创建 `agentos/prompts/characters/characters_system.md`：

```markdown
你是一位专业的角色档案分析师。从剧本中提取所有角色的完整信息，输出结构化的角色档案。

## 输出格式

输出包含三个数组的 JSON 对象：

```json
{
  "characters": [],
  "new_characters": [
    {
      "name": "角色确切姓名",
      "aliases": ["别名1", "别名2"],
      "role": "protagonist|antagonist|supporting|minor",
      "role_level": "S|A|B|C|D",
      "archetype": "hero|villain|mentor|trickster|caregiver|explorer",
      "description": "外貌、背景、职业的客观描述（不含情绪词）",
      "personality_traits": ["特质1", "特质2"],
      "visual_keywords": ["西装", "眼镜", "短发"],
      "costume_tier": 3,
      "age_range": "25-30",
      "gender": "male|female|other",
      "relationships": [
        {"character": "另一角色名", "relationship": "关系描述"}
      ],
      "appearances": [
        {"id": "app-001", "description": "第一幕着装描述"}
      ]
    }
  ],
  "updated_characters": []
}
```

## 字段说明

- `characters`：已有角色（本次无变化，保持空数组）
- `new_characters`：剧本中新发现的角色
- `updated_characters`：需要更新的已有角色（本次保持空数组）
- `role_level`：叙事重要性 S=核心主角 A=重要配角 B=有名字的配角 C=次要角色 D=跑龙套
- `costume_tier`：服装复杂度 1=极简 2=日常 3=标准 4=精致 5=华丽
- `visual_keywords`：服饰特征关键词，供图像生成使用（不含肤色/眼色/唇色）
- `aliases`：剧本中该角色的其他称呼（如「李总」「老李」）

## 规范

- 使用剧本中的确切姓名，不使用「主角」「他」等替代
- 出现「我」等第一人称时，根据上下文推断具体角色名
- description 只描述可观察的特征，不使用主观情绪词
- visual_keywords 禁止包含：肤色、眼色、唇色（跨模型生成一致性要求）

⚠️ JSON 安全：文本值中的所有引号（""''）必须转换为「」，绝不在 JSON 字符串值内使用原始 ASCII 双引号。

只输出 JSON 对象，不添加任何说明文字或 markdown 标记。
```

- [ ] **Step 2: 创建 locations_system.md**

创建 `agentos/prompts/locations/locations_system.md`：

```markdown
你是一位专业的场景设计分析师。从剧本中提取所有拍摄地点的完整信息。

## 输出格式

输出 JSON 数组：

```json
[
  {
    "name": "地点确切名称",
    "type": "interior|exterior",
    "description": "场景环境的客观描述（布局、装饰、空间感）",
    "time_of_day": "白天|夜晚|黄昏|清晨|不确定",
    "required_props": ["道具1", "道具2"],
    "mood": "场景氛围的视觉描述（色调、光线、空间感）",
    "atmosphere": "可观察的氛围特征（如：暖黄色调，木质家具，阳光从侧窗射入）",
    "suggested_props": ["建议道具1", "建议道具2"],
    "era_context": "时代背景（如：现代都市、90年代、古代）",
    "lighting_default": "默认光线条件（如：自然侧光、荧光灯、烛光）"
  }
]
```

## 字段说明

- `mood`：简短氛围标签（温馨/紧张/神秘等，可用情绪词）
- `atmosphere`：详细的可视化描述，供摄影参考（不用情绪词）
- `suggested_props`：根据场景类型推断的合理道具（非剧本明确提及）
- `era_context`：帮助确定服装、道具、场景设计风格
- `lighting_default`：该场景的典型光线，供摄影师参考

## 规范

- 使用剧本中的确切地点名称
- description 描述可观察的布局和视觉特征
- atmosphere 禁止使用主观情绪词，改为描述色调、光影、空间比例

⚠️ JSON 安全：文本值中的所有引号（""''）必须转换为「」，绝不在 JSON 字符串值内使用原始 ASCII 双引号。

只输出 JSON 数组，不添加任何说明文字或 markdown 标记。
```

- [ ] **Step 3: Commit**

```bash
cd /Users/halyu/Documents/Code/story_agent
git add agentos/prompts/characters/characters_system.md \
        agentos/prompts/locations/locations_system.md
git commit -m "feat(agentos): upgrade characters and locations system prompts with richer schema"
```

---

## Task 4: 重构 StoryboardWorkflow（4 阶段）

**Files:**
- Modify: `agentos/workflows/storyboard_workflow.py`（完整重写）
- Test: `agentos/tests/test_storyboard_v2.py`

- [ ] **Step 1: 写失败测试**

创建 `agentos/tests/test_storyboard_v2.py`：

```python
import pytest
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import patch, MagicMock
from workflows.storyboard_workflow import (
    StoryboardWorkflow,
    chunk_text,
    merge_scenes,
    _load_prompt,
)


class TestChunkText:
    def test_single_chunk_for_short_text(self):
        text = "这是一段短文本。" * 10
        chunks = chunk_text(text, max_tokens=1200)
        assert len(chunks) == 1

    def test_splits_long_text(self):
        text = ("这是一段测试文本。\n\n" * 500)
        chunks = chunk_text(text, max_tokens=300)
        assert len(chunks) > 1

    def test_no_empty_chunks(self):
        text = "段落一\n\n\n\n段落二"
        chunks = chunk_text(text, max_tokens=1200)
        assert all(c.strip() for c in chunks)


class TestMergeScenes:
    def test_renumbers_scenes_and_shots(self):
        input_scenes = [
            [{"id": "scene-1", "title": "A", "summary": "s", "shots": [{"shot_number": "001"}]}],
            [{"id": "scene-1", "title": "B", "summary": "s", "shots": [{"shot_number": "001"}]}],
        ]
        merged = merge_scenes(input_scenes)
        assert merged[0]["id"] == "scene-1"
        assert merged[1]["id"] == "scene-2"
        assert merged[0]["shots"][0]["shot_number"] == "001"
        assert merged[1]["shots"][0]["shot_number"] == "002"

    def test_handles_empty_input(self):
        assert merge_scenes([]) == []

    def test_handles_empty_chunk_result(self):
        assert merge_scenes([[]]) == []


class TestLoadPrompt:
    def test_loads_existing_prompt(self):
        content = _load_prompt("screenplay/screenplay_conversion.md")
        assert len(content) > 100
        assert "JSON 安全" in content

    def test_raises_for_missing_prompt(self):
        with pytest.raises(FileNotFoundError):
            _load_prompt("nonexistent/prompt.md")


class TestWorkflowInit:
    def test_initializes_without_error(self):
        workflow = StoryboardWorkflow()
        assert workflow is not None

    def test_has_required_prompts(self):
        workflow = StoryboardWorkflow()
        assert hasattr(workflow, '_prompts')
        assert 'screenplay' in workflow._prompts
        assert 'plan_panels' in workflow._prompts
        assert 'cinematographer' in workflow._prompts
        assert 'acting_direction' in workflow._prompts
        assert 'detail_refiner' in workflow._prompts
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python -m pytest tests/test_storyboard_v2.py -v 2>&1 | head -30
```

预期：`ImportError` 或 `AttributeError`（`_load_prompt` 和 `_prompts` 尚不存在）

- [ ] **Step 3: 重写 storyboard_workflow.py**

完整替换 `agentos/workflows/storyboard_workflow.py`：

```python
"""
AgentOS Storyboard Workflow v2
4-phase pipeline: screenplay → plan_panels → (cinematographer ‖ acting_direction) → detail_refiner
Processes clips concurrently with ThreadPoolExecutor.
"""
from agno.agent import Agent
from agno.workflow import Workflow, Step, StepInput
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import get_model_from_config

try:
    from ..env_loader import load_backend_env
except ImportError:
    from env_loader import load_backend_env

try:
    from ..lib.json_utils import safe_parse_json
except ImportError:
    from lib.json_utils import safe_parse_json

load_backend_env()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ Data Models ============

class StoryboardInput(BaseModel):
    projectId: str
    text: str
    chunk_tokens: Optional[int] = Field(default=1200)
    temperature: Optional[float] = Field(default=0.7)
    characters_lib: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    locations_lib: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

# ============ Helpers ============

_PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")


def _load_prompt(relative_path: str) -> str:
    """Load prompt file relative to agentos/prompts/"""
    full_path = os.path.join(_PROMPTS_DIR, relative_path)
    if not os.path.exists(full_path):
        raise FileNotFoundError(f"Prompt file not found: {full_path}")
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()


def chunk_text(text: str, max_tokens: int = 1200) -> List[str]:
    """Split text into chunks by approximate token count (1 token ≈ 4 chars for Chinese)"""
    chars_per_chunk = max_tokens * 4
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) > chars_per_chunk:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = para
        else:
            current_chunk += "\n\n" + para if current_chunk else para

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def merge_scenes(scene_lists: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Merge scenes from multiple chunks and renumber scenes + shots globally"""
    merged = []
    scene_counter = 1
    shot_counter = 1

    for scenes in scene_lists:
        for scene in scenes:
            new_scene = dict(scene)
            new_scene['id'] = f"scene-{scene_counter}"
            scene_counter += 1

            new_shots = []
            for shot in scene.get('shots', []):
                new_shot = dict(shot)
                new_shot['shot_number'] = f"{shot_counter:03d}"
                shot_counter += 1
                new_shots.append(new_shot)
            new_scene['shots'] = new_shots
            merged.append(new_scene)

    return merged


def parse_workflow_input(step_input: StepInput) -> Dict[str, Any]:
    """Parse workflow input from StepInput"""
    raw_input = getattr(step_input, 'input', None)
    if raw_input is None:
        return {}
    if isinstance(raw_input, str):
        return safe_parse_json(raw_input, expected_type=dict, fallback={})
    if isinstance(raw_input, dict):
        return raw_input
    return {}


def get_previous_output(step_input: StepInput) -> Dict[str, Any]:
    """Get previous step output"""
    if hasattr(step_input, 'previous_step_outputs') and step_input.previous_step_outputs:
        outputs_list = list(step_input.previous_step_outputs.values())
        if outputs_list:
            last = outputs_list[-1]
            if hasattr(last, 'content'):
                content = last.content
                if isinstance(content, dict):
                    return content
                if isinstance(content, str):
                    return safe_parse_json(content, expected_type=dict, fallback={})
    return {}


# ============ Workflow ============

class StoryboardWorkflow(Workflow):
    """4-phase storyboard workflow: screenplay → plan → enrich → refine"""

    def __init__(self):
        self._prompts = {
            'screenplay': _load_prompt("screenplay/screenplay_conversion.md"),
            'plan_panels': _load_prompt("storyboard/plan_panels.md"),
            'cinematographer': _load_prompt("storyboard/cinematographer.md"),
            'acting_direction': _load_prompt("storyboard/acting_direction.md"),
            'detail_refiner': _load_prompt("storyboard/detail_refiner.md"),
        }

        super().__init__(
            name="StoryboardWorkflow",
            description="Generates storyboard from drama text (4-phase pipeline)",
            steps=[
                Step(name="prepare", description="Validate input and convert screenplay to clips",
                     executor=self.prepare_step),
                Step(name="process_clips", description="Process each clip through 4-phase pipeline",
                     executor=self.process_clips_step),
                Step(name="merge", description="Merge and finalize scenes",
                     executor=self.merge_step),
            ]
        )

    # ---- Phase 0: screenplay conversion ----

    def _screenplay_conversion(self, text: str, model: Any) -> List[Dict[str, Any]]:
        """Convert raw text to structured clips via LLM"""
        agent = Agent(
            name="Screenplay Converter",
            model=model,
            instructions=self._prompts['screenplay'],
            markdown=False,
        )
        response = agent.run(f"请将以下剧本文本转换为结构化 clips：\n\n{text}")
        clips = safe_parse_json(response.content, expected_type=list, fallback=[])
        if not clips:
            logger.warning("[screenplay_conversion] LLM returned empty clips, falling back to single clip")
            clips = [{"clip_id": "clip-001", "summary": "完整内容", "location": "未指定",
                      "characters": [], "content": [{"type": "action", "text": text}]}]
        return clips

    def prepare_step(self, step_input: StepInput) -> Dict[str, Any]:
        """Phase 0: validate LLM config, run screenplay conversion, build assets_context"""
        workflow_input = parse_workflow_input(step_input)

        llm_config = workflow_input.get("_llm_config")
        if not llm_config:
            raise ValueError("LLM configuration is required.")

        text = workflow_input.get("text", "")
        if not text:
            raise ValueError("text is required")

        characters_lib = workflow_input.get("characters_lib") or []
        locations_lib = workflow_input.get("locations_lib") or []

        model = get_model_from_config(llm_config)

        logger.info("[prepare_step] Running screenplay conversion")
        clips = self._screenplay_conversion(text, model)
        logger.info(f"[prepare_step] Got {len(clips)} clips")

        logger.info(json.dumps({"type": "progress", "phase": "clips_ready",
                                "total_clips": len(clips), "progress": 10}))

        return {
            "clips": clips,
            "assets_context": {
                "characters_lib": characters_lib,
                "locations_lib": locations_lib,
            },
            "_llm_config": llm_config,
            "projectId": workflow_input.get("projectId", ""),
        }

    # ---- Phase 1-3: per-clip pipeline ----

    def _plan_panels(self, clip: Dict[str, Any], assets_context: Dict, model: Any) -> List[Dict[str, Any]]:
        """Phase 1: generate panel drafts for one clip"""
        prompt = (
            self._prompts['plan_panels']
            .replace("{clip_json}", json.dumps(clip, ensure_ascii=False))
            .replace("{characters_lib}", json.dumps(assets_context.get("characters_lib", []), ensure_ascii=False))
            .replace("{locations_lib}", json.dumps(assets_context.get("locations_lib", []), ensure_ascii=False))
        )
        agent = Agent(name="Panel Planner", model=model,
                      instructions=prompt, markdown=False)
        response = agent.run("请为这个 clip 规划镜头序列草稿。")
        return safe_parse_json(response.content, expected_type=list, fallback=[])

    def _cinematographer(self, panels: List[Dict], assets_context: Dict, model: Any) -> List[Dict[str, Any]]:
        """Phase 2a: generate cinematography package for panels"""
        prompt = (
            self._prompts['cinematographer']
            .replace("{panels_json}", json.dumps(panels, ensure_ascii=False))
            .replace("{panel_count}", str(len(panels)))
            .replace("{locations_lib}", json.dumps(assets_context.get("locations_lib", []), ensure_ascii=False))
        )
        agent = Agent(name="Cinematographer", model=model,
                      instructions=prompt, markdown=False)
        response = agent.run("请为这些面板生成摄影规则包。")
        return safe_parse_json(response.content, expected_type=list, fallback=[])

    def _acting_direction(self, panels: List[Dict], assets_context: Dict, model: Any) -> List[Dict[str, Any]]:
        """Phase 2b: generate acting direction for panels"""
        prompt = (
            self._prompts['acting_direction']
            .replace("{panels_json}", json.dumps(panels, ensure_ascii=False))
            .replace("{characters_lib}", json.dumps(assets_context.get("characters_lib", []), ensure_ascii=False))
        )
        agent = Agent(name="Acting Director", model=model,
                      instructions=prompt, markdown=False)
        response = agent.run("请为这些面板生成表演指导。")
        return safe_parse_json(response.content, expected_type=list, fallback=[])

    def _detail_refiner(self, panels: List[Dict], cinematography: List[Dict],
                        acting: List[Dict], clip: Dict, model: Any) -> List[Dict[str, Any]]:
        """Phase 3: integrate Phase1+2a+2b into final Shot[]"""
        prompt = (
            self._prompts['detail_refiner']
            .replace("{panels_json}", json.dumps(panels, ensure_ascii=False))
            .replace("{cinematography_json}", json.dumps(cinematography, ensure_ascii=False))
            .replace("{acting_json}", json.dumps(acting, ensure_ascii=False))
            .replace("{clip_content}", json.dumps(clip.get("content", []), ensure_ascii=False))
        )
        agent = Agent(name="Detail Refiner", model=model,
                      instructions=prompt, markdown=False)
        response = agent.run("请整合生成最终分镜面板。")
        return safe_parse_json(response.content, expected_type=list, fallback=[])

    def _process_single_clip(self, clip_index: int, clip: Dict, total_clips: int,
                              assets_context: Dict, model: Any) -> Dict[str, Any]:
        """Run full 4-phase pipeline for one clip"""
        logger.info(f"[clip {clip_index+1}/{total_clips}] Phase 1: plan_panels")
        panels = self._plan_panels(clip, assets_context, model)

        if not panels:
            logger.warning(f"[clip {clip_index+1}] plan_panels returned empty, skipping")
            return {"title": clip.get("summary", f"场景{clip_index+1}"),
                    "summary": clip.get("summary", ""), "shots": []}

        logger.info(f"[clip {clip_index+1}/{total_clips}] Phase 2: cinematographer ‖ acting_direction")

        # Phase 2a + 2b in parallel
        cinematography: List[Dict] = []
        acting: List[Dict] = []

        with ThreadPoolExecutor(max_workers=2) as executor:
            future_cine = executor.submit(self._cinematographer, panels, assets_context, model)
            future_act = executor.submit(self._acting_direction, panels, assets_context, model)
            cinematography = future_cine.result()
            acting = future_act.result()

        logger.info(f"[clip {clip_index+1}/{total_clips}] Phase 3: detail_refiner")
        shots = self._detail_refiner(panels, cinematography, acting, clip, model)

        progress = int(10 + (clip_index + 1) / total_clips * 80)
        logger.info(json.dumps({"type": "progress", "phase": "clip_done",
                                "clip_index": clip_index, "progress": progress}))

        return {
            "title": clip.get("location", f"场景{clip_index+1}"),
            "summary": clip.get("summary", ""),
            "shots": shots,
        }

    def process_clips_step(self, step_input: StepInput) -> Dict[str, Any]:
        """Process all clips in parallel"""
        prev = get_previous_output(step_input)
        clips = prev.get("clips", [])
        assets_context = prev.get("assets_context", {})
        llm_config = prev.get("_llm_config")

        if not llm_config:
            raise ValueError("LLM configuration missing in previous step output")

        model = get_model_from_config(llm_config)
        total_clips = len(clips)
        max_workers = int(os.getenv("LLM_CONCURRENCY", "3"))

        logger.info(f"[process_clips_step] Processing {total_clips} clips with {max_workers} workers")

        all_scenes = [None] * total_clips

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_index = {
                executor.submit(self._process_single_clip, i, clip, total_clips, assets_context, model): i
                for i, clip in enumerate(clips)
            }
            for future in as_completed(future_to_index):
                idx = future_to_index[future]
                try:
                    all_scenes[idx] = future.result()
                except Exception as e:
                    logger.error(f"[clip {idx}] failed: {e}")
                    all_scenes[idx] = {"title": f"场景{idx+1}", "summary": "", "shots": []}

        return {"all_scenes": all_scenes, "projectId": prev.get("projectId", "")}

    def merge_step(self, step_input: StepInput) -> str:
        """Merge all scenes and return final JSON string"""
        prev = get_previous_output(step_input)
        all_scenes = prev.get("all_scenes", [])
        project_id = prev.get("projectId", "")

        workflow_input = parse_workflow_input(step_input)
        if not project_id:
            project_id = workflow_input.get("projectId", "")

        logger.info(json.dumps({"type": "progress", "phase": "merge_start", "progress": 90}))

        merged_scenes = merge_scenes([[s] for s in all_scenes if s])

        logger.info(json.dumps({"type": "progress", "phase": "complete",
                                "progress": 100, "scene_count": len(merged_scenes)}))

        return json.dumps({
            "projectId": project_id,
            "scenes": merged_scenes,
        }, ensure_ascii=False)
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python -m pytest tests/test_storyboard_v2.py -v
```

预期输出：`6 passed`（不含 LLM 的纯逻辑测试）

- [ ] **Step 5: Commit**

```bash
cd /Users/halyu/Documents/Code/story_agent
git add agentos/workflows/storyboard_workflow.py \
        agentos/tests/test_storyboard_v2.py
git commit -m "feat(agentos): rewrite StoryboardWorkflow as 4-phase pipeline"
```

---

## Task 5: 升级 CharactersWorkflow schema

**Files:**
- Modify: `agentos/workflows/characters_workflow.py`
- Test: `agentos/tests/test_characters_v2.py`

- [ ] **Step 1: 写失败测试**

创建 `agentos/tests/test_characters_v2.py`：

```python
import pytest
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from workflows.characters_workflow import CharactersWorkflow, _parse_input


class TestParseInput:
    def test_parses_dict(self):
        result = _parse_input({"text": "hello"})
        assert result == {"text": "hello"}

    def test_parses_json_string(self):
        result = _parse_input('{"text": "hello"}')
        assert result == {"text": "hello"}

    def test_returns_empty_on_invalid(self):
        result = _parse_input("not json")
        assert result == {"text": "not json"}

    def test_returns_empty_on_none(self):
        result = _parse_input(None)
        assert result == {}


class TestCharactersWorkflowInit:
    def test_initializes_without_error(self):
        wf = CharactersWorkflow()
        assert wf is not None

    def test_has_prompt_loaded(self):
        wf = CharactersWorkflow()
        assert hasattr(wf, '_system_prompt')
        assert "JSON 安全" in wf._system_prompt
        assert "role_level" in wf._system_prompt

    def test_output_schema_has_three_arrays(self):
        """Prompt should mention new_characters and updated_characters"""
        wf = CharactersWorkflow()
        assert "new_characters" in wf._system_prompt
        assert "updated_characters" in wf._system_prompt
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python -m pytest tests/test_characters_v2.py -v 2>&1 | head -20
```

预期：`AttributeError: _system_prompt` 不存在

- [ ] **Step 3: 升级 characters_workflow.py**

完整替换 `agentos/workflows/characters_workflow.py`：

```python
"""
Characters Workflow v2
Extracts character profiles with richer schema: role_level, visual_keywords, aliases, appearances.
Uses new characters_system.md prompt with delta output (new/updated separation).
"""
from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any, Dict
import logging
import json
import os

from config import get_model_from_config

try:
    from ..lib.json_utils import safe_parse_json
except ImportError:
    from lib.json_utils import safe_parse_json

logger = logging.getLogger(__name__)

_PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")


def _load_prompt(relative_path: str) -> str:
    full_path = os.path.join(_PROMPTS_DIR, relative_path)
    if not os.path.exists(full_path):
        raise FileNotFoundError(f"Prompt not found: {full_path}")
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()


def _parse_input(raw_input: Any) -> Dict[str, Any]:
    """Parse input from Agno workflow runner"""
    if isinstance(raw_input, dict):
        return raw_input
    if isinstance(raw_input, str):
        result = safe_parse_json(raw_input, expected_type=dict, fallback=None)
        if result is not None:
            return result
        return {"text": raw_input}
    return {}


class CharactersWorkflow(Workflow):
    """Extract character profiles with richer schema (v2)"""

    description: str = "Extracts detailed character profiles from drama scripts (v2 schema)"

    def __init__(self):
        self._system_prompt = _load_prompt("characters/characters_system.md")

        super().__init__(
            name="CharactersWorkflow",
            description="Extracts detailed character profiles from drama scripts (v2 schema)",
            steps=self._extract_characters,
        )

    def _extract_characters(self, workflow: "CharactersWorkflow",
                             execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        params = _parse_input(execution_input.input)
        project_id = params.get("projectId", "")
        text = params.get("text", "")
        llm_config = params.get("_llm_config")

        if not text:
            raise ValueError("text is required")
        if not llm_config:
            raise ValueError("LLM configuration is required.")

        model = get_model_from_config(llm_config)
        agent = Agent(
            name="Character Extractor",
            model=model,
            instructions=self._system_prompt,
            markdown=False,
        )

        logger.info(f"[CharactersWorkflow] Extracting characters for project {project_id}")
        response = agent.run(f"请提取以下剧本中的所有角色信息：\n\n{text}")

        result_data = safe_parse_json(response.content, expected_type=dict, fallback=None)

        # 兼容旧版：LLM 可能直接返回 list 而非 {new_characters: [...]}
        if result_data is None:
            chars = safe_parse_json(response.content, expected_type=list, fallback=[])
            result_data = {"characters": [], "new_characters": chars, "updated_characters": []}

        if "new_characters" not in result_data:
            # 旧格式兼容：将 characters 移到 new_characters
            result_data = {
                "characters": [],
                "new_characters": result_data.get("characters", []),
                "updated_characters": [],
            }

        result = {"projectId": project_id, **result_data}
        return json.dumps(result, ensure_ascii=False)
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python -m pytest tests/test_characters_v2.py -v
```

预期：`4 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/halyu/Documents/Code/story_agent
git add agentos/workflows/characters_workflow.py \
        agentos/tests/test_characters_v2.py
git commit -m "feat(agentos): upgrade CharactersWorkflow with richer schema (role_level, visual_keywords)"
```

---

## Task 6: 升级 LocationsWorkflow schema

**Files:**
- Modify: `agentos/workflows/locations_workflow.py`
- Test: `agentos/tests/test_locations_v2.py`

- [ ] **Step 1: 写失败测试**

创建 `agentos/tests/test_locations_v2.py`：

```python
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from workflows.locations_workflow import LocationsWorkflow, _parse_input


class TestLocationsWorkflowInit:
    def test_initializes_without_error(self):
        wf = LocationsWorkflow()
        assert wf is not None

    def test_has_prompt_with_new_fields(self):
        wf = LocationsWorkflow()
        assert hasattr(wf, '_system_prompt')
        assert "atmosphere" in wf._system_prompt
        assert "era_context" in wf._system_prompt
        assert "lighting_default" in wf._system_prompt
        assert "JSON 安全" in wf._system_prompt
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python -m pytest tests/test_locations_v2.py -v 2>&1 | head -15
```

- [ ] **Step 3: 升级 locations_workflow.py**

完整替换 `agentos/workflows/locations_workflow.py`：

```python
"""
Locations Workflow v2
Extracts location info with richer schema: atmosphere, suggested_props, era_context, lighting_default.
"""
from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any, Dict
import logging
import json
import os

from config import get_model_from_config

try:
    from ..lib.json_utils import safe_parse_json
except ImportError:
    from lib.json_utils import safe_parse_json

logger = logging.getLogger(__name__)

_PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")


def _load_prompt(relative_path: str) -> str:
    full_path = os.path.join(_PROMPTS_DIR, relative_path)
    if not os.path.exists(full_path):
        raise FileNotFoundError(f"Prompt not found: {full_path}")
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()


def _parse_input(raw_input: Any) -> Dict[str, Any]:
    if isinstance(raw_input, dict):
        return raw_input
    if isinstance(raw_input, str):
        result = safe_parse_json(raw_input, expected_type=dict, fallback=None)
        if result is not None:
            return result
        return {"text": raw_input}
    return {}


class LocationsWorkflow(Workflow):
    """Extract location info with richer schema (v2)"""

    description: str = "Extracts location descriptions with atmosphere, era_context, lighting_default"

    def __init__(self):
        self._system_prompt = _load_prompt("locations/locations_system.md")

        super().__init__(
            name="LocationsWorkflow",
            description="Extracts location descriptions with atmosphere, era_context, lighting_default",
            steps=self._extract_locations,
        )

    def _extract_locations(self, workflow: "LocationsWorkflow",
                           execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        params = _parse_input(execution_input.input)
        project_id = params.get("projectId", "")
        text = params.get("text", "")
        llm_config = params.get("_llm_config")

        if not text:
            raise ValueError("text is required")
        if not llm_config:
            raise ValueError("LLM configuration is required.")

        model = get_model_from_config(llm_config)
        agent = Agent(
            name="Location Extractor",
            model=model,
            instructions=self._system_prompt,
            markdown=False,
        )

        logger.info(f"[LocationsWorkflow] Extracting locations for project {project_id}")
        response = agent.run(f"请提取以下剧本中的所有拍摄地点信息：\n\n{text}")

        locations = safe_parse_json(response.content, expected_type=list, fallback=[])

        result = {"projectId": project_id, "locations": locations}
        return json.dumps(result, ensure_ascii=False)
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python -m pytest tests/test_locations_v2.py -v
```

预期：`2 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/halyu/Documents/Code/story_agent
git add agentos/workflows/locations_workflow.py \
        agentos/tests/test_locations_v2.py
git commit -m "feat(agentos): upgrade LocationsWorkflow with atmosphere/era_context/lighting_default"
```

---

## Task 7: TS 层资产注入（storyboard route + asset service）

**Files:**
- Modify: `src/routes/storyboard.ts`
- Modify: `src/services/asset.service.ts`

- [ ] **Step 1: 在 asset.service.ts 添加 getCharacterLibItems 和 getLocationLibItems**

在 `src/services/asset.service.ts` 末尾，`AssetService` 类内部添加以下两个方法（在最后一个方法之后，`}` 之前）。先读取文件末尾确认位置：

```bash
wc -l /Users/halyu/Documents/Code/story_agent/src/services/asset.service.ts
```

然后在文件末尾 `}` 前添加：

```typescript
  /**
   * Get character assets as a slim lib for AgentOS injection
   */
  async getCharacterLibItems(projectId: string): Promise<Array<{ name: string; description?: string; alias?: string }>> {
    try {
      const assets = await prisma.characterAsset.findMany({
        where: { projectId },
        select: { name: true, description: true, alias: true },
        orderBy: { createdAt: 'asc' },
      });
      return assets.map((a: { name: string; description: string | null; alias?: unknown }) => ({
        name: a.name,
        description: a.description ?? undefined,
        alias: (a as any).alias ?? undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get location assets as a slim lib for AgentOS injection
   */
  async getLocationLibItems(projectId: string): Promise<Array<{ name: string; description?: string; alias?: string }>> {
    try {
      const assets = await prisma.locationAsset.findMany({
        where: { projectId },
        select: { name: true, description: true, alias: true },
        orderBy: { createdAt: 'asc' },
      });
      return assets.map((a: { name: string; description: string | null; alias?: unknown }) => ({
        name: a.name,
        description: a.description ?? undefined,
        alias: (a as any).alias ?? undefined,
      }));
    } catch {
      return [];
    }
  }
```

- [ ] **Step 2: 修改 storyboard route 注入资产**

在 `src/routes/storyboard.ts` 顶部 import 区，添加 AssetService：

```typescript
import { AssetService } from '../services/asset.service';
```

在 `const storyboardService = new StoryboardService();` 下方添加：

```typescript
const assetService = new AssetService();
```

修改 `storyboard.post('/api/projects/:projectId/storyboard/import', ...)` 中的两处 `startWorkflowRun` 调用，注入资产。

**流式调用（约第 35 行）** 改为：

```typescript
        const [charactersLib, locationsLib] = await Promise.all([
          assetService.getCharacterLibItems(projectId),
          assetService.getLocationLibItems(projectId),
        ]);

        const response = await startWorkflowRun('storyboardworkflow', {
          projectId,
          text: body.text,
          characters_lib: charactersLib,
          locations_lib: locationsLib,
        }, { stream: true, llmHeaders });
```

**非流式调用（约第 54 行）** 改为：

```typescript
    const [charactersLib, locationsLib] = await Promise.all([
      assetService.getCharacterLibItems(projectId),
      assetService.getLocationLibItems(projectId),
    ]);

    const response = await startWorkflowRun('storyboardworkflow', {
      projectId,
      text: body.text,
      characters_lib: charactersLib,
      locations_lib: locationsLib,
    }, { llmHeaders });
```

- [ ] **Step 3: 编译检查**

```bash
cd /Users/halyu/Documents/Code/story_agent
npm run build 2>&1 | tail -20
```

预期：`0 errors`。如有类型错误，检查 `locationAsset` 的 Prisma model 名称是否正确（可能是 `LocationAsset`），在 asset.service.ts 中对应调整。

- [ ] **Step 4: Lint 检查**

```bash
cd /Users/halyu/Documents/Code/story_agent
npm run lint 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
cd /Users/halyu/Documents/Code/story_agent
git add src/routes/storyboard.ts src/services/asset.service.ts
git commit -m "feat(ts): inject characters_lib and locations_lib into storyboard AgentOS call"
```

---

## Task 8: 全量测试验证

- [ ] **Step 1: 运行所有 Python 测试**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python -m pytest tests/ -v --tb=short 2>&1 | tail -30
```

预期：所有测试通过，无 FAILED。

- [ ] **Step 2: 运行 prompt guard**

```bash
cd /Users/halyu/Documents/Code/story_agent/agentos
python tools/prompt_json_guard.py
```

确认新建的 5 个提示词文件（screenplay_conversion / plan_panels / cinematographer / acting_direction / detail_refiner / characters_system / locations_system）全部通过。

- [ ] **Step 3: 运行 TS 编译**

```bash
cd /Users/halyu/Documents/Code/story_agent
npm run build
```

预期：`0 errors`

- [ ] **Step 4: 运行 TS 测试**

```bash
cd /Users/halyu/Documents/Code/story_agent
npm test 2>&1 | tail -20
```

- [ ] **Step 5: 最终 Commit**

```bash
cd /Users/halyu/Documents/Code/story_agent
git add -A
git status  # 确认无意外文件
git commit -m "feat: agentos upgrade phase1 complete - 4-phase storyboard + asset injection"
```

---

## 验收清单

完成 Phase 1 后，以下条件应全部满足：

- [ ] `python -m pytest agentos/tests/ -v` 全部通过
- [ ] `npm run build` 0 errors
- [ ] `StoryboardWorkflow` 初始化时加载 5 个提示词文件无报错
- [ ] `CharactersWorkflow` 初始化时 `_system_prompt` 包含 `role_level` 和 `new_characters`
- [ ] `LocationsWorkflow` 初始化时 `_system_prompt` 包含 `atmosphere` 和 `era_context`
- [ ] storyboard import route 在调用 AgentOS 前查询 `characterAsset` 和 `locationAsset`
- [ ] `prompt_json_guard.py` 对新建提示词文件无违规报告
