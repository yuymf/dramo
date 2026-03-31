# Dramo Codebase: "Script to Storyboard" (剧本到分镜) AI Flow Analysis

## Executive Summary

The Dramo project implements a sophisticated 4-phase AI-powered storyboard generation pipeline that converts raw drama scripts into detailed, shot-by-shot storyboard JSON. The flow spans three main services:
1. **Frontend (Next.js)** — User interface and task polling
2. **Backend API (Hono/TypeScript)** — Request handling, authentication, task orchestration
3. **AgentOS (Python/Agno)** — AI workflow execution with multi-agent system

---

## Complete User Flow: Script → Storyboard

### 1. Frontend Trigger (Next.js)
**File:** `web/app/api/projects/[projectId]/storyboard/import/route.ts`

```
User submits drama text
    ↓
Frontend POST: /api/projects/{projectId}/storyboard/import
    ↓ (proxied via next.js route)
Backend receives request (with Bearer token from NextAuth)
```

**Frontend handlers:** `web/app/projects/[id]/@content/storyboard/handlers.ts`
- `handleGenerated()` — Process storyboard response
- `replaceNamesWithDescriptions()` — Replace character/location names with AI descriptions

---

## Backend API Layer

### 2. Storyboard Import Endpoint
**File:** `server/src/routes/storyboard.ts:111`

```typescript
POST /api/projects/:projectId/storyboard/import
├─ Request body: { text: "drama script..." }
├─ Authentication: JWT Bearer token (extracts userId)
├─ Authorization: Verify project ownership (BOLA prevention)
└─ Response: 202 Accepted + { taskId: "..." }
```

**Async Pattern:**
- Returns **202 immediately** with `taskId`
- Background task execution starts (fire-and-forget)
- Frontend polls GET `/api/tasks/{taskId}` to monitor progress

**Key constants:**
```typescript
const WORKFLOW_TIMEOUT_MS = 540_000;  // 9 minutes for background call
const ESTIMATED_PIPELINE_SECONDS = 300;  // 5 minutes (shown to frontend)
```

### 3. Background Task Execution
**Function:** `executeStoryboardImport()` in `storyboard.ts:38-105`

```
1. Create Task record (status: 'queued', progress: 0)
2. Fire async job: executeStoryboardImport()
   ├─ Fetch project assets
   │  ├─ Get character library items
   │  └─ Get location library items
   ├─ Call AgentOS: startWorkflowRun('storyboardworkflow', {...})
   ├─ Parse response
   └─ Update Task with final result/error
3. Return taskId to frontend immediately
```

### 4. AgentOS HTTP Call (with LLM Headers)
**File:** `server/src/lib/agentos-client.ts:30-94`

```typescript
startWorkflowRun('storyboardworkflow', {
  projectId: "...",
  text: "drama text",
  characters_lib: [...],
  locations_lib: [...],
  _llm_config: {
    api_key: "...",
    base_url: "...",
    model_id: "..."
  }
}, {
  llmHeaders: { 'X-LLM-Api-Key', 'X-LLM-Base-Url', 'X-LLM-Model-Id' },
  timeoutMs: 540_000  // 9 minutes
})
```

**URL:** `POST /workflows/storyboardworkflow/runs`
**Headers:**
- `Content-Type: application/x-www-form-urlencoded`
- `Authorization: Bearer {AGENTOS_SECURITY_KEY}`
- `X-LLM-Api-Key`, `X-LLM-Base-Url`, `X-LLM-Model-Id`

---

## AgentOS Python Workflow (4-Phase Pipeline)

### 5. StoryboardWorkflow Overview
**File:** `agentos/workflows/storyboard_workflow.py`

```
Phase 0: prepare_step()
  ├─ Validate LLM config
  ├─ Run screenplay_conversion (LLM call)
  └─ Build assets_context
              ↓
Phase 1-3: process_clips_step() [PARALLEL]
  ├─ For each clip (with concurrency control):
  │  ├─ Phase 1: _plan_panels() → Draft panel sequences
  │  ├─ Phase 2a: _cinematographer() → Photography rules [PARALLEL]
  │  ├─ Phase 2b: _acting_direction() → Acting direction [PARALLEL]
  │  └─ Phase 3: _detail_refiner() → Final Shot[] assembly
  │
  └─ Concurrency settings:
     ├─ LLM_CONCURRENCY: 3 (default, max 10)
     ├─ Phase 2a+2b: ThreadPoolExecutor(max_workers=2) → 120s timeout each
     └─ Phase 3: ThreadPoolExecutor(max_workers=1) → DETAIL_REFINER_TIMEOUT_SECONDS (default 200s)
              ↓
Phase 4: merge_step()
  ├─ Merge all scenes
  ├─ Renumber scenes and shots globally
  └─ Return JSON string output
```

**Key Concurrency:**
```python
_MAX_LLM_CONCURRENCY = 10
LLM_CONCURRENCY = min(int(os.getenv("LLM_CONCURRENCY", "3")), _MAX_LLM_CONCURRENCY)

# Per-clip pipeline:
with ThreadPoolExecutor(max_workers=2) as executor:  # Phase 2a + 2b parallel
    future_cine = executor.submit(self._cinematographer, ...)
    future_act = executor.submit(self._acting_direction, ...)
    cinematography = future_cine.result(timeout=120)
    acting = future_act.result(timeout=120)

# Phase 3 (Detail Refiner) - longer timeout
detail_refiner_timeout = int(os.getenv("DETAIL_REFINER_TIMEOUT_SECONDS", "200"))
shots = future_refiner.result(timeout=detail_refiner_timeout)
```

### 6. Phase Details

#### Phase 0: Screenplay Conversion
**Agent:** "Screenplay Converter"
**Prompt:** `agentos/prompts/screenplay/screenplay_conversion.md`
**Output:** List of structured clips with:
- `clip_id`, `summary`, `location`
- `content[]` array (action, dialogue, voiceover entries)
- `characters[]`, interaction hints

#### Phase 1: Plan Panels
**Agent:** "Panel Planner"
**Prompt:** `agentos/prompts/storyboard/plan_panels.md`
**Input:** 
- Single clip JSON
- `characters_lib` and `locations_lib` (from frontend)
**Output:** Array of panel drafts with:
```
{
  "panel_number": 1,
  "description": "visual content description",
  "shot_type": "远景|中景|近景|特写|大远景",
  "camera_move": "固定|推进|拉远|跟随|摇镜|环绕",
  "source_text": "exact quote from original",
  "scene_type": "daily|emotion|action|epic|suspense",
  "characters": ["role names"],
  "location": "location name"
}
```

#### Phase 2a: Cinematographer (Parallel)
**Agent:** "Cinematographer"
**Prompt:** `agentos/prompts/storyboard/cinematographer.md`
**Input:** Panel array + locations_lib
**Output:** Cinematography rules for each panel:
```
{
  "panel_number": 1,
  "composition": "framing description",
  "lighting": "lighting scheme",
  "color_palette": "color tone",
  "atmosphere": "mood/atmosphere"
}
```

#### Phase 2b: Acting Direction (Parallel)
**Agent:** "Acting Director"
**Prompt:** `agentos/prompts/storyboard/acting_direction.md`
**Input:** Panel array + characters_lib
**Output:** Acting direction for each panel:
```
{
  "panel_number": 1,
  "acting": [
    {
      "character": "role name",
      "emotional_state": "emotion",
      "facial_expression": "expression",
      "body_language": "posture/movement",
      "gaze_direction": "eye direction"
    }
  ]
}
```

#### Phase 3: Detail Refiner (Sequential, Higher Timeout)
**Agent:** "Detail Refiner"
**Prompt:** `agentos/prompts/storyboard/detail_refiner.md`
**Input:** Panels + cinematography + acting + clip content
**Output:** Final Shot[] array with full details:
```json
[
  {
    "shot_number": "001",
    "shot_size": "远景|中景|近景|特写|大远景",
    "duration_seconds": 3,
    "scene_description": "complete scene description",
    "director_notes": "directing guidance",
    "audio_description": "sound design",
    "camera_angle": "平视|俯视|仰视|倾斜",
    "camera_movement": "fixed|push|pull|follow|pan|orbit",
    "focal_length": "16mm|24mm|35mm|50mm|85mm|135mm",
    "characters": ["role names"],
    "locations": ["location names"],
    "dialogues": [
      {
        "speaker": "character name",
        "text": "dialogue text",
        "type": "dialogue|narration"
      }
    ],
    "prompts": {
      "textToImage": "image generation prompt",
      "textToVideo": "video generation prompt"
    },
    "scene_type": "daily|emotion|action|epic|suspense",
    "source_text": "original quote",
    "cinematography": {
      "composition": "...",
      "lighting": "...",
      "color_palette": "...",
      "atmosphere": "..."
    },
    "acting_direction": [
      {
        "character": "...",
        "emotional_state": "...",
        ...
      }
    ]
  }
]
```

---

## LLM Configuration & Timeouts

### LLM Model Selection
**File:** `agentos/config.py`

**Standard Model (Phase 0, 1, 2a, 2b):**
```python
def get_model_from_config(llm_config: dict) -> OpenAIChat:
    timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "90"))
    max_retries = int(os.getenv("LLM_MAX_RETRIES", "2"))
    # Uses OpenAI API (or compatible provider based on base_url)
```

**Long Timeout Model (Phase 3 only):**
```python
def get_long_timeout_model(llm_config: dict) -> OpenAIChat:
    timeout = float(os.getenv("LLM_TIMEOUT_LONG_SECONDS", "180"))
    # Concatenates panels + cinematography + acting + clip content
    # Can exceed 90s on slow API providers
```

**Provider Support:**
```python
if provider == "hunyuan":
    base_url = os.getenv("HUNYUAN_OPENAPI_URL")
    api_key = os.getenv("HUNYUAN_OPENAPI_KEY")
else:  # OpenAI
    base_url = os.getenv("OPENAI_API_BASE")
    api_key = os.getenv("OPENAI_API_KEY")
```

**Role Mapping for Compatibility:**
- OpenAI (native): `role='developer'` for system prompts
- Most other providers: `role='system'` (required by Hunyuan, DeepSeek, Moonshot, etc.)
- Agno automatically handles this via `role_map` parameter

### All Timeout Settings

| Setting | File | Default | Purpose |
|---------|------|---------|---------|
| `LLM_TIMEOUT_SECONDS` | config.py | 90s | Standard LLM calls (Phase 0, 1, 2a, 2b) |
| `LLM_TIMEOUT_LONG_SECONDS` | config.py | 180s | Detail Refiner (Phase 3) with large combined prompt |
| `DETAIL_REFINER_TIMEOUT_SECONDS` | storyboard_workflow.py | 200s | ThreadPoolExecutor timeout for Phase 3 |
| `LLM_CONCURRENCY` | storyboard_workflow.py | 3 (max 10) | Parallel clips in process_clips_step |
| `WORKFLOW_TIMEOUT_MS` | storyboard.ts | 540,000ms (9min) | AgentOS HTTP call timeout |
| `SSE_TIMEOUT_MS` | config/index.ts | 55,000ms (55s) | Vercel serverless SSE stream timeout |
| `SSE_HEARTBEAT_MS` | config/index.ts | 15,000ms (15s) | Keep-alive heartbeat interval |

---

## Prompt System

### System Prompts

| Phase | File | Key Sections |
|-------|------|--------------|
| 0 | screenplay_conversion.md | Screenplay-to-clips structured conversion |
| 1 | plan_panels.md | Panel density rules, shot type selection, character name conventions |
| 2a | cinematographer.md | Composition, lighting, color palette, atmosphere |
| 2b | acting_direction.md | Emotional state, facial expression, body language, gaze |
| 3 | detail_refiner.md | Scene description integration, director notes, dialogue extraction, prompts generation |
| System | storyboard_system.md | Comprehensive system prompt for all storyboard operations |

### Key Prompt Constraints

**JSON Safety:**
- All quotes in text values must be converted to `「」` (not `""`)
- Prevents JSON parsing errors

**Panel Density:**
- ~1 panel per 15 Chinese characters
- 450 characters ≈ 30 panels

**Dialogue Handling:**
- Each dialogue line must have independent shot
- Use reverse-angle technique (speaker → listener → speaker)
- Mandatory dialogue extraction to `dialogues[]` array

**Name Normalization:**
- Use exact names from `characters_lib` and `locations_lib`
- Frontend will later replace with asset descriptions

---

## Data Flow: Result Processing

### 7. Result Flow Back to Frontend

```
AgentOS returns JSON:
{
  "projectId": "proj-123",
  "scenes": [
    {
      "title": "scene title",
      "summary": "scene summary",
      "shots": [ ... ]  // Array of Shot objects from Phase 3
    }
  ]
}
    ↓
Backend stores in Task record (status: 'completed')
    ↓
Frontend polls GET /api/tasks/{taskId}
    ↓
Receives result: { taskId, status, progress, result }
    ↓
Converts to FrameData[] via storyboardJsonToFrames()
    ↓
Saves to database via saveStoryboardData()
    ├─ Persists to Prisma: prisma.storyboard
    └─ Also stored locally in localStorage: storyboard_{projectId}
```

### 8. Storyboard Data Persistence
**File:** `server/src/services/storyboard-data.service.ts`

**FrameData Interface:**
```typescript
interface FrameData {
  id: string;
  order: number;
  title: string;
  sceneType?: 'INT.' | 'EXT.';
  timeOfDay?: '日' | '夜';
  description: string;
  bulletPoints: string[];
  image?: { id, url, source, createdAt };
  // Shot-level fields from AgentOS:
  shot_number?: string;
  shot_size?: string;
  duration_seconds?: number;
  scene_description?: string;
  director_notes?: string;
  audio_description?: string;
  camera_angle?: string;
  camera_movement?: string;
  focal_length?: string;
  // Enrichment fields:
  characters?: string[];
  locations?: string[];
  dialogues?: Dialogue[];
  prompts?: FramePrompts; // { textToImage, textToVideo, imageGuided }
}
```

**API Endpoints:**
- `GET /api/projects/{projectId}/storyboard-data` → Fetch all frames
- `PUT /api/projects/{projectId}/storyboard-data/frames/{frameId}` → Update single frame
- `PUT /api/projects/{projectId}/storyboard/frames/{frameId}/image` → Attach generated image
- `DELETE /api/projects/{projectId}/storyboard/frames/{frameId}/image` → Remove image

---

## Error Handling & Resilience

### Task Status States
```
'queued' → 'processing' → 'completed'
                      ↘ 'failed'
```

### Error Response Format
```typescript
{
  error: {
    code: 'GENERATION_ERROR' | 'INVALID_INPUT' | etc.,
    message: "detailed error message",
    retryable: true | false
  }
}
```

### Failure Scenarios

| Scenario | Handling |
|----------|----------|
| Invalid text input | Return 400, ErrorCode.INVALID_INPUT (retryable: false) |
| LLM API key missing | Return 400 from `getLLMHeaders()` |
| AgentOS timeout (>9min) | Catch `AbortError`, return UPSTREAM_TIMEOUT (retryable: true) |
| Screenplay conversion fails | Fallback to single clip with full text |
| Phase 2a/2b timeout (>120s) | Log warning, use empty array as fallback |
| Phase 3 timeout (>200s) | Log warning, use raw panels as fallback |
| JSON parse error | Return 502, INTERNAL_ERROR (retryable: true) |

---

## Key Configuration Files

### Environment Variables
**Backend (server/.env):**
```
AGENTOS_BASE_URL=http://localhost:12322
AGENTOS_SECURITY_KEY=...
DATABASE_URL=postgresql://...
SSE_TIMEOUT_MS=55000
```

**AgentOS (agentos/.env):**
```
LLM_TIMEOUT_SECONDS=90
LLM_TIMEOUT_LONG_SECONDS=180
DETAIL_REFINER_TIMEOUT_SECONDS=200
LLM_CONCURRENCY=3
LLM_MAX_RETRIES=2
AI_PROVIDER=openai|hunyuan
OPENAI_API_KEY=...
HUNYUAN_OPENAPI_URL=...
```

### Deployment Notes

**Vercel Constraints:**
- Function timeout: 60 seconds (Hobby tier)
- SSE timeout: 55 seconds (5s safety margin)
- → Use polling for long-running tasks instead of SSE

**AgentOS Deployment:**
- Can run on separate host/container
- Receives LLM credentials via request headers (`X-LLM-*`)
- Allows per-request LLM provider selection

---

## API Quick Reference

### User-Facing Endpoints

```
POST /api/projects/{projectId}/storyboard/import
  Request: { text: "drama script..." }
  Response: 202 { taskId: "..." }
  
GET /api/tasks/{taskId}
  Response: { taskId, status, progress, result, error, estimatedSeconds }

GET /api/projects/{projectId}/storyboard-data
  Response: FrameData[]

PUT /api/projects/{projectId}/storyboard-data/frames/{frameId}
  Request: Partial<FrameData>
  Response: { success: true }

POST /api/projects/{projectId}/characters/extract
  Request: { text: "..." }
  Response: CharacterData[]

POST /api/projects/{projectId}/locations/extract
  Request: { text: "..." }
  Response: LocationData[]
```

### Internal AgentOS Endpoints

```
POST /workflows/storyboardworkflow/runs
  Form params: { message: JSON, stream: "true"|"false" }
  Response: { content: JSON string } or SSE stream

POST /api/generate-image
  Body: { prompt, mode, size, watermark, max_images, ... }
  Response: { success, images: [{ url, width, height }] }
```

---

## Streaming (Alternative Pattern)

**Supported but not used for storyboard import** (async polling preferred):

```
POST /api/projects/{projectId}/storyboard/import?stream=true
  → Would return SSE stream of progress events
  
GET /api/projects/{projectId}/characters/extract/stream?text=...
  → Used for character extraction (real SSE implementation)
```

**SSE Event Types:**
- `progress` — { percent, message }
- `data` — Chunk of response data
- `done` — { content: final result }
- `error` — { message }
- `timeout` — { sessionId, cursor, message }
- `heartbeat` — { ts }

---

## Testing & Debugging

### Test Files
- `agentos/tests/test_workflows.py` — Unit tests for workflows
- `agentos/tests/test_storyboard_v2.py` — Storyboard v2 integration tests
- `e2e/content-generation.spec.ts` — E2E tests for full pipeline

### Evaluation
- `agentos/tools/eval_storyboard.py` — Quality evaluation script

### Local Development
```bash
# Full stack
npm run dev

# Individual services
npm run dev -w @dramo/web           # Port 12323
npm run dev -w @dramo/server        # Port 12321
cd agentos && python app.py         # Port 12322
```

---

## Performance Characteristics

| Phase | Typical Duration | Parallelizable |
|-------|------------------|-----------------|
| 0 (Screenplay) | 10-15s | No |
| 1 (Plan Panels) | 20-30s/clip | Yes (via LLM_CONCURRENCY) |
| 2a (Cinematographer) | 15-25s/clip | Yes (2 workers per clip) |
| 2b (Acting Direction) | 15-25s/clip | Yes (2 workers per clip) |
| 3 (Detail Refiner) | 30-50s/clip | No |
| Merge | <1s | No |
| **Total (1 clip)** | ~120-150s | ~2x speedup with parallelization |
| **Total (3 clips @ LLM_CONCURRENCY=3)** | ~180-220s | ~2.5x speedup |

---

## Summary: Key Takeaways

1. **Async Pattern:** Backend immediately returns task ID; frontend polls for completion
2. **4-Phase Pipeline:** Screenplay → Panels → (Photography ‖ Acting) → Detail Assembly
3. **Parallelization:** Multiple clips processed concurrently; within each clip, Phase 2a+2b run in parallel
4. **Timeout Strategy:** Tiered timeouts (90s → 180s → 200s) for different LLM call complexity
5. **Resilience:** Graceful fallbacks at each phase; failures don't cascade
6. **Flexibility:** Supports OpenAI, Hunyuan, and other OpenAI-compatible providers per-request
7. **Data Model:** Complete shot information (cinematography, acting, dialogues, generation prompts) persisted to database

