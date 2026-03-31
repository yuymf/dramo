# Chat-Driven Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Dramo from form-based input to a conversation-driven workflow with brainstorming-style requirement clarification, auto-pipeline generation, and progressive rendering.

**Architecture:** Right-side fixed ChatPanel becomes the sole interaction entry point. A ClarificationWorkflow on AgentOS handles creative brainstorming with dynamic option cards. A frontend PipelineController orchestrates existing generation workflows (script → characters → locations → storyboard) sequentially, with SSE streaming for progressive rendering on each tab. A TaskList component tracks pipeline progress.

**Tech Stack:** Next.js 15 (React 19), Hono v4, Prisma 5, FastAPI + Agno, Tailwind CSS v4, react-resizable-panels (new dependency)

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `web/lib/stores/pipeline-store.ts` | Zustand store for pipeline tasks, status, abort control |
| `web/lib/pipeline-controller.ts` | Orchestrates sequential API calls with SSE streaming |
| `web/lib/types/chat.ts` | Extended ChatMessage types (options, progress, clarificationComplete) |
| `web/components/chat/ChatPanel.tsx` | Top-level panel: TaskList + messages + input + stop button |
| `web/components/chat/TaskList.tsx` | Collapsible pipeline progress bar |
| `web/components/chat/OptionCards.tsx` | Clickable option cards (single/multi select + custom input) |
| `web/components/chat/MessageRenderer.tsx` | Routes message types to appropriate renderers |
| `web/components/chat/ProgressMessage.tsx` | Generation progress indicator with animation |
| `web/components/chat/StopButton.tsx` | Stop generation button |
| `agentos/workflows/clarification_workflow.py` | Creative brainstorming agent |
| `agentos/prompts/clarification/system.md` | System prompt for clarification agent |

### Modified Files

| File | Change |
|---|---|
| `web/package.json` | Add `zustand`, `react-resizable-panels` |
| `web/app/projects/[id]/layout.tsx` | Three-column layout with resizable chat panel |
| `web/app/projects/[id]/ProjectLayoutClient.tsx` | Remove drawer/trigger, embed ChatPanel |
| `web/components/chat/AIChatPanel.tsx` | Support new message types, pipeline awareness |
| `web/components/sidebar/ProjectSidebar.tsx` | Remove `input` menu item |
| `web/components/home/CreativeInput.tsx` | Remove `?openChat=true` from redirect |
| `web/app/ai-chat-provider.tsx` | Add `activeTab` + `switchTab` for pipeline tab control |
| `web/lib/models.ts` | Extend ChatMessage with `messageType`, `options`, `clarificationComplete` |
| `server/src/db/schema.prisma` | Add fields to ChatMessage, add PipelineRun model |
| `server/src/routes/chat.ts` | Route clarification messages to ClarificationWorkflow |
| `agentos/app.py` | Register ClarificationWorkflow |

### Deleted Files

| File | Reason |
|---|---|
| `web/app/projects/[id]/@content/input/page.tsx` | Input page replaced by chat panel |
| `web/components/projects/AIChatDrawer.tsx` | Replaced by fixed ChatPanel |
| `web/components/projects/AIChatTriggerButton.tsx` | No longer needed |

---

## Task 1: Install Dependencies & Database Migration

**Files:**
- Modify: `web/package.json`
- Modify: `server/src/db/schema.prisma`

- [ ] **Step 1: Install frontend dependencies**

```bash
cd /Users/halyu/Documents/Code/dramo
npm install zustand react-resizable-panels -w @dramo/web
```

- [ ] **Step 2: Add new fields to ChatMessage and create PipelineRun model**

In `server/src/db/schema.prisma`, replace the existing `ChatMessage` model and add `PipelineRun` after it:

```prisma
model ChatMessage {
  id             String   @id @default(cuid())
  projectId      String
  role           String
  content        String
  blocks         Json?
  messageType    String?  // 'text' | 'options' | 'progress'
  options        Json?    // OptionCards data (AI-generated)
  selectedOption Json?    // User's selection result
  createdAt      DateTime @default(now())

  @@index([projectId, createdAt])
}

model PipelineRun {
  id           String   @id @default(cuid())
  projectId    String
  status       String   @default("running") // running | completed | paused | failed
  requirements Json     // StructuredRequirements
  currentStep  String?  // script | characters | locations | storyboard
  stepResults  Json?    // Per-step completion status
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([projectId])
}
```

- [ ] **Step 3: Run database migration**

```bash
cd /Users/halyu/Documents/Code/dramo
npm run prisma:migrate -- --name add_chat_pipeline_fields
```

Expected: Migration succeeds, new fields and table created.

- [ ] **Step 4: Regenerate Prisma client**

```bash
npm run prisma:generate
```

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json server/src/db/schema.prisma server/src/db/migrations/
git commit -m "chore: add zustand, react-resizable-panels; migrate ChatMessage + PipelineRun"
```

---

## Task 2: Extended Chat Types

**Files:**
- Create: `web/lib/types/chat.ts`
- Modify: `web/lib/models.ts`

- [ ] **Step 1: Create chat type definitions**

Create `web/lib/types/chat.ts`:

```typescript
import type { ContentType, ScriptStyle, ScriptGoal } from '@/lib/models';

/** A single option card shown in the chat */
export interface OptionCard {
  id: string;
  label: string;        // Short title, 2-4 chars
  icon?: string;         // Emoji
  description?: string;  // 1-2 sentence explanation
}

/** Options attached to an assistant message */
export interface ChatMessageOptions {
  multiSelect: boolean;
  items: OptionCard[];          // At least 3, AI-generated dynamically
  customInput: true;            // Always allow free input, renders as "我有别的想法..."
  skipAction?: {
    label: string;
    icon: string;
  };
}

/** Structured requirements output from clarification */
export interface StructuredRequirements {
  contentType: ContentType;
  styles: string[];
  goal: string;
  keyword: string;
  topic?: string;
  situation?: string;
  hotStuffs?: string;
  extraRequirements?: string;
}

/** Extended ChatMessage with new fields */
export interface ExtendedChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  blocks?: Array<{ label: string; text: string }>;
  messageType?: 'text' | 'options' | 'progress';
  options?: ChatMessageOptions;
  selectedOption?: string[] | string;  // What the user picked
  clarificationComplete?: StructuredRequirements;
  createdAt: string;
}

/** Pipeline task step */
export type PipelineStep = 'clarification' | 'script' | 'characters' | 'locations' | 'storyboard';

/** Pipeline task status */
export type PipelineTaskStatus = 'pending' | 'in_progress' | 'completed' | 'paused' | 'failed' | 'skipped';

/** A single task in the pipeline */
export interface PipelineTask {
  id: string;
  step: PipelineStep;
  label: string;
  status: PipelineTaskStatus;
}
```

- [ ] **Step 2: Update models.ts to re-export**

In `web/lib/models.ts`, add at the end of the file:

```typescript
// Re-export extended chat types
export type {
  OptionCard,
  ChatMessageOptions,
  StructuredRequirements,
  ExtendedChatMessage,
  PipelineStep,
  PipelineTaskStatus,
  PipelineTask,
} from '@/lib/types/chat';
```

- [ ] **Step 3: Verify types compile**

```bash
cd /Users/halyu/Documents/Code/dramo/web
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors related to the new types.

- [ ] **Step 4: Commit**

```bash
git add web/lib/types/chat.ts web/lib/models.ts
git commit -m "feat: add extended chat message types and pipeline types"
```

---

## Task 3: Pipeline Store (Zustand)

**Files:**
- Create: `web/lib/stores/pipeline-store.ts`

- [ ] **Step 1: Create pipeline store**

Create `web/lib/stores/pipeline-store.ts`:

```typescript
import { create } from 'zustand';
import type { PipelineTask, PipelineStep, PipelineTaskStatus, StructuredRequirements } from '@/lib/types/chat';

type PipelineStatus = 'idle' | 'clarifying' | 'running' | 'paused' | 'done';

interface PipelineState {
  tasks: PipelineTask[];
  pipelineStatus: PipelineStatus;
  currentStep: PipelineStep | null;
  abortController: AbortController | null;
  requirements: StructuredRequirements | null;
}

interface PipelineActions {
  initTasks: () => void;
  updateTaskStatus: (step: PipelineStep, status: PipelineTaskStatus) => void;
  setPipelineStatus: (status: PipelineStatus) => void;
  setCurrentStep: (step: PipelineStep | null) => void;
  setAbortController: (controller: AbortController | null) => void;
  setRequirements: (req: StructuredRequirements) => void;
  reset: () => void;
}

const DEFAULT_TASKS: PipelineTask[] = [
  { id: 'clarification', step: 'clarification', label: '需求澄清', status: 'pending' },
  { id: 'script', step: 'script', label: '台本生成', status: 'pending' },
  { id: 'characters', step: 'characters', label: '角色提取', status: 'pending' },
  { id: 'locations', step: 'locations', label: '场景提取', status: 'pending' },
  { id: 'storyboard', step: 'storyboard', label: '分镜生成', status: 'pending' },
];

const initialState: PipelineState = {
  tasks: [],
  pipelineStatus: 'idle',
  currentStep: null,
  abortController: null,
  requirements: null,
};

export const usePipelineStore = create<PipelineState & PipelineActions>((set) => ({
  ...initialState,

  initTasks: () =>
    set({
      tasks: DEFAULT_TASKS.map((t) => ({ ...t, status: 'pending' })),
      pipelineStatus: 'clarifying',
      currentStep: 'clarification',
    }),

  updateTaskStatus: (step, status) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.step === step ? { ...t, status } : t
      ),
    })),

  setPipelineStatus: (status) => set({ pipelineStatus: status }),

  setCurrentStep: (step) => set({ currentStep: step }),

  setAbortController: (controller) => set({ abortController: controller }),

  setRequirements: (req) => set({ requirements: req }),

  reset: () => {
    set((state) => {
      state.abortController?.abort();
      return { ...initialState };
    });
  },
}));
```

- [ ] **Step 2: Verify store compiles**

```bash
cd /Users/halyu/Documents/Code/dramo/web
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/stores/pipeline-store.ts
git commit -m "feat: add Zustand pipeline store for task tracking and abort control"
```

---

## Task 4: Pipeline Controller

**Files:**
- Create: `web/lib/pipeline-controller.ts`

- [ ] **Step 1: Create pipeline controller**

Create `web/lib/pipeline-controller.ts`:

```typescript
import { usePipelineStore } from '@/lib/stores/pipeline-store';
import type { PipelineStep, StructuredRequirements } from '@/lib/types/chat';
import { api } from '@/lib/api/client';

/** Maps pipeline steps to their API endpoints and left-side tab names */
const STEP_CONFIG: Record<
  Exclude<PipelineStep, 'clarification'>,
  { endpoint: (projectId: string) => string; tab: string }
> = {
  script: {
    endpoint: (id) => `/api/projects/${id}/script`,
    tab: 'scripts',
  },
  characters: {
    endpoint: (id) => `/api/projects/${id}/characters/extract`,
    tab: 'characters',
  },
  locations: {
    endpoint: (id) => `/api/projects/${id}/locations/extract`,
    tab: 'locations',
  },
  storyboard: {
    endpoint: (id) => `/api/projects/${id}/storyboard/generate`,
    tab: 'storyboard',
  },
};

const GENERATION_STEPS: Exclude<PipelineStep, 'clarification'>[] = [
  'script',
  'characters',
  'locations',
  'storyboard',
];

export interface PipelineCallbacks {
  onStepStart: (step: PipelineStep) => void;
  onStepComplete: (step: PipelineStep) => void;
  onChunk: (step: PipelineStep, data: unknown) => void;
  onTabSwitch: (tab: string) => void;
  onError: (step: PipelineStep, error: string) => void;
  onDone: () => void;
}

/**
 * Runs the generation pipeline: script → characters → locations → storyboard.
 * Each step calls the existing API with SSE streaming.
 * Returns an AbortController to allow interruption.
 */
export function runPipeline(
  projectId: string,
  requirements: StructuredRequirements,
  scriptId: string | null,
  callbacks: PipelineCallbacks
): AbortController {
  const controller = new AbortController();
  const store = usePipelineStore.getState();

  store.setAbortController(controller);
  store.setPipelineStatus('running');

  (async () => {
    let currentScriptId = scriptId;

    for (const step of GENERATION_STEPS) {
      if (controller.signal.aborted) break;

      const config = STEP_CONFIG[step];

      store.updateTaskStatus(step, 'in_progress');
      store.setCurrentStep(step);
      callbacks.onStepStart(step);
      callbacks.onTabSwitch(config.tab);

      try {
        const body = buildStepBody(step, requirements, currentScriptId);

        const result = await executeSSEStep(
          config.endpoint(projectId),
          body,
          controller.signal,
          (chunk) => callbacks.onChunk(step, chunk)
        );

        // Capture script ID for downstream steps
        if (step === 'script' && result?.id) {
          currentScriptId = result.id;
        }

        store.updateTaskStatus(step, 'completed');
        callbacks.onStepComplete(step);
      } catch (err) {
        if (controller.signal.aborted) {
          store.updateTaskStatus(step, 'paused');
          store.setPipelineStatus('paused');
          return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        store.updateTaskStatus(step, 'failed');
        callbacks.onError(step, message);
        // Continue to next step on failure (non-blocking)
      }
    }

    if (!controller.signal.aborted) {
      store.setPipelineStatus('done');
      callbacks.onDone();
    }
  })();

  return controller;
}

function buildStepBody(
  step: Exclude<PipelineStep, 'clarification'>,
  requirements: StructuredRequirements,
  scriptId: string | null
): Record<string, unknown> {
  switch (step) {
    case 'script':
      return {
        source: 'structured',
        form: 'linear',
        contentType: requirements.contentType,
        styles: requirements.styles,
        goal: requirements.goal,
        keyword: requirements.keyword,
        topic: requirements.topic,
        situation: requirements.situation,
        hot_stuffs: requirements.hotStuffs,
      };
    case 'characters':
      return { scriptId };
    case 'locations':
      return { scriptId };
    case 'storyboard':
      return { scriptId, stream: true };
    default:
      return {};
  }
}

/**
 * Executes an SSE-streaming API call.
 * Calls onChunk for each data event.
 * Returns the final parsed result when done.
 */
async function executeSSEStep(
  endpoint: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  onChunk: (data: unknown) => void
): Promise<Record<string, unknown> | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // If SSE stream
  if (contentType.includes('text/event-stream')) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let lastData: Record<string, unknown> | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            lastData = data;
            onChunk(data);
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }

    return lastData;
  }

  // JSON response (non-streaming)
  const result = await response.json();
  onChunk(result);
  return result;
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd /Users/halyu/Documents/Code/dramo/web
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/pipeline-controller.ts
git commit -m "feat: add pipeline controller for sequential SSE generation"
```

---

## Task 5: Chat UI Components — OptionCards

**Files:**
- Create: `web/components/chat/OptionCards.tsx`

- [ ] **Step 1: Create OptionCards component**

Create `web/components/chat/OptionCards.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessageOptions } from "@/lib/types/chat";

interface OptionCardsProps {
  options: ChatMessageOptions;
  disabled?: boolean;
  onSelect: (selected: string[]) => void;
  onCustomInput: () => void;
}

export function OptionCards({
  options,
  disabled = false,
  onSelect,
  onCustomInput,
}: OptionCardsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleCardClick = (id: string) => {
    if (disabled) return;

    if (options.multiSelect) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      // Single select: immediately send
      onSelect([id]);
    }
  };

  const handleConfirm = () => {
    if (selected.size > 0) {
      onSelect(Array.from(selected));
    }
  };

  return (
    <div className="space-y-2 mt-3">
      {options.items.map((item) => {
        const isSelected = selected.has(item.id);
        return (
          <button
            key={item.id}
            onClick={() => handleCardClick(item.id)}
            disabled={disabled}
            className={cn(
              "w-full text-left px-4 py-3 rounded-xl border transition-all duration-200",
              "hover:shadow-sm hover:border-orange-300 hover:bg-orange-50/50",
              isSelected
                ? "border-orange-400 bg-orange-50 shadow-sm"
                : "border-stone-200 bg-white",
              disabled && "opacity-60 cursor-not-allowed hover:shadow-none hover:border-stone-200 hover:bg-white"
            )}
          >
            <div className="flex items-start gap-2.5">
              {item.icon && (
                <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-900">{item.label}</p>
                {item.description && (
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {/* Custom input card */}
      <button
        onClick={onCustomInput}
        disabled={disabled}
        className={cn(
          "w-full text-left px-4 py-3 rounded-xl border border-dashed transition-all duration-200",
          "border-stone-300 hover:border-orange-300 hover:bg-orange-50/30",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">✏️</span>
          <p className="text-sm text-stone-500">我有别的想法...</p>
        </div>
      </button>

      {/* Skip action */}
      {options.skipAction && (
        <button
          onClick={() => onSelect(['__skip__'])}
          disabled={disabled}
          className={cn(
            "w-full text-left px-4 py-3 rounded-xl border transition-all duration-200",
            "border-stone-200 bg-stone-50 hover:border-orange-300 hover:bg-orange-50/50",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{options.skipAction.icon}</span>
            <p className="text-sm font-medium text-stone-700">{options.skipAction.label}</p>
          </div>
        </button>
      )}

      {/* Confirm button for multi-select */}
      {options.multiSelect && selected.size > 0 && !disabled && (
        <button
          onClick={handleConfirm}
          className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          确认选择 ({selected.size})
        </button>
      )}
    </div>
  );
}

/** Renders already-answered option cards (disabled, shows selection) */
export function AnsweredOptionCards({
  options,
  selectedIds,
}: {
  options: ChatMessageOptions;
  selectedIds: string[];
}) {
  const selectedSet = new Set(selectedIds);

  return (
    <div className="space-y-1.5 mt-2 opacity-60">
      {options.items
        .filter((item) => selectedSet.has(item.id))
        .map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200"
          >
            {item.icon && <span className="text-sm">{item.icon}</span>}
            <span className="text-xs font-medium text-orange-700">{item.label}</span>
          </div>
        ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd /Users/halyu/Documents/Code/dramo/web
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add web/components/chat/OptionCards.tsx
git commit -m "feat: add OptionCards component for chat option selection"
```

---

## Task 6: Chat UI Components — TaskList, ProgressMessage, StopButton

**Files:**
- Create: `web/components/chat/TaskList.tsx`
- Create: `web/components/chat/ProgressMessage.tsx`
- Create: `web/components/chat/StopButton.tsx`

- [ ] **Step 1: Create TaskList component**

Create `web/components/chat/TaskList.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import type { PipelineTask, PipelineTaskStatus } from "@/lib/types/chat";

const STATUS_ICONS: Record<PipelineTaskStatus, string> = {
  pending: '○',
  in_progress: '🔄',
  completed: '✅',
  paused: '⏸',
  failed: '❌',
  skipped: '⏭',
};

interface TaskListProps {
  onTaskClick?: (step: string) => void;
}

export function TaskList({ onTaskClick }: TaskListProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { tasks, pipelineStatus } = usePipelineStore();

  // Don't render if no tasks
  if (tasks.length === 0 || pipelineStatus === 'idle') {
    return null;
  }

  return (
    <div className="border-b border-stone-200/50 bg-stone-50/50">
      {/* Header */}
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-stone-600 hover:bg-stone-100/50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span>📋</span>
          <span>任务列表</span>
        </div>
        {collapsed ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronUp size={14} />
        )}
      </button>

      {/* Task items */}
      {!collapsed && (
        <div className="px-4 pb-3 space-y-1">
          {tasks.map((task: PipelineTask) => (
            <button
              key={task.id}
              onClick={() => onTaskClick?.(task.step)}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left",
                task.status === 'in_progress'
                  ? "bg-orange-50 text-orange-700 font-medium"
                  : task.status === 'completed'
                  ? "text-stone-500"
                  : task.status === 'failed'
                  ? "text-red-500"
                  : "text-stone-400",
                "hover:bg-stone-100/50"
              )}
            >
              <span className="shrink-0">{STATUS_ICONS[task.status]}</span>
              <span>{task.label}</span>
              {task.status === 'in_progress' && (
                <span className="ml-auto text-[10px] text-orange-500">← 当前</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ProgressMessage component**

Create `web/components/chat/ProgressMessage.tsx`:

```tsx
"use client";

import { Loader2 } from "lucide-react";
import type { PipelineStep } from "@/lib/types/chat";

const STEP_LABELS: Record<PipelineStep, string> = {
  clarification: '分析需求',
  script: '生成台本',
  characters: '提取角色',
  locations: '提取场景',
  storyboard: '生成分镜',
};

interface ProgressMessageProps {
  step: PipelineStep;
  detail?: string;
}

export function ProgressMessage({ step, detail }: ProgressMessageProps) {
  return (
    <div className="flex items-start gap-2 text-sm text-stone-500">
      <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5 text-orange-500" />
      <div>
        <span className="font-medium text-stone-700">
          {STEP_LABELS[step]}中...
        </span>
        {detail && (
          <p className="text-xs text-stone-400 mt-0.5">{detail}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create StopButton component**

Create `web/components/chat/StopButton.tsx`:

```tsx
"use client";

import { Square } from "lucide-react";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { cn } from "@/lib/utils";

export function StopButton() {
  const { pipelineStatus, abortController } = usePipelineStore();
  const isRunning = pipelineStatus === 'running' || pipelineStatus === 'clarifying';

  if (!isRunning) return null;

  const handleStop = () => {
    abortController?.abort();
    usePipelineStore.getState().setPipelineStatus('paused');
  };

  return (
    <button
      onClick={handleStop}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
        "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
      )}
    >
      <Square size={12} fill="currentColor" />
      停止生成
    </button>
  );
}
```

- [ ] **Step 4: Verify all compile**

```bash
cd /Users/halyu/Documents/Code/dramo/web
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add web/components/chat/TaskList.tsx web/components/chat/ProgressMessage.tsx web/components/chat/StopButton.tsx
git commit -m "feat: add TaskList, ProgressMessage, and StopButton components"
```

---

## Task 7: MessageRenderer

**Files:**
- Create: `web/components/chat/MessageRenderer.tsx`

- [ ] **Step 1: Create MessageRenderer**

Create `web/components/chat/MessageRenderer.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { OptionCards, AnsweredOptionCards } from "@/components/chat/OptionCards";
import { ProgressMessage } from "@/components/chat/ProgressMessage";
import type { ExtendedChatMessage, PipelineStep } from "@/lib/types/chat";

interface MessageRendererProps {
  message: ExtendedChatMessage;
  isLatest: boolean;
  onOptionSelect: (messageId: string, selected: string[]) => void;
  onCustomInput: () => void;
}

export function MessageRenderer({
  message,
  isLatest,
  onOptionSelect,
  onCustomInput,
}: MessageRendererProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-2.5",
          isUser
            ? "bg-[var(--at-accent)] text-[var(--at-text-inverse)]"
            : "bg-[var(--at-surface)] border border-[var(--at-border)] text-[var(--at-text)]"
        )}
      >
        {/* Text content */}
        {message.content && (
          <p
            className="text-sm whitespace-pre-wrap"
            style={{ lineHeight: 1.6 }}
          >
            {message.content}
          </p>
        )}

        {/* Progress indicator */}
        {message.messageType === 'progress' && message.options?.items?.[0] && (
          <ProgressMessage
            step={message.options.items[0].id as PipelineStep}
          />
        )}

        {/* Option cards */}
        {message.options && message.role === 'assistant' && (
          message.selectedOption ? (
            <AnsweredOptionCards
              options={message.options}
              selectedIds={
                Array.isArray(message.selectedOption)
                  ? message.selectedOption
                  : [message.selectedOption]
              }
            />
          ) : isLatest ? (
            <OptionCards
              options={message.options}
              onSelect={(selected) => onOptionSelect(message.id, selected)}
              onCustomInput={onCustomInput}
            />
          ) : (
            <OptionCards
              options={message.options}
              disabled
              onSelect={() => {}}
              onCustomInput={() => {}}
            />
          )
        )}

        {/* Blocks (legacy) */}
        {message.blocks && message.blocks.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[var(--at-border-light)] space-y-1">
            {message.blocks.map((block, idx) => (
              <div key={idx} className="text-xs opacity-70">
                <span className="font-medium">{block.label}:</span>{" "}
                <span>{block.text.substring(0, 50)}...</span>
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs opacity-50 mt-1">
          {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd /Users/halyu/Documents/Code/dramo/web
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add web/components/chat/MessageRenderer.tsx
git commit -m "feat: add MessageRenderer for text, options, and progress messages"
```

---

## Task 8: ChatPanel — Main Container

**Files:**
- Create: `web/components/chat/ChatPanel.tsx`

- [ ] **Step 1: Create ChatPanel**

Create `web/components/chat/ChatPanel.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/Toast";
import { useAIChat } from "@/app/ai-chat-provider";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { runPipeline } from "@/lib/pipeline-controller";
import { TaskList } from "@/components/chat/TaskList";
import { MessageRenderer } from "@/components/chat/MessageRenderer";
import { StopButton } from "@/components/chat/StopButton";
import type { ExtendedChatMessage, StructuredRequirements } from "@/lib/types/chat";

interface ChatPanelProps {
  projectId: string;
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();
  const { currentPageType, currentJsonData } = useAIChat();
  const { pipelineStatus, initTasks, updateTaskStatus, setRequirements, setPipelineStatus, setCurrentStep } = usePipelineStore();

  // Load history
  useEffect(() => {
    async function loadHistory() {
      if (!projectId) return;

      try {
        const initialMessageKey = `project_${projectId}_initialMessage`;
        const initialMessage = sessionStorage.getItem(initialMessageKey);

        if (initialMessage) {
          sessionStorage.removeItem(initialMessageKey);

          // Initialize pipeline tasks
          initTasks();
          updateTaskStatus('clarification', 'in_progress');

          // Send initial message
          const userMsg: ExtendedChatMessage = {
            id: `msg_${Date.now()}_user`,
            role: "user",
            content: initialMessage,
            createdAt: new Date().toISOString(),
          };
          setMessages([userMsg]);
          setInitialLoading(false);

          try {
            const res = await api<{
              userMessage: ExtendedChatMessage;
              assistantMessage: ExtendedChatMessage;
            }>(`/api/chat/${projectId}/messages`, {
              method: "POST",
              body: {
                role: "user",
                content: initialMessage,
                mode: "clarification",
              },
            });
            setMessages([res.userMessage, res.assistantMessage]);
          } catch (err) {
            console.error("Failed to send initial message:", err);
          }
          return;
        }

        // Load existing history
        const res = await api<{ data: ExtendedChatMessage[] }>(
          `/api/chat/${projectId}/messages`
        );
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setInitialLoading(false);
      }
    }

    loadHistory();
  }, [projectId, initTasks, updateTaskStatus]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    try {
      const requestBody: Record<string, unknown> = {
        role: "user",
        content: userMessage,
      };

      if (currentPageType && currentJsonData) {
        requestBody.context = {
          pageType: currentPageType,
          data: currentJsonData,
        };
      }

      // Use clarification mode when pipeline is in clarifying state
      if (pipelineStatus === 'clarifying') {
        requestBody.mode = 'clarification';
      }

      const res = await api<{
        userMessage: ExtendedChatMessage;
        assistantMessage: ExtendedChatMessage;
      }>(`/api/chat/${projectId}/messages`, {
        method: "POST",
        body: requestBody,
      });

      setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);

      // Check if clarification is complete
      if (res.assistantMessage.clarificationComplete) {
        handleClarificationComplete(res.assistantMessage.clarificationComplete);
      }
    } catch (err) {
      showToast((err as Error).message, "error");
      setInput(userMessage);
    } finally {
      setLoading(false);
    }
  }, [input, loading, currentPageType, currentJsonData, pipelineStatus, projectId, showToast]);

  const handleClarificationComplete = useCallback((requirements: StructuredRequirements) => {
    updateTaskStatus('clarification', 'completed');
    setRequirements(requirements);

    // Start pipeline
    const controller = runPipeline(projectId, requirements, null, {
      onStepStart: (step) => {
        const labels: Record<string, string> = {
          script: '开始生成台本...',
          characters: '开始提取角色...',
          locations: '开始提取场景...',
          storyboard: '开始生成分镜...',
        };
        const progressMsg: ExtendedChatMessage = {
          id: `progress_${step}_${Date.now()}`,
          role: 'assistant',
          content: labels[step] || `正在处理 ${step}...`,
          messageType: 'progress',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, progressMsg]);
      },
      onStepComplete: (step) => {
        const labels: Record<string, string> = {
          script: '台本生成完成！',
          characters: '角色提取完成！',
          locations: '场景提取完成！',
          storyboard: '分镜生成完成！',
        };
        const completeMsg: ExtendedChatMessage = {
          id: `complete_${step}_${Date.now()}`,
          role: 'assistant',
          content: labels[step] || `${step} 完成`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, completeMsg]);
      },
      onChunk: (_step, _data) => {
        // Progressive rendering handled by left-side tab components
        // via event dispatch or store updates
      },
      onTabSwitch: (tab) => {
        // Switch left-side active tab
        window.dispatchEvent(
          new CustomEvent('pipeline-tab-switch', { detail: { tab } })
        );
      },
      onError: (step, error) => {
        const errorMsg: ExtendedChatMessage = {
          id: `error_${step}_${Date.now()}`,
          role: 'assistant',
          content: `${step} 生成失败: ${error}。你可以稍后重试。`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      },
      onDone: () => {
        const doneMsg: ExtendedChatMessage = {
          id: `done_${Date.now()}`,
          role: 'assistant',
          content: '全部生成完毕！你可以在左侧各 tab 查看和编辑。有什么需要调整的随时告诉我。',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, doneMsg]);
      },
    });

    // Store controller for abort
    usePipelineStore.getState().setAbortController(controller);
  }, [projectId, updateTaskStatus, setRequirements]);

  const handleOptionSelect = useCallback(async (messageId: string, selected: string[]) => {
    // Mark the message as answered
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, selectedOption: selected } : msg
      )
    );

    // Find the selected label(s) for user-friendly display
    const msg = messages.find((m) => m.id === messageId);
    const selectedLabels = selected
      .map((id) => {
        if (id === '__skip__') return msg?.options?.skipAction?.label || '跳过';
        return msg?.options?.items.find((item) => item.id === id)?.label || id;
      })
      .join('、');

    // Send as user message
    setInput('');
    setLoading(true);

    try {
      const res = await api<{
        userMessage: ExtendedChatMessage;
        assistantMessage: ExtendedChatMessage;
      }>(`/api/chat/${projectId}/messages`, {
        method: "POST",
        body: {
          role: "user",
          content: selectedLabels,
          mode: pipelineStatus === 'clarifying' ? 'clarification' : undefined,
          selectedOption: selected,
        },
      });

      setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);

      if (res.assistantMessage.clarificationComplete) {
        handleClarificationComplete(res.assistantMessage.clarificationComplete);
      }
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [messages, projectId, pipelineStatus, showToast, handleClarificationComplete]);

  const handleCustomInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleReset = async () => {
    if (!confirm("确定要清空对话历史吗？")) return;

    try {
      await api(`/api/chat/${projectId}/reset`, { method: "POST" });
      setMessages([]);
      usePipelineStore.getState().reset();
      showToast("对话历史已清空", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTaskClick = (step: string) => {
    // Map step to tab and dispatch tab switch
    const tabMap: Record<string, string> = {
      script: 'scripts',
      characters: 'characters',
      locations: 'locations',
      storyboard: 'storyboard',
    };
    const tab = tabMap[step];
    if (tab) {
      window.dispatchEvent(
        new CustomEvent('pipeline-tab-switch', { detail: { tab } })
      );
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--at-bg)]">
        <div className="text-center animate-fade-in">
          <div className="w-8 h-8 mx-auto mb-2 text-3xl opacity-40">🐱</div>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--at-text-tertiary)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--at-bg)]">
      {/* Task List */}
      <TaskList onTaskClick={handleTaskClick} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--at-border)]">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐱</span>
          <h2 className="text-sm font-semibold text-[var(--at-text)]">AI 助手</h2>
        </div>
        <div className="flex items-center gap-2">
          <StopButton />
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={messages.length === 0}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-[var(--at-text-tertiary)] text-sm mt-8 animate-fade-in">
              <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center text-4xl opacity-40">🐱</div>
              <p className="font-medium text-[var(--at-text-secondary)]">开始与AI助手对话</p>
              <p className="text-xs mt-1">描述你想创建的台本，我来帮你完善</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <MessageRenderer
              key={msg.id}
              message={msg}
              isLatest={idx === messages.length - 1}
              onOptionSelect={handleOptionSelect}
              onCustomInput={handleCustomInput}
            />
          ))}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 border-t border-[var(--at-border)]">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter发送)"
            className="flex-1 px-3 py-2 resize-none text-sm rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] text-[var(--at-text)] placeholder:text-[var(--at-text-tertiary)] focus:outline-none focus:border-[var(--at-border-focus)] transition-colors"
            rows={2}
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="h-auto"
            variant="accent"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd /Users/halyu/Documents/Code/dramo/web
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add web/components/chat/ChatPanel.tsx
git commit -m "feat: add ChatPanel with TaskList, pipeline orchestration, and option cards"
```

---

## Task 9: Project Layout — Three-Column with Resizable Panel

**Files:**
- Modify: `web/app/projects/[id]/layout.tsx`
- Modify: `web/app/projects/[id]/ProjectLayoutClient.tsx`

- [ ] **Step 1: Rewrite ProjectLayoutClient to embed ChatPanel**

Replace the entire content of `web/app/projects/[id]/ProjectLayoutClient.tsx`:

```tsx
"use client";

import { Suspense, useEffect, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { AIChatProvider } from "@/app/ai-chat-provider";
import { ChatPanel } from "@/components/chat/ChatPanel";

interface ProjectLayoutClientProps {
  children: React.ReactNode;
}

function PipelineTabListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleTabSwitch = (e: Event) => {
      const { tab } = (e as CustomEvent).detail;
      if (!pathname) return;

      // Extract project ID from path: /projects/{id}/...
      const match = pathname.match(/\/projects\/([^/]+)/);
      if (match) {
        const projectId = match[1];
        router.push(`/projects/${projectId}/${tab}`);
      }
    };

    window.addEventListener('pipeline-tab-switch', handleTabSwitch);
    return () => window.removeEventListener('pipeline-tab-switch', handleTabSwitch);
  }, [router, pathname]);

  return null;
}

function ProjectLayoutContent({ children }: ProjectLayoutClientProps) {
  const params = useParams<{ id: string }>();
  const projectId = params?.id as string;

  return (
    <AIChatProvider>
      <PanelGroup direction="horizontal" autoSaveId="dramo-project-layout">
        {/* Content area */}
        <Panel defaultSize={65} minSize={40}>
          {children}
        </Panel>

        {/* Resize handle */}
        <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-orange-200/50 active:bg-orange-300/50 transition-colors cursor-col-resize relative group">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-stone-200 group-hover:bg-orange-300 transition-colors" />
        </PanelResizeHandle>

        {/* Chat panel */}
        <Panel defaultSize={35} minSize={20} collapsible collapsedSize={0}>
          {projectId && <ChatPanel projectId={projectId} />}
        </Panel>
      </PanelGroup>

      <PipelineTabListener />
    </AIChatProvider>
  );
}

export function ProjectLayoutClient({ children }: ProjectLayoutClientProps) {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-[var(--at-bg)]">{children}</div>}>
      <ProjectLayoutContent>{children}</ProjectLayoutContent>
    </Suspense>
  );
}
```

- [ ] **Step 2: Update project layout.tsx**

Replace the entire content of `web/app/projects/[id]/layout.tsx`:

```tsx
/**
 * 项目混合路由布局 - 三栏架构
 * 侧栏常驻 + 主内容区深链接切换 + 右侧 ChatPanel
 */
import type { ReactNode } from "react";
import { ProjectLayoutClient } from "./ProjectLayoutClient";

interface ProjectLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  content: ReactNode;
  params: Promise<{ id: string }>;
}

export default function ProjectLayout({
  sidebar,
  content,
}: ProjectLayoutProps) {
  return (
    <ProjectLayoutClient>
      <div className="flex min-h-screen bg-[var(--at-bg)]">
        {/* 并行路由：侧栏常驻 */}
        {sidebar}

        {/* 并行路由：主内容区（深链接切换） */}
        <div className="flex-1 relative" style={{ zIndex: 1 }}>
          {content}
        </div>
      </div>
    </ProjectLayoutClient>
  );
}
```

- [ ] **Step 3: Verify page renders**

```bash
cd /Users/halyu/Documents/Code/dramo
npm run dev -w @dramo/web &
sleep 5
curl -s http://localhost:12323/projects/test 2>&1 | head -5
```

Expected: No build errors. Page structure loads.

- [ ] **Step 4: Commit**

```bash
git add web/app/projects/[id]/layout.tsx web/app/projects/[id]/ProjectLayoutClient.tsx
git commit -m "feat: three-column layout with resizable ChatPanel"
```

---

## Task 10: Remove Old Input Page and Drawer

**Files:**
- Delete: `web/app/projects/[id]/@content/input/page.tsx`
- Delete: `web/components/projects/AIChatDrawer.tsx`
- Delete: `web/components/projects/AIChatTriggerButton.tsx`
- Modify: `web/components/sidebar/ProjectSidebar.tsx`
- Modify: `web/components/home/CreativeInput.tsx`

- [ ] **Step 1: Delete old files**

```bash
rm web/app/projects/[id]/@content/input/page.tsx
rm web/components/projects/AIChatDrawer.tsx
rm web/components/projects/AIChatTriggerButton.tsx
```

- [ ] **Step 2: Remove input menu item from sidebar**

In `web/components/sidebar/ProjectSidebar.tsx`, replace the `projectMenuItems` useMemo (lines 34-40):

```typescript
  const projectMenuItems = useMemo(() => [
    { id: "script", label: t("script"), icon: FileText, href: `/projects/${currentProjectId}/scripts` },
    { id: "characters", label: t("characters"), icon: Users, href: `/projects/${currentProjectId}/characters` },
    { id: "locations", label: "地点", icon: MapPin, href: `/projects/${currentProjectId}/locations` },
    { id: "storyboard", label: t("storyboard"), icon: Film, href: `/projects/${currentProjectId}/storyboard` },
  ], [currentProjectId, t]);
```

Also remove the unused `PenLine` import from the import statement (line 10).

- [ ] **Step 3: Update CreativeInput redirect**

In `web/components/home/CreativeInput.tsx`, change line 32:

From:
```typescript
      router.push(`/projects/${project.id}?openChat=true`);
```
To:
```typescript
      router.push(`/projects/${project.id}/scripts`);
```

- [ ] **Step 4: Verify no broken imports**

```bash
cd /Users/halyu/Documents/Code/dramo/web
npx tsc --noEmit --pretty 2>&1 | head -30
```

Fix any broken imports that reference the deleted files. The main ones to check:
- `ProjectLayoutClient.tsx` no longer imports `AIChatDrawer` or `AIChatTriggerButton` (already handled in Task 9)
- `@content/input/page.tsx` removal may require a default route redirect

- [ ] **Step 5: Check if default route needs updating**

Look at `web/app/projects/[id]/@content/default.tsx` or `web/app/projects/[id]/page.tsx`. If they redirect to `/input`, update to redirect to `/scripts`:

```bash
cat web/app/projects/[id]/page.tsx 2>/dev/null || echo "No page.tsx"
cat web/app/projects/[id]/@content/default.tsx 2>/dev/null || echo "No default.tsx"
```

If either redirects to `input`, change to `scripts`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove input page, drawer, and trigger button; update sidebar and routing"
```

---

## Task 11: ClarificationWorkflow (AgentOS)

**Files:**
- Create: `agentos/prompts/clarification/system.md`
- Create: `agentos/workflows/clarification_workflow.py`
- Modify: `agentos/app.py`

- [ ] **Step 1: Create clarification system prompt**

Create `agentos/prompts/clarification/system.md`:

````markdown
# 创意顾问 — 台本需求澄清

你是一位资深的影视创意顾问。你的任务是通过自然对话帮助用户明确台本的创作方向。

## 行为准则

1. **像创意顾问一样思考**，不是表单收集器。理解用户的创意意图，提出有见地的方向建议。
2. **根据上下文动态生成选项**，不是预设枚举。每次提供至少3个差异化方向，每个方向都有简短说明。
3. **主动指出模糊点或潜在问题**，帮用户想清楚。
4. **智能跳过已知信息**。如果用户输入已经包含某些信息（如"搞笑直播台本"），直接利用，不重复询问。
5. **判断何时需求足够明确**，适时提议开始生成。

## 输出格式

你的每次回复必须是一个 JSON 对象，包含以下字段：

```json
{
  "content": "你的对话文本（始终有，用自然语言与用户交流）",
  "options": {
    "multiSelect": false,
    "items": [
      {
        "id": "unique_id",
        "label": "简短标题",
        "icon": "emoji",
        "description": "1-2句说明"
      }
    ],
    "skipAction": null
  },
  "clarificationComplete": null
}
```

### 字段说明

- `content`: 你的对话回复，自然语言。
- `options`: 可选。当你想提供方向建议时附上。至少3个`items`。`skipAction` 如 `{"label": "开始生成", "icon": "🚀"}`。
- `clarificationComplete`: 当你判断需求已明确时，输出结构化需求：

```json
{
  "clarificationComplete": {
    "contentType": "short_video",
    "styles": ["humorous", "healing"],
    "goal": "entertainment",
    "keyword": "月球上的猫",
    "topic": "猫的月球日记",
    "situation": "一只被遗忘在月球上的猫...",
    "extraRequirements": "每集1分钟，反转结尾"
  }
}
```

### contentType 枚举
- `live` — 直播
- `film` — 电影
- `short_drama` — 短剧
- `short_video` — 短视频
- `vlog` — Vlog

### styles 枚举
- `humorous`, `bizarre`, `healing`, `passionate`, `sad`, `suspense`, `horror`, `absurd`, `realistic`, `retro`, `acg`, `literary`

## 注意

- **不是每轮都需要options**。追问细节、回应修改时，纯文字即可（options设为null）。
- **选项要有真正的差异**，不是微调差异。
- **推荐在content文本中说明理由**，不在卡片上标"推荐"。
- 当用户说"开始"、"就这样"或选择了skipAction时，输出clarificationComplete。
````

- [ ] **Step 2: Create ClarificationWorkflow**

Create `agentos/workflows/clarification_workflow.py`:

```python
"""
Clarification Workflow

Creative brainstorming agent for requirement clarification.
Converses with the user to understand their creative intent,
then outputs structured requirements for the generation pipeline.
"""

from agno.agent import Agent
from agno.workflow import Workflow, WorkflowExecutionInput
from typing import Any, Dict, List
import logging
import json

from config import get_model_from_config

try:
    from ..lib.prompt_loader import load_prompt as _load_prompt
except ImportError:
    from lib.prompt_loader import load_prompt as _load_prompt

try:
    from ..lib.json_utils import safe_parse_json
except ImportError:
    from lib.json_utils import safe_parse_json

logger = logging.getLogger(__name__)


def _parse_input(raw_input: Any) -> Dict[str, Any]:
    """Parse input from Agno workflow runner (string JSON or dict)"""
    if isinstance(raw_input, dict):
        return raw_input
    if isinstance(raw_input, str):
        return safe_parse_json(raw_input, expected_type=dict, fallback={})
    return {}


class ClarificationWorkflow(Workflow):
    """Creative brainstorming for requirement clarification"""

    description: str = "Helps users clarify their creative intent through brainstorming dialogue"

    def __init__(self):
        self._system_prompt = _load_prompt("clarification/system.md")

        super().__init__(
            name="ClarificationWorkflow",
            description="Helps users clarify their creative intent through brainstorming dialogue",
            steps=self._clarify,
        )

    def _clarify(
        self,
        workflow: "ClarificationWorkflow",
        execution_input: WorkflowExecutionInput,
        **kwargs: Any,
    ) -> str:
        """Run one round of clarification dialogue"""
        params = _parse_input(execution_input.input)
        messages: List[Dict[str, str]] = params.get("messages", [])
        llm_config = params.get("_llm_config")

        if not llm_config:
            raise ValueError("LLM configuration is required.")

        if not messages:
            raise ValueError("messages is required")

        model = get_model_from_config(llm_config)

        clarification_agent = Agent(
            name="Creative Consultant",
            model=model,
            description="Creative brainstorming consultant for script creation",
            instructions=self._system_prompt,
            markdown=False,
        )

        # Build conversation context
        conversation = "\n\n".join(
            f"{'用户' if m['role'] == 'user' else 'AI'}: {m['content']}"
            for m in messages
        )

        logger.info(f"[ClarificationWorkflow] Processing {len(messages)} messages")

        response = clarification_agent.run(conversation)
        result = response.content

        # Parse JSON response
        if isinstance(result, str):
            parsed = safe_parse_json(result, expected_type=dict, fallback=None)
            if not parsed:
                # If AI didn't return valid JSON, wrap as text-only response
                logger.warning(
                    f"[ClarificationWorkflow] Non-JSON response: {result[:200]}"
                )
                parsed = {
                    "content": result,
                    "options": None,
                    "clarificationComplete": None,
                }
            result = parsed

        output = {
            "content": result.get("content", ""),
            "options": result.get("options"),
            "clarificationComplete": result.get("clarificationComplete"),
        }

        logger.info(
            f"[ClarificationWorkflow] "
            f"hasOptions={output['options'] is not None}, "
            f"complete={output['clarificationComplete'] is not None}"
        )

        return json.dumps(output, ensure_ascii=False)
```

- [ ] **Step 3: Register ClarificationWorkflow in app.py**

In `agentos/app.py`, add the import after the existing workflow imports (line 32):

```python
from workflows.clarification_workflow import ClarificationWorkflow
```

Create an instance after the existing workflow instances (after line 53):

```python
clarification_workflow = ClarificationWorkflow()
```

Add it to the workflows list in `AgentOS(...)` (line 241-247). Replace:

```python
agent_os = AgentOS(
    name="Story Agent OS",
    workflows=[
        storyboard_workflow,
        characters_workflow,
        locations_workflow,
        polish_workflow,
        script_workflow,
    ],
    base_app=custom_app,
    telemetry=False,
)
```

With:

```python
agent_os = AgentOS(
    name="Story Agent OS",
    workflows=[
        storyboard_workflow,
        characters_workflow,
        locations_workflow,
        polish_workflow,
        script_workflow,
        clarification_workflow,
    ],
    base_app=custom_app,
    telemetry=False,
)
```

- [ ] **Step 4: Verify AgentOS starts**

```bash
cd /Users/halyu/Documents/Code/dramo/agentos
python -c "from workflows.clarification_workflow import ClarificationWorkflow; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add agentos/prompts/clarification/system.md agentos/workflows/clarification_workflow.py agentos/app.py
git commit -m "feat: add ClarificationWorkflow for creative brainstorming"
```

---

## Task 12: Backend — Route Clarification Messages

**Files:**
- Modify: `server/src/routes/chat.ts`

- [ ] **Step 1: Update chat route to support clarification mode**

In `server/src/routes/chat.ts`, update the non-streaming POST handler (lines 104-128). Replace the entire non-streaming block:

```typescript
  // Non-streaming: route based on mode
  try {
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
    let content = '';
    let messageType: string | null = null;
    let options: unknown = null;
    let clarificationComplete: unknown = null;

    if (body.mode === 'clarification') {
      // Use ClarificationWorkflow
      const response = await startWorkflowRun('ClarificationWorkflow', {
        messages,
        stream: false,
      }, { requestId, stream: false, llmHeaders });

      const responseText = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        // AgentOS workflow returns JSON string in "output" or directly
        const outer = JSON.parse(responseText);
        const inner = outer.output || outer;
        parsed = typeof inner === 'string' ? JSON.parse(inner) : inner;
      } catch {
        parsed = { content: responseText };
      }

      content = (parsed.content as string) || 'No response';

      if (parsed.options) {
        messageType = 'options';
        options = parsed.options;
      }

      if (parsed.clarificationComplete) {
        clarificationComplete = parsed.clarificationComplete;

        // Create PipelineRun record
        await prisma.pipelineRun.create({
          data: {
            projectId,
            status: 'running',
            requirements: parsed.clarificationComplete as object,
            currentStep: 'script',
          },
        });
      }
    } else {
      // Default: call AgentOS chat_completion endpoint
      const aiResponse = await postAgentOS<{
        choices?: Array<{ message: { role: string; content: string } }>;
        content?: string;
        message?: string;
      }>('/agentos/chat_completion', { messages, stream: false }, { llmHeaders });

      content =
        aiResponse.choices?.[0]?.message?.content ||
        aiResponse.content ||
        aiResponse.message ||
        'No response';
    }

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        projectId,
        role: 'assistant',
        content,
        messageType,
        options: options ? (options as object) : undefined,
      },
    });

    // Add clarificationComplete to response (not stored in DB, transient)
    const responsePayload: Record<string, unknown> = {
      userMessage,
      assistantMessage: {
        ...assistantMessage,
        clarificationComplete: clarificationComplete || undefined,
      },
    };

    return c.json(responsePayload);
  } catch (err) {
    logger.error({ err, projectId }, 'Chat completion failed');
    throw err;
  }
```

- [ ] **Step 2: Add PipelineRun import check**

The `prisma.pipelineRun` reference will work after the migration (Task 1). Verify the Prisma client has been regenerated.

- [ ] **Step 3: Verify server compiles**

```bash
cd /Users/halyu/Documents/Code/dramo/server
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/chat.ts
git commit -m "feat: route clarification messages to ClarificationWorkflow"
```

---

## Task 13: Update AIChatProvider for Tab Switching

**Files:**
- Modify: `web/app/ai-chat-provider.tsx`

- [ ] **Step 1: Add activeTab to context**

In `web/app/ai-chat-provider.tsx`, add `activeTab` and `switchTab` to the context. Replace the full file:

```tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export type PageType = 'script' | 'characters' | 'locations' | 'storyboard' | null;

interface AIChatContextValue {
  currentPageType: PageType;
  currentJsonData: object | null;
  updateJsonData: (data: object | null) => void;
  pendingChanges: {
    type: PageType;
    originalData: object | null;
    suggestedData: object | null;
  } | null;
  setPendingChanges: (changes: AIChatContextValue['pendingChanges']) => void;
  clearPendingChanges: () => void;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

const noopAIChatContext: AIChatContextValue = {
  currentPageType: null,
  currentJsonData: null,
  updateJsonData: () => {},
  pendingChanges: null,
  setPendingChanges: () => {},
  clearPendingChanges: () => {},
};

export function useAIChat() {
  const context = useContext(AIChatContext);
  return context ?? noopAIChatContext;
}

interface AIChatProviderProps {
  children: ReactNode;
  projectId?: string;
}

export function AIChatProvider({ children }: AIChatProviderProps) {
  const [currentJsonData, setCurrentJsonData] = useState<object | null>(null);
  const [pendingChanges, setPendingChanges] = useState<AIChatContextValue['pendingChanges']>(null);
  const pathname = usePathname();

  const getPageType = useCallback((path: string | null): PageType => {
    if (!path) return null;
    if (path.includes('/scripts')) return 'script';
    if (path.includes('/characters')) return 'characters';
    if (path.includes('/locations')) return 'locations';
    if (path.includes('/storyboard')) return 'storyboard';
    return null;
  }, []);

  const currentPageType = getPageType(pathname);

  useEffect(() => {
    if (pendingChanges && pendingChanges.type !== currentPageType) {
      setPendingChanges(null);
    }
  }, [currentPageType, pendingChanges]);

  const updateJsonData = useCallback((data: object | null) => {
    setCurrentJsonData(data);
  }, []);

  const clearPendingChanges = useCallback(() => {
    setPendingChanges(null);
  }, []);

  const value: AIChatContextValue = useMemo(() => ({
    currentPageType,
    currentJsonData,
    updateJsonData,
    pendingChanges,
    setPendingChanges,
    clearPendingChanges,
  }), [
    currentPageType,
    currentJsonData,
    updateJsonData,
    pendingChanges,
    setPendingChanges,
    clearPendingChanges,
  ]);

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}
```

Note: The drawer-related state (`isOpen`, `openDrawer`, `closeDrawer`, `toggleDrawer`) has been removed since the drawer is gone. The ChatPanel is now embedded in the layout.

- [ ] **Step 2: Fix any broken references to removed context values**

Search for any remaining usage of `openDrawer`, `closeDrawer`, `toggleDrawer`, `isOpen` from `useAIChat()`:

```bash
cd /Users/halyu/Documents/Code/dramo/web
grep -rn "openDrawer\|closeDrawer\|toggleDrawer\|isOpen" --include="*.tsx" --include="*.ts" src/ app/ components/ 2>/dev/null | grep -v node_modules | grep -v "AIChatDrawer\|AIChatTriggerButton"
```

Fix any found references (they should have been removed when deleting the drawer files in Task 10).

- [ ] **Step 3: Verify compiles**

```bash
cd /Users/halyu/Documents/Code/dramo/web
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add web/app/ai-chat-provider.tsx
git commit -m "refactor: simplify AIChatProvider, remove drawer state"
```

---

## Task 14: Integration Test — End-to-End Flow

**Files:**
- No new files

- [ ] **Step 1: Start all services**

```bash
cd /Users/halyu/Documents/Code/dramo
npm run dev
```

Wait for all 3 services to start (web:12323, server:12321, agentos:12322).

- [ ] **Step 2: Verify home page still works**

Open `http://localhost:12323/home`. Enter a creative idea and submit. Verify:
- Project creates successfully
- Redirects to `/projects/{id}/scripts`
- ChatPanel appears on the right side
- Initial message is sent to clarification workflow

- [ ] **Step 3: Verify clarification flow**

In the ChatPanel:
- AI should respond with creative suggestions and option cards
- Clicking an option card should send the selection
- AI should continue brainstorming
- Eventually AI should output `clarificationComplete`

- [ ] **Step 4: Verify pipeline starts**

After clarification completes:
- TaskList should show pipeline progress
- Left-side tab should switch to scripts
- Script generation should stream

- [ ] **Step 5: Verify stop button**

Click "停止生成" during pipeline:
- SSE should abort
- Current task should show paused
- User can continue chatting

- [ ] **Step 6: Run linting**

```bash
npm run lint -w @dramo/web
npm run lint -w @dramo/server
```

Fix any lint errors.

- [ ] **Step 7: Commit any lint fixes**

```bash
git add -A
git commit -m "fix: lint fixes for chat-driven redesign"
```

---

## Task 15: Cleanup and Polish

**Files:**
- Remove unused input components

- [ ] **Step 1: Remove unused input components**

```bash
rm -f web/components/input/ProStructuredForm.tsx
rm -f web/components/input/DramaTextInput.tsx
rm -f web/components/input/BaseChatInput.tsx
```

- [ ] **Step 2: Check for dangling imports**

```bash
cd /Users/halyu/Documents/Code/dramo/web
grep -rn "ProStructuredForm\|DramaTextInput\|BaseChatInput\|AIChatDrawer\|AIChatTriggerButton" --include="*.tsx" --include="*.ts" . | grep -v node_modules
```

Fix any remaining imports.

- [ ] **Step 3: Verify full build**

```bash
cd /Users/halyu/Documents/Code/dramo/web
npx next build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove unused input components and clean up imports"
```
