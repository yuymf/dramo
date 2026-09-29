# DRAMO design

Night writing desk. One ember accent (`#c2410c`). Off-black landing, warm paper product.

## Surfaces

- **Landing (`/`):** persuade. Dark, still, one action: `开始写作` → `/home`.
- **Home / projects / settings:** operate. Light paper, same accent, no English eyebrows, no decorative motion.
- **Project workspace:** operate. Four layers — rail + project panel + canvas + floating AI. Not a 220px module list. Not a fixed right chat column.

## Workspace

The project layout mounts `components/workspace/WorkspaceShell.tsx` once per project. `WorkspaceRail` owns route navigation; `ProjectPanel` owns project settings, real format/view switches, sharing and versions. `ScreenplayView` / `CoverView` retain their document hooks; Outline and Beats retain their page state and API calls. `FloatingAI` retains the PR2 container and revise behavior.

- Rail: 56px; panel: 232px, manually collapsible. On viewports ≤1024px the panel defaults collapsed so the canvas is usable; ≥1280/1440 stays open by default. Explicit user toggle always wins. Canvas gets the remaining space; the AI window overlays it. No fixed right chat slot.
- Script primary navigation: screenplay, Outline, Beats, characters, locations, props, storyboard and assets, all existing routes. Worldview, knowledge, advisors, cold start and **口播** remain under **更多**. The menu supports arrow keys, Home/End and Escape with focus return.
- The panel shows the actual first document name. No new Episode CRUD, entity views or permission placeholders. Hollywood / Asian change real screenplay formatting; 正文 / 封面 open real views.
- Export has one entry: the project panel while open, otherwise the active editor toolbar. The active editor still owns the document and export hook; no second fetch or document instance is introduced. TXT/PDF/DOCX/FDX are unchanged. The menu portal stays inside the workspace so it inherits the theme.

### Visual tokens and scope

`components/workspace/workspace.css` defines `--ws-*` tokens only beneath `.workspace-theme` on Script project pages. Existing canvas `--at-*` tokens map to them locally. The shared rail/panel/AI use token fallbacks, preserving legacy presentation outside that scope. `/spoken`, Cinema, landing, home and other global pages do not receive the class. No global CSS palette changes.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas / rail | `#fafaf9` | `#171717` |
| Panel / toolbar / AI / menus / manuscript | `#ffffff` | `#222222` |
| Hover / recessed controls | `#f5f5f4` | `#303030` |
| Border | `#d6d3d1` | `#525252` |
| Main / secondary / muted text | `#1c1917` / `#57534e` / `#69635e` | `#fafaf9` / `#d6d3d1` / `#b5b0aa` |
| Accent / focus / primary action | `#c2410c` | `#c2410c` |

Dark-theme accent text uses neutral light text for readability; the same orange remains on selected markers, focus and primary button backgrounds. Error text has a separate semantic token. Disabled controls retain labels and lower opacity; coverage states retain explicit 已兑现 / 未兑现 labels on neutral surfaces.

UI scale: 12px for hints/counts/save state, 14px for navigation/actions/body, 16px for panel/dimension titles, 20px reserved for page-level titles. Icons are 16px with 36–40px minimum action targets. Manuscript and cover font sizes/indentation remain governed by `screenplay.css`; the node-type gutter remains a compact manuscript affordance. Keyboard focus is explicit, including AI input and menu items. No paper texture, gradients, cat ears, decorative float or hover lift. Reduced-motion preference suppresses animation in the scoped workspace.

There is **no existing theme preference setting or account preference API**. Workspace themes currently follow `prefers-color-scheme`; this is an OS/browser preference, not account synchronization. Native version restore confirmation follows the browser's native dialog styling. Global toast presentation remains shared with legacy pages.

### Cleanup audit and visual baseline (PR3)

| Control / treatment | Result |
| --- | --- |
| Search / large logo / user card / fixed Chat splitter | Already absent after PR1; no replacement placeholders |
| Export | Moved to project operations, one entry with toolbar fallback when panel is hidden |
| Fake filter or hollywood/dialogue/script view tabs | Not mounted in current workspace; real screenplay format settings retained |
| Generation / branch / teleprompter / SRT in Script toolbar | Not mounted; no capability/API removed |
| 口播 | Still reachable via 更多 and `/projects/:id/spoken`; that route was already a placeholder in the base revision |
| Beat chips / fake Episode CRUD / entity or permission buttons | Not added; existing page-count timeline and actual Beats page retained |
| Paper / decorative effects | Neutral manuscript surface and shell-scoped suppression; landing unchanged |
| Publishing an already published project | Existing status remains visible and is disabled |

Visual baseline: same project at 1440×900, Script / Outline / Beats in light and dark, plus 更多 open. Check toolbar overflow at 1280×800 and 1024×800; at 1024×768 the project panel should start collapsed (Laper live-gap). PR2 keeps its 1024×768 drag/resize checks. Playwright writes evidence under ignored `web/test-results/`; screenshots and logs are never committed. The layout retains Dramo's document editor and page-count sidebar; it does not claim semantic-editor parity or new Laper behavior. A live Laper side-by-side comparison is not part of automated verification.

## Rules

- One CTA label: 开始写作.
- New project default is Script (`type=script`). Spoken is a weak control at the bottom of the new-project dialog, never on the home CTA.
- No fake proof pages (cases, blog, pricing).
- No idle float, grain, ticker, or hover-lift on inert cards.
- Chinese-first type: Noto Sans SC + system fallbacks.
- Corners 8–12px. Accent only on action and active state.
