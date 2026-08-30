# DRAMO design

Night writing desk. One ember accent (`#c2410c`). Off-black landing, warm paper product.

## Surfaces

- **Landing (`/`):** persuade. Dark, still, one action: `开始写作` → `/home`.
- **Home / projects / settings:** operate. Light paper, same accent, no English eyebrows, no decorative motion.
- **Project workspace:** operate. Four layers — rail + project panel + canvas + floating AI. Not a 220px module list. Not a fixed right chat column.

## Workspace

```
┌────┬──────────────┬────────────────────────────┐
│轨  │ 项目面板      │ 中央画布                     │
│    │              │                            │
│剧本│ 项目名        │  编辑器 / 封面 / 表         │
│角色│ 格式          │                            │
│地点│ 当前集        │     ┌─────────────────┐    │
│更多│              │     │ AI 浮层（可拖可叠）│    │
└────┴──────────────┴────────────────────────────┘
```

1. **窄导航轨** — 只切换维度。第一期：剧本、角色、地点。底部「更多」才出现口播。不放搜索、不放用户名片。
2. **项目面板** — 项目名、类型、格式（好莱坞 / 亚洲）、当前集（第一期只一集）。维度内视图（正文 / 封面）在此切换。
3. **中央画布** — 同一壳，只换中央。剧本页看起来像剧本，不是笔记卡片流。
4. **AI 浮层** — 浮在画布上，可移动、可改大小、可收起。**禁止**固定右侧聊天栏，**禁止**用 `react-resizable-panels` 把对话做成永久分栏。收起后中央仍是完整工作区。

### Visual

- Surface: paper white (`#fafaf9` / `#ffffff`). Contrast for long reading.
- Accent only `#c2410c` — current dimension, primary button, focus. No orange gradient, no paper grain, no cat ears, no idle float.
- Chinese-first UI. Unified type size and icon size.
- Motion: short feedback on select / save only. No decorative hover-lift.

## Rules

- One CTA label: 开始写作.
- New project default is Script (`type=script`). Spoken is a weak control at the bottom of the new-project dialog, never on the home CTA.
- No fake proof pages (cases, blog, pricing).
- No idle float, grain, ticker, or hover-lift on inert cards.
- Chinese-first type: Noto Sans SC + system fallbacks.
- Corners 8–12px. Accent only on action and active state.
