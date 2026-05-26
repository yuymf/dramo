# Dramo Deployment on Supabase + Vercel - Quick Summary

## ⚠️ Main Verdict: **NOT FEASIBLE AS-IS**

The project has two **critical blockers** that prevent deployment to Vercel Functions:

---

## 🔴 CRITICAL BLOCKERS

### 1. Storyboard Generation: 540s > 60s (8x Timeout!)
- **File:** `server/src/routes/storyboard.ts`
- **Problem:** Pipeline runs 5-9 minutes in background after HTTP response returns
- **Vercel Limit:** 60 seconds maximum for Serverless Functions
- **Status:** ❌ INCOMPATIBLE

### 2. Image Generation: Fire-and-Forget Pattern
- **File:** `server/src/services/job-runner.service.ts`
- **Problem:** Jobs continue executing after HTTP handler returns
- **Vercel Constraint:** Processes killed when function ends
- **Status:** ❌ INCOMPATIBLE

---

## ✅ WHAT WORKS

| Component | Status | Details |
|-----------|--------|---------|
| **SSE Streaming** | ✅ Ready | Already Vercel-aware, 55s timeout configured |
| **Next.js Proxy** | ✅ Ready | SSE passthrough implemented correctly |
| **Supabase DB** | ✅ Ready | Prisma ORM compatible |
| **Supabase Storage** | ✅ Ready | Already integrated |
| **Chat Streaming** | ✅ Ready | Uses SSE within 60s window |
| **Job Polling** | ✅ Ready | Database polling works fine |

---

## ❌ WHAT DOESN'T WORK

| Component | Status | Reason |
|-----------|--------|--------|
| **Storyboard Gen** | ❌ Broken | 540s execution > 60s limit |
| **Image Gen** | ❌ Broken | Fire-and-forget impossible |
| **AgentOS** | ❌ Broken | Python service can't run on Vercel |
| **Job Queue** | ❌ Missing | No external queue system (Bull, BullMQ, etc.) |
| **Server Config** | ⚠️ N/A | 10+ min timeouts don't apply to serverless |

---

## 📊 Architecture Issues

### Current Architecture
```
Single Node.js process with:
- Extended timeouts (10+ min)
- Fire-and-forget background execution
- Long-lived HTTP connections
- EventEmitter-based job tracking (in-memory)
```

### Vercel Requirements
```
Stateless functions with:
- 60s maximum timeout
- Synchronous execution only
- Isolated processes (no background work)
- Database-backed state only
```

### Gap: **Fundamental Mismatch**

---

## 🛠️ Solution Path (High-Level)

To make Dramo work on Vercel, you need to:

1. **Add External Job Queue**
   - Inngest (recommended - Vercel-native)
   - AWS Lambda + SQS
   - Railway background jobs
   - **Effort:** 2-3 days

2. **Refactor Storyboard Pipeline**
   - Stop fire-and-forget in HTTP handler
   - Delegate to job queue
   - HTTP returns immediately with job ID
   - Job updates task record asynchronously
   - **Effort:** 1-2 days

3. **Refactor Image Generation**
   - Same pattern as storyboard
   - Jobs queued immediately after HTTP return
   - **Effort:** 1 day

4. **Deploy AgentOS Separately**
   - Cannot run Python on Vercel
   - Deploy to: Railway, AWS, Render, DigitalOcean
   - **Effort:** 1 day

5. **Database Migration**
   - Export current PostgreSQL data
   - Import to Supabase
   - **Effort:** 1 day

**Total Effort:** ~1-2 weeks

---

## 💡 Alternative: Keep Backend on Docker

**Faster Option:** Deploy frontend to Vercel, backend to Docker-based platform:

| Platform | Pros | Cost |
|----------|------|------|
| **Railway** | Simple, supports Python | $5-50/mo |
| **Render.com** | Good free tier | Free-$25/mo |
| **AWS ECS** | Highly scalable | $20-100/mo |
| **DigitalOcean** | Simple Docker app | $12-50/mo |

This approach:
- ✅ Preserves all current functionality
- ✅ No code refactoring needed
- ✅ Faster time-to-production
- ❌ More complex setup
- ❌ Higher operational overhead

---

## 📋 Implementation Decision Matrix

| Approach | Timeline | Complexity | Cost | Risk |
|----------|----------|-----------|------|------|
| **Pure Vercel** | 2-3 weeks | High | Low | Medium |
| **Vercel + Docker Backend** | 3-5 days | Medium | Medium | Low |
| **Keep Current Setup** | 1 week | Low | Medium | Low |

---

## 🎯 Files to Check First

Priority order for assessment:

1. `server/src/routes/storyboard.ts` - 540s pipeline
2. `server/src/services/job-runner.service.ts` - Fire-and-forget
3. `server/src/lib/sse.ts` - Already good
4. `web/app/api/_utils/proxy.ts` - Already good
5. `server/vercel.json` - Config issue

---

## ✋ Next Steps

**If pursuing Vercel:** 
1. Set up Inngest account
2. Create proof-of-concept: Move one image generation job to Inngest
3. If successful, refactor storyboard pipeline
4. Deploy AgentOS to external service

**If pursuing Docker backend:**
1. Pick hosting platform (Railway recommended)
2. Deploy backend container
3. Deploy frontend to Vercel
4. Set up monitoring/CI-CD

---

## 📞 Questions to Answer

Before committing to a path, answer:

- [ ] Do you need true real-time updates (WebSocket)?
  - Current: SSE polling every 2s
  - Answer affects architecture choice

- [ ] How many concurrent storyboard generations?
  - Current: Fire-and-forget (unbounded)
  - Matters for job queue scaling

- [ ] Acceptable job latency?
  - Current: Starts immediately
  - Queue systems add 1-5s delay

- [ ] Budget for infrastructure?
  - Vercel: $20-100/mo (per usage)
  - Docker: $5-100/mo (per platform)

