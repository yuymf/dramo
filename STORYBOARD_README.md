# Dramo Storyboard Flow Documentation

## 📖 Overview

This documentation provides a complete analysis of the **"Script to Storyboard" (剧本到分镜)** AI flow in the Dramo project—a sophisticated 4-phase pipeline that converts raw drama scripts into detailed, cinematically-rich storyboards with AI-generated metadata.

---

## 📚 Documentation Files

### 1. **STORYBOARD_QUICK_REFERENCE.md** ⭐ START HERE
**Time to read: 5-10 minutes**

A quick reference guide with:
- Key files organized by layer (Frontend, Backend, AgentOS)
- Timeout quick reference table
- Request/response flow examples
- Shot object data structure
- Debug commands and common issues
- Performance optimization tips

**Best for:** Quick lookups, debugging, getting oriented

---

### 2. **STORYBOARD_FLOW_DIAGRAM.txt**
**Time to read: 10 minutes**

Visual ASCII representation of the entire flow:
- 3-layer architecture diagram
- 4-phase pipeline with parallelization
- Timeout hierarchy
- Concurrency model
- Error resilience patterns

**Best for:** Understanding the architecture visually, presentations

---

### 3. **STORYBOARD_FLOW_ANALYSIS.md** 
**Time to read: 30-45 minutes**

Comprehensive 1000+ line reference covering:
- Complete user flow walkthrough
- Backend API layer details
- AgentOS Python workflow deep dive
- All 4 phases + merge step
- LLM configuration & timeouts
- Prompt system architecture
- Data persistence patterns
- Error handling & resilience
- Configuration reference
- API quick reference
- Streaming patterns
- Testing & debugging
- Performance characteristics

**Best for:** Deep understanding, implementation details, troubleshooting

---

## 🎯 How to Use This Documentation

### If you're **new to the codebase:**
1. Read **STORYBOARD_QUICK_REFERENCE.md** (10 min)
2. Review **STORYBOARD_FLOW_DIAGRAM.txt** (10 min)
3. Then dive into **STORYBOARD_FLOW_ANALYSIS.md** for details

### If you need to **modify timeout settings:**
1. Go to STORYBOARD_QUICK_REFERENCE.md → "⏱️ Timeout Quick Reference" section
2. Find the timeout in the table
3. Reference the file path
4. Cross-check in STORYBOARD_FLOW_ANALYSIS.md for context

### If you're **debugging a problem:**
1. Check STORYBOARD_QUICK_REFERENCE.md → "❌ Common Issues & Fixes" section
2. If not found, search in STORYBOARD_FLOW_ANALYSIS.md for error handling patterns

### If you're **implementing a feature:**
1. Find the relevant phase in STORYBOARD_FLOW_ANALYSIS.md
2. Reference the prompt system section
3. Check configuration examples

---

## 🔑 Key Architectural Patterns

### Async Fire-and-Forget
```
Frontend → POST /api/projects/{id}/storyboard/import
         → Backend returns 202 + taskId
         → Frontend polls GET /api/tasks/{taskId}
         → Background job processes independently
```

### Multi-Phase Pipeline
```
Phase 0: Screenplay Conversion (90s)
Phase 1: Plan Panels (90s/clip)
Phase 2a: Cinematography (120s/clip) [PARALLEL]
Phase 2b: Acting Direction (120s/clip) [PARALLEL]  
Phase 3: Detail Refiner (200s/clip with 180s LLM)
Phase 4: Merge & finalize
```

### Parallelization
- **Outer loop:** Up to `LLM_CONCURRENCY` clips in parallel (default 3, max 10)
- **Inner loop (Phase 2):** Cinematography + Acting Direction run in parallel (2 workers)
- **Result:** ~2.5x speedup for multi-clip scripts

### Tiered Timeouts
- Phase 0-2: 90s LLM calls
- Phase 3: 180s LLM + 200s executor (complex prompt with all previous context)
- Backend→AgentOS: 540s (9 minutes)
- Frontend SSE: 55s (safety margin for Vercel 60s limit)

### Graceful Degradation
- Phase failures don't cascade
- Missing Phase 2a/2b output → Use empty array, continue
- Missing Phase 3 output → Use raw panels as fallback
- No user-facing crashes from intermediate failures

---

## 📂 File Structure Quick Map

```
server/src/
  ├─ routes/storyboard.ts          [Main endpoint: POST import]
  ├─ lib/
  │  ├─ agentos-client.ts          [HTTP call to AgentOS]
  │  └─ config/index.ts            [SSE timeout config]
  ├─ services/
  │  ├─ storyboard-data.service.ts [Database persistence]
  │  └─ task.service.ts            [Task tracking]

agentos/
  ├─ workflows/storyboard_workflow.py  [4-phase pipeline]
  ├─ config.py                        [LLM timeout config]
  └─ prompts/storyboard/
     ├─ plan_panels.md               [Phase 1 prompt]
     ├─ cinematographer.md           [Phase 2a prompt]
     ├─ acting_direction.md          [Phase 2b prompt]
     └─ detail_refiner.md            [Phase 3 prompt]

web/
  └─ app/projects/[id]/@content/storyboard/
     ├─ handlers.ts                  [Event handling]
     └─ page.tsx                     [UI rendering]
```

---

## ⚙️ Configuration Reference

| Setting | File | Default | Purpose |
|---------|------|---------|---------|
| `LLM_TIMEOUT_SECONDS` | agentos/config.py | 90s | Standard LLM calls |
| `LLM_TIMEOUT_LONG_SECONDS` | agentos/config.py | 180s | Phase 3 LLM |
| `DETAIL_REFINER_TIMEOUT_SECONDS` | agentos/workflows/storyboard_workflow.py | 200s | Phase 3 executor |
| `LLM_CONCURRENCY` | agentos/workflows/storyboard_workflow.py | 3 | Parallel clips (max 10) |
| `WORKFLOW_TIMEOUT_MS` | server/src/routes/storyboard.ts | 540,000ms | Backend→AgentOS |
| `SSE_TIMEOUT_MS` | server/src/config/index.ts | 55,000ms | Vercel safety margin |

---

## 🔍 Key Concepts

### Shot Object
A rich data structure representing a single camera shot:
```typescript
{
  shot_number, shot_size, duration_seconds,
  scene_description, director_notes, audio_description,
  camera_angle, camera_movement, focal_length,
  characters[], locations[], dialogues[],
  prompts: { textToImage, textToVideo },
  cinematography: { composition, lighting, color_palette, atmosphere },
  acting_direction: { emotional_state, facial_expression, body_language, gaze }
}
```

### Clip
A structured segment of the original script:
- `clip_id`, `summary`, `location`
- `content[]` array (action, dialogue, voiceover entries)
- Gets processed through all 4 phases to produce shot[]

### Task
A database record tracking async storyboard generation:
- Status: queued → processing → completed (or failed)
- Progress: 0-100%
- Result: final storyboard JSON when complete

---

## 🚀 Quick Start Commands

```bash
# Full stack
npm run dev

# Individual services
npm run dev -w @dramo/web           # Port 12323
npm run dev -w @dramo/server        # Port 12321
cd agentos && python app.py         # Port 12322

# Run tests
cd agentos && python -m pytest tests/test_storyboard_v2.py -v
npm run test:e2e -- content-generation.spec.ts

# Check LLM concurrency setting
echo $LLM_CONCURRENCY  # Default: 3
```

---

## 🔐 Security Notes

1. **BOLA Prevention:** Backend verifies project ownership before processing
2. **LLM Credentials:** Sent per-request via headers (`X-LLM-*`), not stored
3. **Error Messages:** Never leak sensitive data
4. **Database Isolation:** All data scoped to authenticated user

---

## 📊 Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Single clip (serial) | 120-150s | All phases sequential |
| Single clip (optimal) | 80-100s | Phase 2a+2b parallel (~1.5x speedup) |
| 3 clips (LLM_CONCURRENCY=3) | 180-220s | Outer loop parallelization (~2.5x total) |
| Phase 0 (screenplay conversion) | 10-15s | Depends on script length |
| Phase 1 (plan_panels) | 20-30s/clip | Panel density ~1 per 15 chars |
| Phase 2a (cinematography) | 15-25s/clip | In parallel |
| Phase 2b (acting_direction) | 15-25s/clip | In parallel |
| Phase 3 (detail_refiner) | 30-50s/clip | Sequential (longest phase) |

---

## 📞 Search Keywords

If you need to find something in the code, search for:

- `分镜`, `storyboard`, `script_to_storyboard`
- `StoryboardWorkflow`, `storyboard_workflow.py`
- `plan_panels`, `cinematographer`, `acting_direction`, `detail_refiner`
- `LLM_CONCURRENCY`, `DETAIL_REFINER_TIMEOUT_SECONDS`
- `startWorkflowRun('storyboardworkflow')`
- `/storyboard/import`, `/api/tasks/`

---

## 🎓 Related Patterns

The storyboard flow uses similar patterns to other async operations:
- Character extraction: `/api/projects/{projectId}/characters/extract`
- Location extraction: `/api/projects/{projectId}/locations/extract`
- Script polishing: `/api/projects/{projectId}/polish`
- Image generation: `generation-job.service.ts`

---

## 📝 Notes for Maintainers

### If you need to modify timeouts:
- Verify changes in both **env variables** AND **code defaults**
- Test with various script lengths (short, medium, long)
- Consider Vercel limits (60s function timeout)

### If you add a new phase:
- Follow the `ThreadPoolExecutor` pattern in Phase 2a/2b
- Add appropriate timeout configuration
- Update fallback logic in Phase 3

### If you modify prompts:
- Test with diverse script types
- Verify JSON output format (all quotes must be `「」`)
- Check prompt token count (Phase 3 combines all previous context)

---

## ✨ Document Maintenance

These documents were generated through:
1. Codebase-wide search for storyboard-related keywords
2. API route analysis
3. Configuration file extraction
4. Workflow definition review
5. Prompt template collection
6. Timeout setting compilation

**Last Updated:** March 31, 2026

---

**Start reading:** [STORYBOARD_QUICK_REFERENCE.md](./STORYBOARD_QUICK_REFERENCE.md)
