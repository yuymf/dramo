# Dramo Project Architecture Analysis: Supabase + Vercel Deployment Feasibility

**Analysis Date:** 2026-05-27  
**Project:** Dramo (storyboarding/character generation tool)  
**Deployment Targets:** Supabase PostgreSQL + Vercel (Next.js frontend + Serverless backend)

---

## Executive Summary

The Dramo project has **significant architectural constraints** that make a pure Vercel serverless deployment challenging. While the frontend and API proxy tier are Vercel-compatible, the backend is designed for long-running processes with fire-and-forget background tasks that exceed Vercel's 60-second function timeout limit.

**Key Finding:** The storyboard generation pipeline runs up to **9 minutes (540s)** in the background, which is fundamentally incompatible with Vercel's serverless constraints. Image generation jobs are also fire-and-forget operations that continue after the HTTP response returns.

---

## 1. SSE (Server-Sent Events) Implementation

### Location: `server/src/lib/sse.ts`

#### Architecture
- **Framework:** Uses Hono's `streamSSE()` from `hono/streaming`
- **Session Management:** Maintains SSE session state with cursor tracking for resume support
- **Heartbeat Logic:** 15-second heartbeat to keep connections alive

```typescript
// Key SSE Configuration
sseTimeoutMs: 55000,    // 55s (5s safety margin for Vercel 60s limit)
sseHeartbeatMs: 15000,  // 15s heartbeat intervals
```

#### Timeout Handling
The SSE implementation is **already aware** of Vercel's 60-second timeout:
- Line 39-43: `isApproachingTimeout()` checks elapsed time against `config.sseTimeoutMs` (55s)
- Line 89-99: Proactively sends a `timeout` event before connection closes
- Line 95: Includes `sessionId` and `cursor` for client reconnection

#### AgentOS SSE Parser (`parseAgentOSSSE`)
- Consumes AgentOS workflow SSE stream and maps to internal event types
- Event mapping:
  - `RunResponse` → `data` (with content extraction)
  - `WorkflowCompleted` → `done`
  - `WorkflowError` → `error`
  - `WorkflowStarted` → ignored
- Handles multi-line buffering for large JSON payloads

#### Assessment: ✅ VERCEL-COMPATIBLE
- Already designed for Vercel's 60s timeout
- Has reconnect/resume logic built in
- Heartbeat prevents idle termination

---

## 2. Long-Running Tasks & Background Execution

### Critical Finding: Fire-and-Forget Pattern

The backend uses a **fire-and-forget async execution model** for two major workflows:

#### 2.1 Storyboard Generation Pipeline

**Location:** `server/src/routes/storyboard.ts`

```typescript
const WORKFLOW_TIMEOUT_MS = 540_000;  // 9 MINUTES!
const ESTIMATED_PIPELINE_SECONDS = 300; // But can run longer

// Execution flow:
1. POST /storyboard → Creates Task record
2. Returns 202 Accepted (fire-and-forget)
3. executeStoryboardImport() runs in background
4. AgentOS workflow runs via SSE stream (5-9 minutes)
5. Updates Task record with results/errors
```

**Process:**
- Creates a Task record before launching the workflow
- Makes SSE request to AgentOS with `stream: true`
- Consumes the entire SSE stream (keeps connection alive during 4-phase pipeline)
- Updates task status in database: `processing` → `completed` or `failed`
- **The HTTP handler returns before the workflow finishes**

**Server Timeout Configuration** (`server/src/server.ts`):
```typescript
const SERVER_HEADERS_TIMEOUT_MS = 600_000;     // 10 min
const SERVER_REQUEST_TIMEOUT_MS = 720_000;     // 12 min
const SERVER_KEEP_ALIVE_TIMEOUT_MS = 620_000;  // 10 min 20s
```

#### 2.2 Image Generation Jobs

**Location:** `server/src/services/job-runner.service.ts`

```typescript
async createJob(data: {...}) {
  const job = await prisma.generationJob.create({
    data: { status: 'queued', progress: 0 }
  });
  
  // Fire-and-forget execution
  this.executeGeneration(job.id, data).catch(err => {
    logger.error({ err, jobId }, 'Background image generation failed');
  });
  
  return job;  // Returns immediately
}
```

**Process:**
1. HTTP handler creates GenerationJob record with `status: 'queued'`
2. Immediately returns `{ jobId }` to client
3. `executeGeneration()` runs asynchronously in the background:
   - Updates job status to `'processing'`
   - Calls `runImageGeneration()` via AgentOS
   - Updates job with `'completed'` or `'failed'` status

**No Job Queue Library:** The project does NOT use Bull, BullMQ, or any persistent job queue. Jobs are stored in Prisma/PostgreSQL only.

#### 2.3 Generation Job Streaming Endpoint

**Location:** `server/src/routes/generation-jobs.ts` - `/jobs/stream`

```typescript
// Polls database every 2 seconds for up to 55 seconds
const maxPolls = 27; // ~54 seconds at 2s interval

while (polls < maxPolls) {
  const { jobs } = await jobService.listJobs({ userId, limit: 20 });
  // Check updatedAt timestamps for changes
  // Emit SSE events for status changes
  await stream.writeSSE({ event: 'ping', data: '{}' });
  await new Promise(resolve => setTimeout(resolve, 2000));
  polls++;
}

// Close connection after ~55 seconds with timeout event
```

#### Assessment: ❌ NOT VERCEL-COMPATIBLE

| Constraint | Vercel | Dramo | Gap |
|-----------|--------|-------|-----|
| Function timeout | 60s | 540s (storyboard) | **480s over** |
| HTTP handlers | Sync only | Fire-and-forget async | Incompatible |
| Background tasks | ❌ No | ✅ Yes | Must move to external service |
| Connection durability | Killed at timeout | Extended by headers/keepalive | Mismatch |

---

## 3. AgentOS Client Communication

**Location:** `server/src/lib/agentos-client.ts`

### Implementation Details

#### `startWorkflowRun()` - Primary Integration
```typescript
export async function startWorkflowRun(
  workflowId: string,
  params: Record<string, unknown>,
  opts?: AgentOSCallOptions
): Promise<Response>

// Configuration
timeoutMs: 55000,  // 55s default (within Vercel 60s)
signal: AbortSignal.timeout(timeoutMs)  // Uses native AbortController
```

**Key Integration Points:**
1. Takes `stream: true/false` option → AgentOS sends SSE or JSON
2. Embeds `_llm_config` directly in payload for LLM header forwarding
3. Uses FormData for request body (not JSON)
4. Returns raw Response for caller to choose consumption pattern

#### Error Mapping
```typescript
function mapAgentOSError(err: Error) {
  // Maps HTTP status codes and timeout errors
  // Returns { code, retryable } for client retry logic
  // AGENTOS_TIMEOUT → UPSTREAM_TIMEOUT (retryable: true)
  // AGENTOS_429 → RATE_LIMITED (retryable: true)
}
```

#### Other Functions
- `postAgentOS()` - JSON POST with timeout (55s default)
- `getAgentOS()` - JSON GET with timeout (10s default)
- `checkAgentOSHealth()` - Health check (5s timeout)
- `runImageGeneration()` - Specialized wrapper for `/api/generate-image`

### Assessment: ✅ COMPATIBLE WITH MODIFICATIONS

**Current State:**
- Uses standard `fetch()` with `AbortSignal.timeout()`
- No Node.js-specific dependencies
- Already respects Vercel's timeout constraints

**Required Changes:**
- Cannot use fire-and-forget pattern in Vercel Functions
- Must delegate to external job queue (e.g., Inngest, AWS Lambda, Railway)
- SSE consumption must complete within 60s window

---

## 4. Next.js API Proxy Setup

**Location:** `web/app/api/_utils/proxy.ts` + `route-factory.ts`

### Proxy Architecture

The frontend proxies **all backend requests** through Next.js API routes:

```typescript
// Example: web/app/api/projects/route.ts
export const { GET, POST } = createProxyRoute(
  '/api/v1/projects/:projectId',
  ['GET', 'POST'],
  { requireAuth: true, timeoutMs: 60000 }
);
```

#### SSE Passthrough (Lines 225-233)
```typescript
if (contentType.includes("text/event-stream")) {
  responseHeaders.set("Content-Type", "text/event-stream");
  responseHeaders.set("Cache-Control", "no-cache");
  responseHeaders.set("Connection", "keep-alive");
  
  // Pipe backend SSE stream directly to client
  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}
```

**Key Features:**
- SSE detection and passthrough (NOT buffering)
- Maintains `Connection: keep-alive` header
- Sets `Cache-Control: no-cache` for streaming
- Timeout default: 30s (configurable per route)

#### Path Traversal Protection
```typescript
const SAFE_PARAM_RE = /^[a-zA-Z0-9_\-\.]+$/;
// Prevents SSRF/path traversal via dynamic segments
```

#### Request Body Handling
- FormData, Blob, ArrayBuffer preserved as-is
- JSON automatically parsed/re-stringified
- multipart/form-data preserved without Content-Type modification

### Assessment: ✅ VERCEL-COMPATIBLE

- Already designed for Vercel's 60s timeout
- SSE passthrough doesn't buffer entire stream
- No Node.js-specific features
- Auth tokens injected from NextAuth session

---

## 5. WebSocket & Long-Polling Analysis

### Finding: **NO WebSocket Implementation**

✅ **Confirmed:** No WebSocket usage in the codebase.

The project uses:
1. **SSE (Server-Sent Events)** for streaming (primary pattern)
2. **Long-polling simulation** in `/jobs/stream` endpoint (database polling)

Both are compatible with Vercel's stateless architecture.

---

## 6. Deployment Configuration Files

### 6.1 Server-side Vercel Config

**Location:** `server/vercel.json`

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/[[...route]]"
    }
  ],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 60,           // ⚠️ 60s hard limit
      "includeFiles": "dist/**"
    }
  }
}
```

**Issue:** `maxDuration: 60` is **hardcoded** but the storyboard pipeline needs 540s.

### 6.2 Frontend Next.js Config

**Location:** `web/next.config.ts`

```typescript
const nextConfig: NextConfig = {
  output: "standalone",  // ✅ Vercel-ready
  experimental: {
    proxyTimeout: 100000, // 100s (development only, ignored in prod)
  },
};
```

### 6.3 Docker Compose

**Location:** `docker-compose.yml`

Current architecture:
```
nginx (reverse proxy)
├── api (Hono server, :12321)
├── web (Next.js, :3000)
└── agentos (Python AgentOS, :12322)
```

**Local Development:** Uses 3-container Docker setup with no external dependencies.

### 6.4 Environment Configuration

**Location:** `server/src/config/index.ts`

```typescript
export const config = {
  sseTimeoutMs: 55000,    // Vercel-aware
  sseHeartbeatMs: 15000,
  storageDriver: 'supabase' | 'local',
  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  agentosUrl: env.AGENTOS_BASE_URL,
};
```

**Validation:** Fails fast in production if required vars missing (JWT_SECRET, DATABASE_URL, etc.)

---

## 7. Key Files Summary Table

| File Path | Purpose | Vercel Compatible? | Notes |
|-----------|---------|-------------------|-------|
| `server/src/lib/sse.ts` | SSE streaming, timeout handling | ✅ Yes | Already Vercel-aware |
| `server/src/server.ts` | HTTP server config | ❌ No | 10+ min timeouts not applicable |
| `server/src/lib/agentos-client.ts` | AgentOS integration | ⚠️ Partial | Works for SSE, needs refactoring for background tasks |
| `server/src/routes/storyboard.ts` | Storyboard generation | ❌ No | 9-min pipeline = fire-and-forget |
| `server/src/services/job-runner.service.ts` | Image generation | ❌ No | Fire-and-forget pattern |
| `server/src/routes/generation-jobs.ts` | Job polling endpoint | ✅ Yes | Polling works within 60s window |
| `web/app/api/_utils/proxy.ts` | SSE passthrough | ✅ Yes | Direct stream piping |
| `server/vercel.json` | Vercel config | ❌ No | maxDuration too short |

---

## 8. Deployment Architecture Comparison

### Current Architecture (Docker Compose)
```
Internet
  ↓
Nginx (:80)
  ├─→ Next.js (:3000)
  │    └─→ Backend API (:12321) [via proxy.ts]
  └─→ Backend API (:12321)
       └─→ AgentOS (:12322)
```

**Characteristics:**
- ✅ Stateless frontend
- ❌ Stateless API with synchronous background execution
- ✅ External service (AgentOS) isolation
- ❌ Requires extended Node.js process lifetime

### Vercel-Compatible Architecture (Required)
```
Internet
  ↓
Vercel Functions (60s limit)
  ├─→ Next.js Frontend
  │    └─→ API Routes → Backend API (Vercel/External)
  └─→ Backend API
       ├─→ [NOT FEASIBLE] Storyboard pipeline
       └─→ [REQUIRES REFACTOR] Image generation jobs
```

---

## 9. Critical Blockers for Vercel Deployment

### Blocker 1: Storyboard Generation Pipeline (540 seconds)
**Severity:** 🔴 **CRITICAL**

- **Current:** Fire-and-forget async execution running 5-9 minutes
- **Vercel Limit:** 60 seconds maximum
- **Solution Required:** Externalize to:
  - ✅ Inngest (Vercel-recommended)
  - ✅ AWS Lambda + SQS
  - ✅ Railway background jobs
  - ✅ Dedicated Docker container

**Code Affected:**
- `server/src/routes/storyboard.ts` - `executeStoryboardImport()`
- Server startup config in `server/src/server.ts` (timeouts won't apply)

### Blocker 2: Image Generation Fire-and-Forget
**Severity:** 🟠 **HIGH**

- **Current:** Job created in DB, execution starts in background without returning result
- **Vercel Incompatibility:** Process terminates when function returns
- **Solution:** Use same external job system as storyboard

**Code Affected:**
- `server/src/services/job-runner.service.ts` - `createJob()` and `executeGeneration()`
- HTTP handler returns immediately, but background work never completes

### Blocker 3: HTTP Server Configuration
**Severity:** 🟡 **MEDIUM** (informational, not functional)

- **Current:** `server/src/server.ts` sets 10+ minute timeouts via Node.js `Server` object
- **Vercel:** HTTP server config doesn't apply (functions run in isolation)
- **Action:** Can be removed/ignored when running on Vercel

---

## 10. Database Readiness

### Supabase PostgreSQL: ✅ READY

**Current Config:**
```typescript
databaseUrl: process.env.DATABASE_URL,  // Supabase DSN
storageDriver: 'supabase',              // Supabase Storage
supabaseUrl: env.SUPABASE_URL,
supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
```

**Assessment:**
- ✅ Prisma supports PostgreSQL
- ✅ Supabase client integrated (`@supabase/supabase-js`)
- ✅ All data models already use Prisma ORM
- ✅ No connection pooling issues (Supabase handles this)

**Required Changes:**
- None. Database layer is database-agnostic.

---

## 11. Storage Readiness

### Supabase Storage: ✅ READY

**Current Implementation** (`server/src/services/storage.service.ts`):
```typescript
storageDriver: 'supabase' | 'local',
// Already implements Supabase Storage operations
```

**Features Already Used:**
- ✅ Authenticated signed URLs (60-min TTL)
- ✅ Bucket isolation by project
- ✅ File upload/download operations
- ✅ Timeout handling (60s) in place

---

## 12. Configuration Changes Required

### Environment Variables for Vercel

**Already Correct:**
```env
DATABASE_URL=postgresql://...  # Supabase
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
AGENTOS_BASE_URL=???  # PROBLEM: Where is AgentOS hosted?
```

**Issue: AgentOS Deployment**
- Current: Runs as Docker service internally
- Vercel: Cannot host Python services
- Solution: Deploy AgentOS separately:
  - ✅ Railway (Vercel + Railway partnership)
  - ✅ AWS Lambda + Fargate
  - ✅ Render.com
  - ✅ DigitalOcean App Platform

---

## 13. Timeout Summary Table

| Timeout | Current | Vercel | Incompatibility |
|---------|---------|--------|-----------------|
| **Storyboard workflow** | 540s | 60s | **480s over** 🔴 |
| **SSE (job stream)** | 55s | 60s | ✅ Fits |
| **Image generation** | Unlimited (background) | 60s | **Unbounded > 60s** 🔴 |
| **AgentOS calls** | 55s | 60s | ✅ Fits |
| **HTTP server** | 600-720s | N/A | N/A (not applicable) |
| **Proxy request** | 30s default | 60s | ✅ Fits |

---

## 14. Migration Path to Vercel + Supabase

### Phase 1: Verify Compatibility (Immediate)
- [ ] Test SSE streaming in Vercel Functions (should work)
- [ ] Test Next.js API proxy with backend on Vercel/external
- [ ] Confirm Supabase PostgreSQL connection from Vercel

### Phase 2: Externalize Long-Running Tasks (CRITICAL)
- [ ] Refactor storyboard generation to use Inngest/external job queue
- [ ] Refactor image generation jobs to use same job queue
- [ ] Update task status polling to work without background processes

### Phase 3: Deploy AgentOS
- [ ] Deploy AgentOS to external provider (Railway recommended)
- [ ] Update `AGENTOS_BASE_URL` environment variable
- [ ] Add security key if required

### Phase 4: Migrate Data
- [ ] Export existing PostgreSQL data
- [ ] Import to Supabase PostgreSQL
- [ ] Verify Supabase Storage permissions and bucket setup

### Phase 5: Deploy to Vercel
- [ ] Update `server/vercel.json` to remove/reduce `maxDuration`
- [ ] Deploy Next.js frontend to Vercel
- [ ] Deploy backend API to Vercel Functions (or external)
- [ ] Update DNS and environment variables

---

## 15. Recommended External Job Queue Solutions

### Option A: Inngest (Vercel Native)
**Pros:**
- Native Vercel integration
- No infrastructure management
- Reliable durability guarantees
- Built for Vercel Functions

**Cons:**
- Third-party dependency
- Pricing per invocation

**Migration Effort:** Medium (~2-3 days)

### Option B: Railway Background Jobs
**Pros:**
- Same provider as AgentOS
- PostgreSQL built-in
- Simple setup

**Cons:**
- Requires Railway account
- Job duration limits

**Migration Effort:** Low (~1-2 days)

### Option C: AWS Lambda + SQS
**Pros:**
- Highly scalable
- Fine-grained control
- Pay-per-use

**Cons:**
- AWS complexity
- Requires infrastructure setup

**Migration Effort:** High (~1 week)

---

## 16. Current Incompatibilities vs. Vercel Constraints

### Summary Table

| Issue | Severity | File(s) | Workaround |
|-------|----------|---------|-----------|
| Storyboard 540s timeout | 🔴 CRITICAL | `routes/storyboard.ts` | Externalize to Inngest/job queue |
| Image gen fire-and-forget | 🔴 CRITICAL | `services/job-runner.service.ts` | Externalize to Inngest/job queue |
| AgentOS Python service | 🟠 HIGH | `docker-compose.yml` | Deploy to Railway/AWS/Render |
| Server timeout config | 🟡 MEDIUM | `server.ts` | Remove (not applicable on Vercel) |
| `vercel.json` maxDuration | 🟡 MEDIUM | `server/vercel.json` | Reduce/remove (60s is max) |
| No background processes | 🔴 CRITICAL | Multiple | Architectural change required |

---

## 17. Verification Checklist

- [ ] **SSE Implementation**: Already Vercel-aware with 55s timeout
- [ ] **Proxy Layer**: SSE passthrough compatible
- [ ] **Database**: Supabase PostgreSQL ready
- [ ] **Storage**: Supabase Storage ready
- [ ] **Background Tasks**: ❌ **NOT READY** - fire-and-forget pattern incompatible
- [ ] **Job Queue**: ❌ **Not present** - must be added
- [ ] **AgentOS**: ❌ **Cannot run on Vercel** - must externalize
- [ ] **Timeouts**: Partially ready (60s for SSE, unbounded for bg tasks)

---

## 18. Conclusion

### **Overall Assessment: ⚠️ PARTIALLY FEASIBLE**

**Positive:**
- ✅ SSE implementation is Vercel-aware
- ✅ API proxy layer works on Vercel
- ✅ Supabase integration is complete
- ✅ Database and storage ready
- ✅ No WebSocket complexity

**Negative:**
- 🔴 **Storyboard pipeline (540s) exceeds Vercel 60s limit by 8x**
- 🔴 **Image generation uses fire-and-forget pattern impossible on serverless**
- 🔴 **No job queue system exists**
- 🔴 **AgentOS Python service cannot run on Vercel**

### **Final Recommendation**

**DO NOT deploy to pure Vercel Functions** without:
1. Implementing external job queue (Inngest recommended)
2. Externalizing AgentOS to Railway/AWS
3. Refactoring storyboard and image generation to use job queue
4. Removing fire-and-forget patterns

**Alternative:** Keep backend on Docker (Railway, AWS ECS, DigitalOcean) with Vercel frontend. This is the fastest path to production while preserving all current functionality.

---

## Appendix: File Reference Index

```
Server Architecture
├── server/src/
│   ├── app.ts                       # Hono app setup
│   ├── server.ts                    # Server with timeout config (NOT Vercel applicable)
│   ├── lib/
│   │   ├── sse.ts                   # ✅ SSE implementation (Vercel-aware)
│   │   ├── agentos-client.ts        # ⚠️ AgentOS integration (needs refactor for bg tasks)
│   │   ├── db.ts                    # Prisma initialization
│   │   └── errors.ts
│   ├── config/
│   │   └── index.ts                 # Configuration with Vercel-aware timeouts
│   ├── services/
│   │   ├── job-runner.service.ts    # 🔴 Fire-and-forget (incompatible)
│   │   ├── job-store.service.ts     # Job DB operations
│   │   ├── generation-job.service.ts
│   │   ├── chat.service.ts
│   │   ├── llm-config.service.ts
│   │   └── storage.service.ts
│   └── routes/
│       ├── storyboard.ts            # 🔴 540s pipeline (incompatible)
│       ├── generation-jobs.ts       # ✅ Job polling (compatible)
│       ├── chat.ts                  # ✅ SSE streaming (compatible)
│       └── [other routes]
│
Frontend Architecture
├── web/
│   ├── next.config.ts               # ✅ Vercel-ready
│   ├── app/api/
│   │   ├── _utils/
│   │   │   ├── proxy.ts             # ✅ SSE passthrough (compatible)
│   │   │   └── route-factory.ts     # ✅ Proxy route generation
│   │   └── [routes]
│   └── [pages, components]
│
Deployment Config
├── server/vercel.json               # ⚠️ maxDuration: 60 (too short for some jobs)
├── server/.vercelignore
├── docker-compose.yml               # Current local dev setup
├── deploy/
│   ├── .env.template
│   ├── nginx.conf
│   ├── setup-dramo.sh
│   └── update.sh
```

