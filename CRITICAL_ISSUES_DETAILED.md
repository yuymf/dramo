# Dramo: Critical Issues with Vercel Deployment - Detailed Code Analysis

## Issue #1: Storyboard Generation Pipeline (540s)

### File: `server/src/routes/storyboard.ts`

#### The Problem
```typescript
// Lines 21-22: Timeout configuration
const WORKFLOW_TIMEOUT_MS = 540_000;  // 9 MINUTES!
const ESTIMATED_PIPELINE_SECONDS = 300; // But can run longer

// Execution model: Fire-and-forget
// POST /storyboard
// 1. Creates Task record
// 2. Calls executeStoryboardImport() 
// 3. Returns 202 Accepted immediately
// 4. Background process continues for 5-9 minutes
```

#### Execution Flow
```typescript
// HTTP handler starts the job but returns immediately
storyboard.post('/storyboard', async (c) => {
  const task = await taskService.createTask({
    status: 'queued',
    projectId,
  });
  
  // Fire-and-forget: This runs in background!
  executeStoryboardImport(task.id, params).catch(err => {
    logger.error({ err, taskId: task.id }, 'Import failed');
  });
  
  // HTTP response returns while background work continues
  return c.json({ taskId: task.id }, 202);
});
```

#### The Background Work (Takes 5-9 minutes)
```typescript
async function executeStoryboardImport(
  taskId: string,
  params: { projectId, text, llmHeaders }
) {
  // 1. Start processing task
  await taskService.updateTask(taskId, { status: 'processing', progress: 10 });
  
  // 2. Fetch project assets
  const [charactersLib, locationsLib] = await fetchProjectAssets(params.projectId);
  
  // 3. THIS IS THE KILLER: 540-second workflow via SSE
  //    - 4-phase pipeline in AgentOS
  //    - Streaming SSE response
  //    - Must consume entire stream
  const response = await startWorkflowRun('storyboardworkflow', {
    projectId: params.projectId,
    text: params.text,
    characters_lib: charactersLib,
    locations_lib: locationsLib,
  }, { 
    llmHeaders: params.llmHeaders, 
    timeoutMs: WORKFLOW_TIMEOUT_MS,  // 540s!
    stream: true 
  });
  
  // 4. Stream consumption loop (stays open until complete)
  const reader = response.body?.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    // Parse SSE events...
    // Update progress incrementally
  }
  
  // 5. Parse final result and save to database
  const frames = storyboardJsonToFrames(data);
  await storyboardDataService.upsertFrames(frames);
  
  // 6. Mark task complete
  await taskService.updateTask(taskId, { 
    status: 'completed', 
    progress: 100 
  });
}
```

#### Why This Breaks on Vercel
```
Vercel Execution Timeline:
┌─────────────────────────────────────────────────┐
│ 0s: HTTP handler invoked                        │
│     - Creates task                              │
│     - Starts background work                    │
│     - Returns 202                               │
├─────────────────────────────────────────────────┤
│ 60s: ⚠️ VERCEL KILLS FUNCTION                   │
│      - All background processes terminated      │
│      - Unfinished work lost                      │
│      - SSE stream connection closed              │
├─────────────────────────────────────────────────┤
│ 5-9min: ❌ Never reached                         │
│         - Database update never runs             │
│         - Task stuck in "processing" forever     │
└─────────────────────────────────────────────────┘

Required Timeline:
┌─────────────────────────────────────────────────┐
│ 0s: Job queued                                  │
│     Return immediately with job ID              │
├─────────────────────────────────────────────────┤
│ 0-60s: External job system handles              │
│        - Poll job queue                         │
│        - Start external worker process          │
├─────────────────────────────────────────────────┤
│ 60s+: Worker process continues                  │
│       - Runs for 5-9 minutes                    │
│       - Updates database with results           │
│       - No connection to HTTP layer             │
└─────────────────────────────────────────────────┘
```

---

## Issue #2: Image Generation Fire-and-Forget

### File: `server/src/services/job-runner.service.ts`

#### The Problem
```typescript
async createJob(data: {
  userId: string;
  projectId: string;
  storyboardId?: string;
  frameId?: string;
  params: ImageGenerationParams;
}) {
  // 1. Create job record in database
  const job = await prisma.generationJob.create({
    data: {
      userId: data.userId,
      projectId: data.projectId,
      storyboardId: data.storyboardId,
      frameId: data.frameId,
      params: data.params as any,
      status: 'queued',
      progress: 0,
    },
  });

  // 2. ⚠️ CRITICAL: Fire-and-forget execution
  //    This async function runs AFTER the HTTP response returns!
  //    On Vercel, it will be killed immediately.
  this.executeGeneration(job.id, data).catch((err) => {
    logger.error({ err, jobId: job.id }, 'Background image generation failed');
  });

  // 3. Return immediately (but background work never completes)
  return job;
}
```

#### The Async Execution (Never Completes on Vercel)
```typescript
private async executeGeneration(
  jobId: string,
  data: {
    userId: string;
    projectId: string;
    params: ImageGenerationParams;
  }
) {
  try {
    // 1. Update status to processing
    await this.store.updateJob(jobId, { status: 'processing', progress: 10 });

    // 2. Get LLM config from database
    const llmHeaders = await new LLMConfigService().getLLMHeaders(
      data.userId,
      'IMAGE_GEN'
    );

    // 3. Call AgentOS for image generation (can take several minutes)
    const result = await runImageGeneration({
      prompt: data.params.description,
      style: data.params.style,
      referenceImages: data.params.referenceImages,
    }, { llmHeaders });

    // 4. Extract URL from result
    const firstImageUrl = result.images[0]?.url;

    // 5. ❌ NEVER REACHES HERE on Vercel (process killed at 60s)
    //    Database record never updated with result
    //    Client thinks job is still processing forever
    await this.store.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      resultUrl: firstImageUrl,
    });
  } catch (err) {
    // ❌ NEVER REACHES HERE on Vercel either
    //    Error handling never executes
    await this.store.updateJob(jobId, {
      status: 'failed',
      error: { code: 'GENERATION_ERROR', message, retryable: true },
    });
  }
}
```

#### Where It's Called
```typescript
// File: server/src/routes/generation-jobs.ts
generationJobs.post('/images/generations', async (c) => {
  const userId = c.get('user').userId;
  const body = await c.req.json();

  try {
    // Creates job and starts background work
    const job = await jobService.createJob({
      userId,
      projectId: body.projectId,
      storyboardId: body.storyboardId,
      frameId: body.frameId,
      params: body.params,
    });

    // Returns immediately
    return c.json({ jobId: job.id });
  } catch (error: unknown) {
    // ... error handling
  }
});
```

#### Vercel Execution Timeline
```
Vercel Serverless Function Timeline:

┌───────────────────────────────────────┐
│ 0s: POST /images/generations          │
│     - Job created in database          │
│     - executeGeneration() started      │
│     - HTTP 200 returned                │
├───────────────────────────────────────┤
│ 0.1s: Client receives { jobId }        │
│       Client starts polling /jobs      │
├───────────────────────────────────────┤
│ 60s: ⚠️ VERCEL KILLS FUNCTION          │
│      - executeGeneration() terminated  │
│      - Image not generated             │
│      - Database never updated          │
│      - result: undefined               │
├───────────────────────────────────────┤
│ 60s+: Client polls forever             │
│       job.status = 'queued'             │
│       result is null                    │
│       ❌ STUCK                          │
└───────────────────────────────────────┘
```

---

## Issue #3: Server Timeout Configuration (Not Applicable)

### File: `server/src/server.ts`

```typescript
// These settings do NOT apply on Vercel Functions
const SERVER_HEADERS_TIMEOUT_MS = 600_000;     // 10 min
const SERVER_REQUEST_TIMEOUT_MS = 720_000;     // 12 min
const SERVER_KEEP_ALIVE_TIMEOUT_MS = 620_000;  // 10 min 20s

const httpServer = server as unknown as Server;
httpServer.headersTimeout = SERVER_HEADERS_TIMEOUT_MS;
httpServer.requestTimeout = SERVER_REQUEST_TIMEOUT_MS;
httpServer.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT_MS;
```

**Why it doesn't matter on Vercel:**
- Vercel doesn't use Node.js HTTP Server
- Functions are isolated and destroyed after execution
- These timeout settings are infrastructure-level, not function-level
- Vercel's 60s limit is hard-coded and cannot be extended

---

## Issue #4: No Job Queue Implementation

### Current Architecture: In-Memory Fire-and-Forget
```typescript
// Jobs are created in database, but execution is fire-and-forget
// No retry mechanism
// No delayed execution
// No job persistence across restarts
// No worker process separation

// What we have:
┌─────────────────┐
│  HTTP Handler   │
└────────┬────────┘
         │
         ├─→ Database (create job)
         │
         └─→ Async background work
            (undefined when function ends)
```

### Required Architecture: External Job Queue
```typescript
// Jobs are queued, then processed by external workers
// Multiple retry mechanisms
// Persistent queue storage
// Separate worker processes
// Can scale horizontally

// What we need:
┌─────────────────┐
│  HTTP Handler   │
└────────┬────────┘
         │
         ├─→ Database (create job)
         │
         └─→ Job Queue
            (e.g., Inngest, SQS, etc.)
            
            ↓
         
         External Worker Process
         ├─→ Poll queue
         ├─→ Execute long-running task
         └─→ Update database
```

#### Missing Dependencies
```json
// Not in server/package.json:
- bull (Redis-based queue)
- bullmq (Modern Redis queue)
- bree (Worker thread jobs)
- inngest (Cloud job queue)
- sqs (AWS Simple Queue Service)
```

---

## What DOES Work: SSE Streaming

### File: `server/src/lib/sse.ts`

#### Already Vercel-Aware
```typescript
// Configuration ALREADY respects Vercel 60s limit
export const config = {
  sseTimeoutMs: 55000,    // 55s (5s safety margin for Vercel)
  sseHeartbeatMs: 15000,  // 15s heartbeat
};

// Timeout detection
export function isApproachingTimeout(session: SSESessionState): boolean {
  const elapsed = Date.now() - session.startTime;
  return elapsed >= config.sseTimeoutMs;  // Checks 55s limit
}

// Proactive timeout event
if (isApproachingTimeout(sseSession)) {
  await stream.writeSSE({
    event: 'timeout',
    data: JSON.stringify({
      sessionId: sseSession.sessionId,
      cursor: sseSession.cursor,
      message: 'Approaching timeout. Reconnect to resume.',
    }),
    id: String(sseSession.cursor++),
  });
  break;  // Close connection before Vercel kills it
}
```

#### Usage Examples (WORK on Vercel)

**Chat Streaming:**
```typescript
// File: server/src/routes/chat.ts
chat.post('/chat/:projectId/messages', async (c) => {
  // ...
  if (body.stream) {
    const sseGen = chatService.generateSSE({...});
    return streamSSEResponse(c, sseGen);  // ✅ Works on Vercel
  }
  // ...
});
```

**Job Status Polling:**
```typescript
// File: server/src/routes/generation-jobs.ts
generationJobs.get('/jobs/stream', async (c) => {
  // Polls database for 55 seconds
  // Sends SSE events for job updates
  // ✅ Works on Vercel
  
  const maxPolls = 27; // ~54 seconds at 2s interval
  while (polls < maxPolls) {
    // Check for job updates
    // Send SSE events
    await new Promise(resolve => setTimeout(resolve, 2000));
    polls++;
  }
});
```

---

## What DOES Work: Next.js Proxy

### File: `web/app/api/_utils/proxy.ts`

#### SSE Passthrough (Already Correct)
```typescript
// Lines 225-233: SSE detection and passthrough
if (contentType.includes("text/event-stream")) {
  responseHeaders.set("Content-Type", "text/event-stream");
  responseHeaders.set("Cache-Control", "no-cache");
  responseHeaders.set("Connection", "keep-alive");
  
  // ✅ CORRECT: Pipe directly without buffering
  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}
```

**Why this works:**
- Doesn't buffer entire response
- Streams chunks directly to client
- Works within Vercel's 60s function timeout
- Maintains connection headers

---

## Comparison: Current vs. Required

### Current Architecture (Docker Compose)
```
┌─────────────────────────────────────────────┐
│ Single Node.js Process (persistent)         │
├─────────────────────────────────────────────┤
│ Features:                                   │
│ ✅ Fire-and-forget async execution          │
│ ✅ Extended timeouts (10+ minutes)          │
│ ✅ In-memory job tracking                   │
│ ✅ Long-lived HTTP connections              │
│ ✅ Process-level state management           │
│                                             │
│ Problems:                                   │
│ ❌ Not horizontally scalable                │
│ ❌ Process crashes lose all jobs             │
│ ❌ Hard to rate-limit                       │
│ ❌ Requires custom monitoring               │
└─────────────────────────────────────────────┘
```

### Required for Vercel
```
┌─────────────────────────────────────────────┐
│ Vercel Functions (60s, stateless)           │
├─────────────────────────────────────────────┤
│ Requirements:                               │
│ ✅ Database-backed job persistence          │
│ ✅ External job queue                       │
│ ✅ Worker process separation                │
│ ✅ Sync-only HTTP handlers                  │
│ ✅ No fire-and-forget                       │
│                                             │
│ Benefits:                                   │
│ ✅ Auto-scaling                             │
│ ✅ Job recovery from crashes                │
│ ✅ Built-in rate limiting                   │
│ ✅ Managed monitoring                       │
└─────────────────────────────────────────────┘

              ↓↓↓ REQUIRES ↓↓↓

┌─────────────────────────────────────────────┐
│ External Job Queue/Workers                  │
├─────────────────────────────────────────────┤
│ Examples:                                   │
│ • Inngest (Vercel-native)                   │
│ • AWS Lambda + SQS                          │
│ • Railway background jobs                   │
│ • Bull + Redis                              │
│ • Temporal workflows                        │
└─────────────────────────────────────────────┘
```

---

## Summary Table

| Issue | Severity | Location | Current Behavior | Vercel Behavior | Fix Required |
|-------|----------|----------|------------------|-----------------|--------------|
| Storyboard 540s | 🔴 CRITICAL | `storyboard.ts` | Runs in background | Process killed at 60s | External job queue |
| Image gen fire-and-forget | 🔴 CRITICAL | `job-runner.service.ts` | Async execution | Process killed at 60s | External job queue |
| Server timeout config | 🟡 MEDIUM | `server.ts` | 10+ min settings | Ignored on Vercel | Remove (N/A) |
| AgentOS deployment | 🟠 HIGH | `docker-compose.yml` | Docker container | Can't run on Vercel | Deploy separately |
| No job queue | 🔴 CRITICAL | N/A (missing) | Fire-and-forget | Required for any long job | Add Inngest/SQS |
| SSE implementation | ✅ READY | `sse.ts` | Vercel-aware | Already correct | None |
| Proxy layer | ✅ READY | `proxy.ts` | SSE passthrough | Direct piping | None |
| Database | ✅ READY | `config/index.ts` | PostgreSQL | Supabase ready | None |

