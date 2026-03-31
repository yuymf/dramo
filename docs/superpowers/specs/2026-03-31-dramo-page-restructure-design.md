# Dramo Page Restructuring: Claude Code-Style IDE for Scriptwriting

**Date:** 2026-03-31
**Status:** Design Approved
**Concept:** Right side = Chat-driven AI IDE (like Claude Code), Left side = Script workbench (real-time display)

---

## 1. Overview & Core Concept

### Current State
- Home page (`/home`): Input content (text/file) via `CreativeInput` component
- Project creation redirects to `/projects/[id]` with chat drawer (`AIChatDrawer`)
- Chat drawer appears right-side, but generation UI is disconnected

### New State (Target)
**Single unified workspace** where:
- **Right side (Chat IDE):** Conversational AI brainstorming + requirements clarification (like Claude Code's right panel)
  - User submits initial idea from `/home`
  - AI probes naturally through conversation (no structured forms)
  - User can interrupt anytime and chat continues contextually
  - Chat drawer stays open (user can collapse if needed)

- **Left side (Workbench):** Real-time display of generated content
  - Scripts / Scenes / Characters / Storyboard tabs
  - Streamed content appends progressively to each section
  - User can edit interrupted content while generation pauses
  - Task/Plan system tracks all pending work across edits
  - **Key principle:** Left side is the *working surface*; right side is the *thinking surface*

### Generation Model (Parallel Multi-Stream)
1. AI clarifies requirements conversationally
2. Once ready, generation happens **in parallel** across 4 streams:
   - Scripts (dialogue, scene structure)
   - Characters (profiles, relationships)
   - Scenes / Locations (environment, blocking)
   - Storyboard / Shots (visual planning)
3. Each stream is **independent** but shares context via Task Plan
4. User can **interrupt** any stream, **edit** left-side content, then **continue** generation
5. Internal Task/Plan system tracks what's done, what's pending, edits made

---

## 2. Data Model

### 2.1 Task/Plan System (New)

```typescript
// Represents a single work item that should be generated
interface GenerationTask {
  id: string;
  projectId: string;
  type: 'script' | 'character' | 'scene' | 'shot' | 'location';
  title: string; // e.g., "Scene 1: Opening dialogue"
  description: string; // What to generate
  status: 'pending' | 'in_progress' | 'completed' | 'paused';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Generation tracking
  streamId?: string; // Link to SSE stream ID
  progressPercent?: number;

  // User edits applied to this task's output
  userEdits?: {
    timestamp: Date;
    changes: string; // Summary or diff
  }[];
}

// Represents the overall plan/roadmap
interface GenerationPlan {
  id: string;
  projectId: string;
  initialRequirement: string; // What user asked for

  // AI's understanding of requirements (from clarification phase)
  requirementsContext: {
    tone?: string;
    format?: string;
    keyCharacters?: string[];
    setting?: string;
    style?: string;
    [key: string]: any; // Flexible for conversational context
  };

  // Decomposed tasks
  tasks: GenerationTask[];

  // Overall state
  status: 'clarifying' | 'ready' | 'generating' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;

  // Generation settings
  settings: {
    allowImageGeneration: boolean; // User permission toggle
    parallelStreams: number; // How many parallel streams (1 = sequential)
  };
}

// Chat message with generation context
interface EnhancedChatMessage extends ChatMessage {
  generationPlanId?: string; // Which plan does this message belong to?
  isSystemPrompt?: boolean; // Internal system messages
  relatedTasks?: string[]; // Task IDs this message relates to
}
```

### 2.2 Generation State

```typescript
// Tracks the live state of generation
interface GenerationState {
  planId: string;

  // Active streams
  activeStreams: {
    [streamId: string]: {
      taskId: string;
      status: 'connecting' | 'streaming' | 'paused' | 'completed' | 'error';
      buffer: string; // Accumulated content
      errorMessage?: string;
    };
  };

  // User edits during pause
  pendingEdits: {
    [sectionType: string]: {
      timestamp: Date;
      changes: any; // Could be diff, or full updated content
    };
  };

  // Pause state
  isPaused: boolean;
  pauseReason?: string; // 'user_interrupted' | 'user_editing' | etc.
}
```

### 2.3 Chat Context (Enhanced)

```typescript
// In AIChatProvider, add:
interface AIChatContextEnhanced {
  // ... existing fields ...

  // New: Generation tracking
  currentGenerationPlan?: GenerationPlan;
  generationState?: GenerationState;

  // Hook for left-side to subscribe to updates
  onGenerationUpdate: (task: GenerationTask, newContent: string) => void;
  onGenerationPauseResume: (isPaused: boolean) => void;

  // Methods to control generation
  pauseGeneration: () => void;
  resumeGeneration: (withEdits?: any) => void;
  interruptStream: (streamId: string) => void;
}
```

---

## 3. User Flow (Step-by-Step)

### Phase 1: Entry (Home → Project)

```
User at /home
    ↓
Types/pastes content in CreativeInput
    ↓
Clicks submit (or Ctrl+Enter)
    ↓
Project created, navigates to /projects/[id]?openChat=true
    ↓
Chat drawer auto-opens with user's initial message already sent
```

### Phase 2: Requirements Clarification (Right Side - Chat)

```
AI receives: "我想写一个关于月球上的猫的故事"
    ↓
AI responds with natural clarifying questions:
  "很有趣! 这只猫是什么样的个性？是孤独的思想家还是顽皮的冒险家？"
    ↓
User responds (free-form)
    ↓
AI: "还有呢？这个故事最终要传达什么？"
    ↓
User responds or interrupts: "我想要5个主要场景，每个3分钟"
    ↓
AI内部: Builds GenerationPlan with tasks decomposition
AI to user: "好的，我有清晰的方向了。要开始生成吗？"
    ↓
User: "开始" or just continues chatting
    ↓
Generation starts
```

### Phase 3: Parallel Generation (Left Side - Workbench)

```
Generation begins:

  SSE Stream 1 (Scripts):
    Task: "生成主场景对话"
    Status: in_progress, 0% → 100%
    Content: Streams dialogue, scene structure progressively

  SSE Stream 2 (Characters):
    Task: "创建角色档案：猫、地球观察者"
    Status: in_progress
    Content: Character profiles stream in

  SSE Stream 3 (Scenes):
    Task: "环境设定和场景块"
    Status: queued (waiting for earlier tasks' context)

  SSE Stream 4 (Storyboard):
    Task: "5个镜头规划"
    Status: queued

User sees left-side panels updating in real-time:
  - Scripts tab shows incoming dialogue
  - Characters tab shows new profiles being added
  - Scenes tab shows location descriptions
  - Storyboard tab shows shot planning

Meanwhile, right-side chat is still open. User can:
  - Ask AI follow-up questions
  - Say "这个角色需要更多..." and AI adapts next generation
  - Continue conversing naturally
```

### Phase 4: User Interrupt & Edit

```
During generation:
User sees Scripts tab half-done, decides to edit a scene

User clicks "暂停" (Pause button) in generation status area
    ↓
All SSE streams pause (GenerationState.isPaused = true)
    ↓
Left-side content becomes editable
User edits Character description, modifies a scene
    ↓
In chat, user can say: "改完了，继续生成其他的"
    ↓
AI acknowledges edits, resumes generation with new context:
  - Tasks that depend on edited content are re-queued
  - Unaffected tasks resume
  - GenerationPlan.tasks updated with user edits recorded
    ↓
Generation resumes streaming to left side
```

### Phase 5: Final Adjustments

```
Generation completes (all streams finished or user stopped)
    ↓
Left-side workbench shows final Scripts/Characters/Scenes/Storyboard
    ↓
User can still edit anything
    ↓
Chat continues: "我想改一下第3场景的气氛..." → AI suggests edits
    ↓
Loop or finalize
```

---

## 4. Architecture & Component Design

### 4.1 Layout Structure (New)

```
/projects/[id]/
  ├─ @sidebar/ (persistent nav)
  └─ @content/ (new parallel routes!)
      ├─ layout.tsx (new: Workbench + Chat layout)
      ├─ page.tsx (default view = scripts tab)
      ├─ default.tsx (fallback)
      └─ [workbench sections - see below]

// New file structure for workbench sections
@content/
  ├─ layout.tsx ← New! Wraps all content with:
  │              - Left side: Workbench (Scripts/Characters/Scenes/Shots)
  │              - Right side: Chat drawer (always visible, can collapse)
  │
  ├─ scripts/page.tsx (Scripts tab content)
  ├─ characters/page.tsx (Characters tab content)
  ├─ scenes/page.tsx (Scenes/Locations tab content)
  ├─ storyboard/page.tsx (Storyboard/Shots tab content)
  └─ _layout/
      ├─ WorkbenchLayout.tsx (Container for left + right)
      ├─ WorkbenchTabs.tsx (Scripts / Characters / Scenes / Storyboard)
      ├─ GenerationStatus.tsx (Shows active streams, progress, pause/resume)
      ├─ WorkbenchScriptsPanel.tsx (Left: scripts display + edit)
      ├─ WorkbenchCharactersPanel.tsx (Left: characters display + edit)
      └─ WorkbenchScenesPanel.tsx (Left: scenes/locations display + edit)
```

### 4.2 Component Hierarchy

#### Right Side (Chat IDE)
```
AIChatDrawer (enhanced)
  ├─ Header (with collapse button, not just close)
  ├─ AIChatPanel (enhanced with generation context)
  │   ├─ MessageList (displays EnhancedChatMessage[])
  │   ├─ GenerationStatus (shows active streams, tasks)
  │   ├─ SettingsPanel (toggle "Allow image generation")
  │   └─ MessageInput (text area + send)
  └─ ResizeHandle (can minimize to right edge, stay 300px)
```

#### Left Side (Workbench)
```
WorkbenchLayout
  ├─ WorkbenchTabs (Scripts / Characters / Scenes / Storyboard)
  ├─ GenerationProgress (overlay or sidebar)
  │   └─ Shows: "Scripts 100% | Characters 50% | Scenes 0% | Storyboard 0%"
  │   └─ Shows: "Paused" state if user interrupted
  │   └─ Shows: "Continue" button
  │
  ├─ Active Content Panel (based on selected tab)
  │   ├─ WorkbenchScriptsPanel
  │   │   ├─ Scene selector / breadcrumb
  │   │   ├─ Editable script viewer (TipTap-based)
  │   │   └─ Streaming content appender
  │   │
  │   ├─ WorkbenchCharactersPanel
  │   │   ├─ Character list (filterable)
  │   │   ├─ Character detail view (editable)
  │   │   └─ Relationship graph (optional)
  │   │
  │   ├─ WorkbenchScenesPanel
  │   │   ├─ Location selector
  │   │   ├─ Scene block editor
  │   │   └─ Streaming updates
  │   │
  │   └─ WorkbenchStoryboardPanel
  │       ├─ Shot grid or timeline
  │       ├─ Shot detail editor
  │       └─ Streaming shot descriptions
  └─
```

### 4.3 Data Flow Architecture

```
User Input (Chat) → AIChatPanel
    ↓
AI Backend generates GenerationPlan + Tasks
    ↓
SSE Multiple Streams (one per task or one per type)
    ↓
GenerationState updated in real-time
    ↓
Workbench left-side components subscribe to GenerationState
    ↓
Left-side re-renders with streaming content
    ↓
User can edit left-side while generation continues
    ↓
Edits stored in GenerationPlan.tasks[].userEdits[]
    ↓
User says "continue" in chat
    ↓
AI processes edited content, updates tasks, resumes generation
```

---

## 5. Key Features & Interactions

### 5.1 Chat Panel Enhancements

**Current Features (Keep):**
- Message history with user/assistant roles
- Markdown rendering
- JSON application (from AI suggestions)

**New Features:**
- Display active GenerationTasks inline ("现在生成中：Scripts 50%...")
- Allow user to see task decomposition ("我会生成以下内容...")
- Pause/Resume buttons during generation
- Settings toggle for image generation permission
- Real-time context showing left-side edits ("你修改了：Character - 猫的性格")

### 5.2 Workbench Enhancements

**Left-Side Panels (All New):**
- **Scripts tab:** Shows incoming dialogue/scene structure. User can select a scene and edit inline. Marked as "paused" if generation stopped mid-way.
- **Characters tab:** Shows generated character cards. Each card is editable. Streaming updates add new characters or expand existing ones.
- **Scenes tab:** Environmental descriptions, location blocking. Streamable and editable.
- **Storyboard tab:** Shot planning, visual descriptions. Can integrate with image generation (if user allows).

**Interaction Model:**
- User can't edit during generation (to avoid conflicts)
- User clicks "暂停" (Pause) to stop generation and unlock editing
- After editing, "继续生成" (Continue) resumes with new context
- All edits are recorded in GenerationPlan for context preservation

### 5.3 Pause/Resume State Machine

```
State: Clarifying
  ↓ (user says "开始生成")
State: Generating
  ├─ Left side: Locked (read-only)
  ├─ Right side: Chat active
  ├─ Streams: Active SSE connections
  │
  ↓ (user clicks "暂停" or says "停一下")
  │
State: Paused
  ├─ Left side: Unlocked (editable)
  ├─ Right side: Chat active
  ├─ Streams: Closed (SSE connections gracefully stopped)
  │
  ↓ (user edits and says "继续生成")
  │
State: Generating (resumed)
  ├─ Edits recorded in GenerationPlan
  ├─ AI processes edits, updates task dependencies
  ├─ New SSE streams created
  └─ Generation continues
```

### 5.4 Settings: Image Generation Permission

```
In AIChatPanel, add toggle:
  "允许直接生成图片" [OFF] ← User controls

If OFF:
  - Storyboard generation includes descriptions, no image requests
  - Faster generation, lower cost

If ON:
  - Parallel stream for image generation
  - Storyboard includes actual images
  - User can interrupt image generation independently
```

---

## 6. Backend Integration (API Changes Required)

### 6.1 New Endpoints

```
POST /api/projects/:id/generation-plans
  Request: { requirement: string }
  Response: { planId, tasks: Task[], conversationId }

POST /api/projects/:id/generation-plans/:planId/stream
  Query: { allowImages: boolean }
  Response: SSE stream with:
    event: "task_start" → { taskId, type, progress: 0 }
    event: "task_update" → { taskId, content: "...", progress: 50 }
    event: "task_complete" → { taskId, finalContent }
    event: "stream_pause" → { reason }

POST /api/projects/:id/generation-plans/:planId/pause
  Response: { paused: true }

POST /api/projects/:id/generation-plans/:planId/resume
  Request: { edits: [...], continueFrom?: string }
  Response: SSE stream (resume generation)

GET /api/projects/:id/generation-plans/:planId/tasks
  Response: { tasks: Task[] }

PATCH /api/projects/:id/generation-plans/:planId/tasks/:taskId
  Request: { userEdits: { changes: string } }
  Response: { task: Task }
```

### 6.2 SSE Message Format

```typescript
interface SSETaskMessage {
  type: 'task_start' | 'task_update' | 'task_complete' | 'stream_error';
  taskId: string;
  taskType: 'script' | 'character' | 'scene' | 'shot';
  content?: string; // Streamed content (for update/complete)
  progress?: number; // 0-100
  errorMessage?: string; // For error type
  metadata?: {
    estimatedTokens?: number;
    actualTokens?: number;
  };
}
```

---

## 7. Implementation Phases

### Phase 1: Infrastructure (Week 1)
- [ ] Create GenerationPlan data model (DB schema + types)
- [ ] Create GenerationTask system
- [ ] Implement AIChatProvider enhancements
- [ ] Create WorkbenchLayout component (basic left/right split)
- [ ] Set up SSE infrastructure (pause/resume logic)

### Phase 2: Chat & Clarification (Week 2)
- [ ] Enhance AIChatPanel with generation context display
- [ ] Implement conversational clarification prompting
- [ ] Build GenerationStatus inline display
- [ ] Add settings toggle (image generation permission)

### Phase 3: Workbench Display (Week 2-3)
- [ ] Create WorkbenchScriptsPanel with streaming support
- [ ] Create WorkbenchCharactersPanel with streaming support
- [ ] Create WorkbenchScenesPanel with streaming support
- [ ] Create WorkbenchStoryboardPanel with streaming support
- [ ] Implement edit-unlock logic during pause state

### Phase 4: Streaming & Generation (Week 3-4)
- [ ] Implement SSE multi-stream architecture
- [ ] Connect API endpoints for generation start/pause/resume
- [ ] Build pause/resume state machine
- [ ] Implement user edit recording

### Phase 5: Polish & Integration (Week 4-5)
- [ ] Test interrupt/resume workflow end-to-end
- [ ] Test parallel stream conflict resolution
- [ ] Error handling and retry logic
- [ ] Mobile responsiveness (drawer collapse)
- [ ] Analytics: track generation times, interrupts, edits

---

## 8. Edge Cases & Error Handling

### 8.1 Interruption Scenarios
- User closes browser during generation → Resume from last checkpoint on return
- Network drops during SSE → Graceful reconnect with progress recovery
- User edits affect multiple tasks → Recompute dependencies, resume affected tasks only
- User interrupts, edits, then closes without saving → Warn user about unsaved changes

### 8.2 Generation Conflicts
- User edits Character while Character stream still active → Lock stream, save edits, resume after conflict resolution
- User edits Scene while Scene stream active → Same conflict handling
- Image generation conflicts with script generation → Queue independently, allow user to pause image stream separately

### 8.3 UI Feedback
- Show "Generating: Scripts 50% | Characters 30% | Scenes 0%" at all times
- Show "Last edit: 2 min ago" when user has pending edits
- Show error states: "Connection lost. Retrying..." or "Generation failed. Resume?"
- Show "Paused by user" indicator clearly

---

## 9. Testing Strategy

### Unit Tests
- GenerationPlan decomposition logic (requirements → tasks)
- Task dependency resolution
- Edit application logic (merge user edits with generation)

### Integration Tests
- End-to-end: Home → Project creation → Chat → Clarification → Generation start
- Pause/resume cycle with edits
- Multi-stream parallel generation
- SSE stream error and reconnect

### E2E Tests
- Full workflow: Input → Clarify → Generate (parallel) → Pause → Edit → Resume → Complete
- Image generation toggle behavior
- Mobile drawer collapse/expand during generation

---

## 10. Success Criteria

✅ **Chat Phase:**
- Users experience natural, Claude Code-like clarification conversation
- Conversational interruptions don't break context
- Requirements captured in GenerationPlan

✅ **Generation Phase:**
- Parallel multi-stream generation works without conflicts
- Streaming content appears progressively (not in chunks)
- User can interrupt and pause generation

✅ **Edit Phase:**
- User can interrupt, edit left-side content, resume generation
- Edits are incorporated into next generation round
- Task plan remembers all pending work across interrupt cycles

✅ **Settings & Control:**
- Image generation toggle respected
- User can collapse chat drawer to gain more workbench space
- Progress indicators always visible

✅ **Performance:**
- Chat response time < 2s
- Streaming content renders smoothly (no jank)
- No memory leaks during long generation sessions

---

## Appendix: Visual Mockup Description

```
┌─────────────────────────────────────────┐
│ /projects/[id]                          │
├────────────────────────┬─────────────────┤
│                        │                 │
│   LEFT SIDE            │  RIGHT SIDE     │
│   (Workbench)          │  (Chat Drawer)  │
│                        │                 │
│ ┌────────────────────┐ │ ┌─────────────┐ │
│ │ Scripts │ Chars │ │ │ AI 助手     X │ │
│ │ Scenes │ Story  │ │ │─────────────│ │
│ ├────────────────────┤ │ • "月球猫..." │ │
│ │                    │ │             │ │
│ │ [Streaming Content]│ │ • "性格？..." │ │
│ │ Scene 1: ...       │ │             │ │
│ │ Scene 2: ... ▌     │ │ > "可爱..." │ │
│ │ [Generating 50%]   │ │             │ │
│ │                    │ │ [Generating]│ │
│ │ ⏸ Pause  ▶ Continue│ │ Scripts 50% │ │
│ │                    │ │             │ │
│ └────────────────────┘ │ 🐱 [input]  │ │
│                        │ ⌲ Send      │ │
│                        │ ⚙ Settings  │ │
│                        └─────────────┘ │
└────────────────────────┴─────────────────┘
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-31 | Initial design with user feedback (A: immediate nav, B: conversational clarification, B: parallel multi-stream, A: pause & preserve, plan system) |

