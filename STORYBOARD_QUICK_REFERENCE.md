# Dramo Storyboard Flow: Quick Reference Guide

## 🎬 What is the Storyboard Flow?

Converts a drama script text into a detailed, shot-by-shot JSON storyboard with cinematography, acting direction, and generation prompts for AI image/video creation.

---

## 🗂️ Key Files to Know

### Frontend (Next.js)
```
web/app/api/projects/[projectId]/storyboard/import/route.ts
  ↳ POST endpoint: Submits drama text

web/app/projects/[id]/@content/storyboard/handlers.ts
  ↳ useStoryboardHandlers(): UI event handling
  
web/app/projects/[id]/@content/storyboard/page.tsx
  ↳ UI rendering for storyboard display
```

### Backend API (Hono/TypeScript)
```
server/src/routes/storyboard.ts
  ↳ POST /api/projects/{projectId}/storyboard/import (main endpoint)
  ↳ executeStoryboardImport() (background job)

server/src/lib/agentos-client.ts
  ↳ startWorkflowRun() (HTTP call to AgentOS)

server/src/services/storyboard-data.service.ts
  ↳ saveStoryboard(), getStoryboard() (database persistence)

server/src/services/task.service.ts
  ↳ createTask(), updateTask() (progress tracking)

server/src/config/index.ts
  ↳ Timeout configuration (SSE_TIMEOUT_MS, etc.)
```

### AgentOS (Python)
```
agentos/workflows/storyboard_workflow.py
  ↳ StoryboardWorkflow class
  ↳ 4-phase pipeline: prepare → process_clips → merge

agentos/prompts/storyboard/
  ├─ plan_panels.md (Phase 1)
  ├─ cinematographer.md (Phase 2a)
  ├─ acting_direction.md (Phase 2b)
  └─ detail_refiner.md (Phase 3)

agentos/config.py
  ↳ get_model_from_config() (standard LLM, 90s timeout)
  ↳ get_long_timeout_model() (Phase 3 LLM, 180s timeout)
```

---

## ⏱️ Timeout Quick Reference

| Layer | Timeout | File | Purpose |
|-------|---------|------|---------|
| **Browser** | 60s | Vercel Hobby | Browser request timeout |
| **SSE Stream** | 55s | `config/index.ts` | Safety margin for Vercel |
| **Backend→AgentOS** | 540s (9min) | `storyboard.ts` | Full pipeline HTTP call |
| **LLM Standard** | 90s | `config.py` | Phase 0, 1, 2a, 2b |
| **LLM Long** | 180s | `config.py` | Phase 3 only |
| **Phase 3 Executor** | 200s | `storyboard_workflow.py` | Thread executor timeout |

---

## 🔄 Request/Response Flow

### 1️⃣ Frontend Submits
```
POST /api/projects/{projectId}/storyboard/import
{
  "text": "drama script text..."
}
```

### 2️⃣ Backend Responds Immediately
```
202 Accepted
{
  "taskId": "task-uuid-here"
}
```
*Backend starts async background job → frontend gets taskId to poll*

### 3️⃣ Frontend Polls Task Status
```
GET /api/tasks/{taskId}
```

Response (while processing):
```
{
  "taskId": "task-uuid",
  "status": "processing",
  "progress": 45,
  "estimatedSeconds": 300
}
```

Response (on completion):
```
{
  "taskId": "task-uuid",
  "status": "completed",
  "progress": 100,
  "result": {
    "projectId": "...",
    "scenes": [
      {
        "title": "Scene 1",
        "summary": "...",
        "shots": [ /* Shot objects */ ]
      }
    ]
  }
}
```

---

## 🧠 4-Phase Pipeline (AgentOS)

### Phase 0: Screenplay Conversion
- **Agent:** "Screenplay Converter"
- **Input:** Raw drama text
- **Output:** `clips[]` (structured segments)
- **Timeout:** 90s

### Phase 1: Plan Panels (Per Clip)
- **Agent:** "Panel Planner"
- **Input:** Clip JSON + character/location library
- **Output:** `panels[]` (draft shots)
- **Density:** ~1 panel per 15 Chinese characters
- **Timeout:** 90s per clip

### Phase 2a: Cinematography (Parallel, Per Clip)
- **Agent:** "Cinematographer"
- **Input:** `panels[]`
- **Output:** Composition, lighting, color, atmosphere
- **Timeout:** 120s per clip

### Phase 2b: Acting Direction (Parallel, Per Clip)
- **Agent:** "Acting Director"
- **Input:** `panels[]`
- **Output:** Emotional state, facial expression, body language
- **Timeout:** 120s per clip

### Phase 3: Detail Refiner (Per Clip)
- **Agent:** "Detail Refiner"
- **Input:** panels + cinematography + acting + clip content
- **Output:** Final `shots[]` with all details
- **Timeout:** 200s per clip (with 180s LLM call timeout)

### Phase 4: Merge
- Merge all scenes globally
- Renumber shots sequentially
- Return final JSON

---

## 📊 Shot Object Structure

```typescript
{
  // Identifiers
  "shot_number": "001",
  "scene_type": "daily|emotion|action|epic|suspense",
  "source_text": "original quote from script",
  
  // Framing
  "shot_size": "远景|中景|近景|特写|大远景",
  "duration_seconds": 3,
  "camera_angle": "平视|俯视|仰视|倾斜",
  "camera_movement": "fixed|push|pull|follow|pan|orbit",
  "focal_length": "35mm|50mm|85mm|etc",
  
  // Content
  "scene_description": "visual details",
  "director_notes": "performance guidance",
  "audio_description": "sound design",
  
  // Semantic data
  "characters": ["character names"],
  "locations": ["location names"],
  "dialogues": [
    { "speaker": "name", "text": "...", "type": "dialogue" }
  ],
  
  // AI generation prompts
  "prompts": {
    "textToImage": "image generation prompt",
    "textToVideo": "video description"
  },
  
  // Detailed metadata
  "cinematography": {
    "composition": "...",
    "lighting": "...",
    "color_palette": "...",
    "atmosphere": "..."
  },
  "acting_direction": [
    {
      "character": "name",
      "emotional_state": "...",
      "facial_expression": "...",
      "body_language": "...",
      "gaze_direction": "..."
    }
  ]
}
```

---

## ⚙️ Configuration (Environment Variables)

### Backend (server/.env)
```
AGENTOS_BASE_URL=http://localhost:12322
AGENTOS_SECURITY_KEY=...
SSE_TIMEOUT_MS=55000
SSE_HEARTBEAT_MS=15000
```

### AgentOS (agentos/.env)
```
LLM_TIMEOUT_SECONDS=90
LLM_TIMEOUT_LONG_SECONDS=180
DETAIL_REFINER_TIMEOUT_SECONDS=200
LLM_CONCURRENCY=3
LLM_MAX_RETRIES=2
AI_PROVIDER=openai|hunyuan
OPENAI_API_KEY=...
OPENAI_API_BASE=...
```

---

## 🔍 How to Debug

### Check Task Status
```bash
# In browser console or API client:
fetch('/api/tasks/task-id').then(r => r.json()).then(console.log)
```

### View Backend Logs
```bash
# Terminal where backend is running:
npm run dev -w @dramo/server
```

### View AgentOS Logs
```bash
# Terminal where AgentOS is running:
cd agentos && python app.py
```

### Test Storyboard Flow Locally
```bash
# Full stack:
npm run dev

# Individual services:
npm run dev -w @dramo/web           # Port 12323
npm run dev -w @dramo/server        # Port 12321
cd agentos && python app.py         # Port 12322
```

---

## 🚀 Performance Tips

| Action | Effect |
|--------|--------|
| Increase `LLM_CONCURRENCY` from 3 to 5+ | Process more clips in parallel (if API can handle it) |
| Decrease `DETAIL_REFINER_TIMEOUT_SECONDS` | Fail faster on slow Phase 3, use panel fallback |
| Use faster LLM model | Reduce overall latency |
| Pre-extract characters/locations | Provide richer context to LLM |
| Shorter input script | Fewer clips = faster processing |

---

## ❌ Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Storyboard import failed" | Missing LLM API key | Check `X-LLM-Api-Key` header in request |
| Task stuck at 10% progress | AgentOS unreachable | Verify `AGENTOS_BASE_URL` and health check |
| Empty shots in result | Phase 3 timed out | Increase `DETAIL_REFINER_TIMEOUT_SECONDS` |
| Frontend never polls task | Task creation failed | Check project ownership (BOLA prevention) |
| JSON parsing error | Invalid AgentOS response | Check AgentOS logs for LLM errors |

---

## 📝 Testing

### Unit Tests
```bash
cd agentos && python -m pytest tests/test_workflows.py -v
```

### Integration Tests
```bash
cd agentos && python -m pytest tests/test_storyboard_v2.py -v
```

### E2E Tests
```bash
npm run test:e2e -- content-generation.spec.ts
```

---

## 🔐 Security Notes

- **BOLA Prevention:** Backend verifies project ownership before starting storyboard import
- **LLM Credentials:** Passed per-request via headers (`X-LLM-*`), not stored on AgentOS
- **SSE Heartbeat:** Prevents connection timeout; client auto-reconnects on disconnect
- **Error Messages:** Never leak sensitive data (API keys, internal error details)

---

## 📚 Related Flows

**Similar async patterns used for:**
- Character extraction: `POST /api/projects/{projectId}/characters/extract`
- Location extraction: `POST /api/projects/{projectId}/locations/extract`
- Script polishing: `POST /api/projects/{projectId}/polish`
- Image generation: Background job via `generation-job.service.ts`

