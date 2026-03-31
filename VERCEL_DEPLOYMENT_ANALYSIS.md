# Dramo Vercel Deployment Analysis: Can a 3-5 Minute AI Pipeline Survive?

## Executive Summary

**SHORT ANSWER: ❌ NO — Not with Vercel's free tier, but YES with Pro tier or alternative deployment.**

### Key Finding
- **Vercel Free Tier**: 60 second max function duration → **Cannot support 3-5 minute pipelines**
- **Vercel Pro Tier**: 900 second (15 minute) max duration → **Sufficient for 3-5 minute pipelines**
- **Current Architecture**: Already optimized with fire-and-forget + polling pattern to work around this limitation
- **Problem**: Storyboard import endpoint waits ~9 minutes for AgentOS response on Vercel, which **will timeout**

---

## 1. Vercel Timeout Configuration

### Current Setup in `server/vercel.json`

```json
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 60,
      "includeFiles": "dist/**"
    }
  }
}
```

**Issue**: `maxDuration: 60` seconds is **hardcoded to Vercel Free tier limit**

### Vercel Pricing Plans (2026)

| Plan | Max Duration | Cost |
|------|-------------|------|
| **Free/Hobby** | 60 seconds | $0 |
| **Pro** | 900 seconds (15 min) | $20/month |
| **Enterprise** | Unlimited (within reason) | Custom |

**Critical**: The `.env.production` points to Vercel deployment but timeouts aren't configured for Pro tier.

---

## 2. Current Architecture: Fire-and-Forget + Polling

### Problem Decomposition

Dramo **already recognizes the Vercel timeout problem** and implements a workaround:

#### Pattern 1: Async Task-Based (Storyboard Import)
**File**: `server/src/routes/storyboard.ts`

```typescript
const WORKFLOW_TIMEOUT_MS = 540_000;  // 9 minutes ⚠️

// Route handler returns immediately (202 Accepted)
storyboard.post('/api/projects/:projectId/storyboard/import', async (c) => {
  // Create task in database
  const task = await taskService.createTask({
    type: 'storyboard_import',
    userId,
    estimatedSeconds: 300,  // 5 minutes
  });

  // Fire-and-forget background execution
  executeStoryboardImport(task.id, {...}).catch(err => {
    logger.error('Background task failed');
  });

  // Return immediately with task ID
  return c.json({ taskId: task.id }, 202);
});

// Client polls this endpoint
tasks.get('/api/tasks/:taskId', async (c) => {
  const task = await taskService.getTask(taskId, userId);
  return c.json({
    status: task.status,  // 'queued' → 'processing' → 'completed'/'failed'
    progress: task.progress,
    result: task.result,
    error: task.error,
  });
});
```

**Problem**: The `executeStoryboardImport()` function calls:
```typescript
const response = await startWorkflowRun('storyboardworkflow', {
  projectId, text, characters_lib, locations_lib
}, { 
  llmHeaders, 
  timeoutMs: WORKFLOW_TIMEOUT_MS  // 540s = 9 minutes!
});
```

**When deployed to Vercel's background function**, this will **timeout after 60 seconds** (or 900s on Pro).

---

#### Pattern 2: SSE Streaming (Chat, Characters, Locations)
**Files**: `server/src/routes/chat.ts`, `server/src/routes/characters.ts`

```typescript
// SSE streaming with 55s safety margin
chat.post('/api/chat/:projectId/messages', async (c) => {
  if (body.stream) {
    async function* generateSSE(): AsyncGenerator<SSEEvent> {
      const response = await startWorkflowRun('ChatWorkflow', {
        messages,
        stream: true,
      }, { requestId, stream: true, llmHeaders });

      // Client receives chunks in real-time
      for await (const event of parseAgentOSSSE(response)) {
        yield event;
      }
    }
    return streamSSEResponse(c, generateSSE());  // Streams to client
  }
});
```

**This pattern WORKS** because:
- Client stays connected while streaming
- Server sends heartbeats every 15s to keep connection alive
- Config: `sseTimeoutMs: 55000` (55 seconds)
  - **5 second safety margin** from Vercel's 60s limit
  - SSE terminates gracefully before timeout
  - Client can reconnect with session ID to resume

**Configuration** (`server/src/config/index.ts`):
```typescript
sseTimeoutMs: safeParseInt(process.env.SSE_TIMEOUT_MS, 55000),  // 55s
sseHeartbeatMs: safeParseInt(process.env.SSE_HEARTBEAT_MS, 15000),  // 15s
```

---

## 3. The Critical Problem: Storyboard Import on Vercel

### Current Behavior (Broken on Vercel Free)

```
Client POST /api/projects/:id/storyboard/import
  ↓
[Vercel Function: 0-60 seconds]
  ├─ ✅ Create Task (quick)
  ├─ 🔥 Fire-and-forget executeStoryboardImport()
  └─ ✅ Return 202 with taskId (fast)
  ↓
[Vercel Function Container dies after 60s]
  ├─ executeStoryboardImport() is STILL RUNNING (180-300s needed)
  ├─ Container gets killed by Vercel
  └─ ❌ Task gets abandoned with no error update
  ↓
Client polls GET /api/tasks/:taskId
  └─ Task status stuck in 'processing' forever (no error)
```

### Why This Happens

Vercel's serverless model **does not provide true background workers**:
- Function execution = HTTP request handling
- When HTTP response is sent, container can be suspended/terminated
- Fire-and-forget tasks don't survive if they extend beyond function timeout
- Unlike AWS Lambda SQS or BullMQ workers, there's **no persistent background queue**

### Proof in Code

**`server/src/routes/storyboard.ts:38-105`**:
```typescript
async function executeStoryboardImport(
  taskId: string,
  params: { projectId, userId, text, llmHeaders }
): Promise<void> {
  try {
    // This runs AFTER the HTTP response is sent
    // On Vercel, it gets killed if >60s

    await taskService.updateTask(taskId, { status: 'processing' });

    // Fetch project assets
    const [charactersLib, locationsLib] = await fetchProjectAssets(params.projectId);

    // ⏱️ Call AgentOS with 9-minute timeout (WILL TIMEOUT ON VERCEL)
    const response = await startWorkflowRun('storyboardworkflow', {
      projectId: params.projectId,
      text: params.text,
      characters_lib: charactersLib,
      locations_lib: locationsLib,
    }, { llmHeaders: params.llmHeaders, timeoutMs: WORKFLOW_TIMEOUT_MS });

    // Parse result, update task
    const result = (await response.json()) as { content?: string };
    const storyboardData = JSON.parse(result.content);

    await taskService.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      result: storyboardData,
    });
  } catch (error) {
    // Error handling won't execute if container is killed
    await taskService.updateTask(taskId, { status: 'failed', error });
  }
}
```

---

## 4. AgentOS Deployment Architecture

### Current Setup

**`docker-compose.yml`**:
```yaml
agentos:
  build: ./agentos
  ports:
    - "12322:12322"
  environment:
    PORT: 12322
    LLM_TIMEOUT_LONG_SECONDS: 180      # 3 minutes
    DETAIL_REFINER_TIMEOUT_SECONDS: 200 # 3.3 minutes
```

**`agentos/Dockerfile`**:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py . workflows/ services/
EXPOSE 12322
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "12322"]
```

### Key Observations

1. **AgentOS is independently deployed** (separate from Vercel)
   - Local dev: `http://localhost:12322`
   - Production: `AGENTOS_BASE_URL=https://agentos.dramo.ai`
   
2. **AgentOS is NOT on Vercel**
   - Likely on Docker/Kubernetes/VM that supports long-running processes
   - Can handle 3-5 minute storyboard pipelines natively
   
3. **TS API calls AgentOS via HTTP**
   ```typescript
   // server/src/lib/agentos-client.ts:36
   const timeoutMs = opts?.timeoutMs ?? 55000;  // Default 55s
   
   // But storyboard.ts overrides:
   const response = await startWorkflowRun(..., 
     { timeoutMs: WORKFLOW_TIMEOUT_MS }  // 540s = 9 min
   );
   ```

4. **Problem**: TS API waits for AgentOS response
   - On Vercel Free: 60s limit → can't wait for 9-minute response
   - On Vercel Pro: 900s limit → can wait up to 15 minutes ✅

---

## 5. Recommended Solutions

### Option A: Upgrade to Vercel Pro (Simplest, $20/month)

**Pros:**
- No code changes needed
- 15-minute max duration sufficient for 3-5 min pipelines (5x buffer)
- Keep current architecture

**Cons:**
- $20/month per project
- Still won't help if pipeline exceeds 15 minutes

**Implementation:**
```json
// server/vercel.json
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 900  // 15 minutes (Pro tier)
    }
  }
}
```

---

### Option B: True Background Task Queue (Best Long-term)

**Architecture:**
```
Vercel Free (TS API)
  ↓ POST /import → Create task (quick)
  ↓ Return 202
  
[Separate Worker Infrastructure]
  ← Listen to task queue (BullMQ, Inngest, etc.)
  ← Execute storyboard workflow (9 minutes OK)
  ← Update task status in DB
```

**Implementation Choices:**

#### B1: Inngest (Recommended)
- Serverless background jobs platform
- Free tier: 10k invocations/month
- Handles retries, scheduling, monitoring
- Easy Vercel integration

```typescript
// server/src/routes/storyboard.ts (NEW)
import { inngest } from '../lib/inngest';

storyboard.post('/api/projects/:projectId/storyboard/import', async (c) => {
  const task = await taskService.createTask({...});
  
  // Queue background job (returns immediately)
  await inngest.send({
    name: 'storyboard/import',
    data: { taskId: task.id, projectId, userId, text },
  });
  
  return c.json({ taskId: task.id }, 202);
});

// Background handler (runs for 9+ minutes, separate container)
export const importStoryboard = inngest.createFunction(
  { id: 'storyboard-import', timeout: '15m' },
  { event: 'storyboard/import' },
  async ({ event }) => {
    const { taskId, projectId, userId, text } = event.data;
    
    await taskService.updateTask(taskId, { status: 'processing' });
    
    // 9-minute workflow (WILL NOT TIMEOUT)
    const response = await startWorkflowRun(..., 
      { timeoutMs: 540_000 }
    );
    
    await taskService.updateTask(taskId, { 
      status: 'completed',
      result: storyboardData 
    });
  }
);
```

#### B2: Redis + Worker (Self-hosted)
- BullMQ on Redis
- Separate Node.js worker processes
- Self-managed infrastructure
- ✅ Already in production, could extend

```typescript
// server/src/routes/storyboard.ts
import { importQueue } from '../lib/queue';

storyboard.post('/api/projects/:projectId/storyboard/import', async (c) => {
  const task = await taskService.createTask({...});
  
  // Enqueue job
  await importQueue.add('import', {
    taskId: task.id,
    projectId, userId, text
  });
  
  return c.json({ taskId: task.id }, 202);
});

// Separate worker process (workers/storyboard-importer.ts)
importQueue.process(async (job) => {
  const { taskId, projectId, userId, text } = job.data;
  // ... 9-minute workflow ...
});
```

#### B3: AWS Lambda SQS (Enterprise)
- Lambda can run for 15 minutes max
- SQS for reliable job queuing
- Scales automatically

---

### Option C: Stream + Checkpoint Recovery (Hybrid)

**Idea**: Modify storyboard import to stream progress back to client

```typescript
// server/src/routes/storyboard.ts
storyboard.post('/api/projects/:projectId/storyboard/import/stream', async (c) => {
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const body = await c.req.json();

  async function* generateSSE(): AsyncGenerator<SSEEvent> {
    const task = await taskService.createTask({
      type: 'storyboard_import',
      input: { projectId, text: body.text },
      estimatedSeconds: 300,
    });

    yield { event: 'data', data: { taskId: task.id, status: 'queued' } };

    try {
      // This still runs in Vercel function (60s limit)
      // But now client has sessionId for reconnection
      
      await taskService.updateTask(task.id, { status: 'processing' });
      yield { event: 'progress', data: { percent: 15 } };

      const response = await startWorkflowRun(..., { stream: true });
      
      for await (const event of parseAgentOSSSE(response)) {
        if (isApproachingTimeout(session)) {
          // Send partial result + session info for resume
          yield {
            event: 'timeout',
            data: {
              sessionId: session.sessionId,
              taskId: task.id,
              message: 'Reconnect to resume',
            },
          };
          break;
        }
        yield event;
      }
    } catch (err) {
      yield { event: 'error', data: { message: err.message } };
    }
  }

  return streamSSEResponse(c, generateSSE());
});
```

**Trade-offs:**
- ✅ Works on Free tier (55s chunks)
- ✅ Real-time progress feedback
- ❌ Complex resume logic
- ❌ Client must handle reconnections

---

## 6. Analysis by Endpoint

| Endpoint | Pattern | Current | Free Tier | Pro Tier | Status |
|----------|---------|---------|-----------|----------|--------|
| `POST /chat/messages?stream=true` | SSE | Works | ✅ 55s limit | ✅ | **OK** |
| `GET /characters/extract/stream` | SSE | Works | ✅ 55s limit | ✅ | **OK** |
| `POST /storyboard/import` | Fire-and-forget | Broken | ❌ Timeout | ✅ | **BROKEN** |
| `POST /generation-jobs` | Fire-and-forget | Broken | ❌ Timeout | ✅ | **BROKEN** |

---

## 7. Database Schema for Async Tasks

### Task Model
```prisma
model Task {
  id               String   @id @default(cuid())
  type             String   // 'storyboard_import'
  status           String   @default("queued")  // queued → processing → completed/failed
  progress         Int      @default(0)
  input            Json     // {projectId, text}
  result           Json?    // {frames, characters, ...}
  error            Json?    // {code, message, retryable}
  userId           String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  estimatedSeconds Int?     // 300 (5 minutes)

  @@index([userId, status])
}
```

**Issue**: No retry logic built-in. If background job fails, task stays failed.

### GenerationJob Model
```prisma
model GenerationJob {
  id            String   @id @default(cuid())
  status        String   @default("queued")  // queued → processing → completed/failed
  progress      Int      @default(0)
  resultUrl     String?
  error         Json?
  retryCount    Int      @default(0)
  
  @@index([userId, status])
}
```

---

## 8. Deployment Files Summary

### Vercel Config
**`server/vercel.json`**: 
- ❌ `maxDuration: 60` (Free tier)
- ❌ Should be `900` for Pro tier or use Inngest

### Docker Compose
**`docker-compose.yml`**:
- ✅ AgentOS isolated on port 12322
- ✅ Timeouts configured: `LLM_TIMEOUT_LONG_SECONDS: 180`

### Environment
**`.env.production`**:
- ✅ Points to `AGENTOS_BASE_URL=https://agentos.dramo.ai`
- ✅ Separate from Vercel API
- ❌ No `SSE_TIMEOUT_MS` override for Pro tier

---

## 9. Conclusion & Recommendations

### Current Status
| Component | Works on Free | Works on Pro | Issue |
|-----------|---|---|---|
| Chat SSE streaming | ✅ | ✅ | None |
| Character extraction | ✅ | ✅ | None |
| Storyboard import | ❌ | ✅ | 9-min pipeline kills on Free |
| Image generation | ❌ | ✅ | Fire-and-forget doesn't survive |

### Immediate Fix (30 min)
```bash
# server/vercel.json
# Change maxDuration to 900 for Pro tier
```

### Medium-term Solution (2-3 days)
Migrate to Inngest:
- Handles background jobs reliably
- Free tier sufficient
- Scales automatically
- No infrastructure to manage

### Long-term Solution (1-2 weeks)
Implement task checkpoint system:
- Resume on reconnection
- Persist intermediate results
- Retry failed stages
- Better error reporting

---

## 10. Files Involved

```
server/
├── vercel.json                          # ⚠️ maxDuration: 60 (should be 900)
├── server/src/
│   ├── routes/
│   │   ├── storyboard.ts               # ❌ Fire-and-forget (BROKEN on Free)
│   │   ├── chat.ts                     # ✅ SSE streaming (WORKS)
│   │   ├── characters.ts               # ✅ SSE streaming (WORKS)
│   │   └── generation-jobs.ts          # ❌ Fire-and-forget (BROKEN on Free)
│   ├── services/
│   │   ├── task.service.ts             # Task CRUD
│   │   └── generation-job.service.ts   # Job CRUD
│   ├── lib/
│   │   ├── sse.ts                      # 55s timeout + reconnect
│   │   ├── agentos-client.ts           # HTTP/SSE to AgentOS (540s for import)
│   │   └── db.ts                       # Prisma singleton
│   ├── config/index.ts                 # SSE timeouts (55s)
│   └── db/schema.prisma                # Task/GenerationJob models
├── Dockerfile                           # Multi-stage build
└── package.json                         # Build/deploy scripts

agentos/
├── Dockerfile                           # Python 3.11 + FastAPI
├── app.py                               # AgentOS entry point
├── workflows/                           # Storyboard, Characters, Locations, etc.
└── services/                            # Image generation, LLM config
```

---

## TL;DR: Can You Deploy to Vercel?

### ✅ YES: Upgrade to Vercel Pro ($20/month)
- Change `maxDuration: 900` in `vercel.json`
- 3-5 minute pipelines will work
- No code changes needed

### ❌ NO: Stick with Vercel Free
- Fire-and-forget tasks will timeout
- Task status will get stuck in "processing"
- SSE streaming works (55s limit)

### 🎯 BEST: Use Inngest for background jobs
- Serverless job queue (free tier)
- 3+ minute pipelines supported
- Scales automatically
- Production-ready error handling
