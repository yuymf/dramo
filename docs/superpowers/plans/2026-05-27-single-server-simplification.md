# Single-Server Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Stripe, NextAuth, and Supabase dependencies to create a self-contained Docker Compose deployable tool app with a default local user.

**Architecture:** Keep the existing three-layer architecture (Next.js + Hono + AgentOS) intact. Replace external services with local equivalents: local PostgreSQL, local filesystem storage, hardcoded default user. Remove all authentication and billing modules entirely.

**Tech Stack:** Next.js 15, Hono v4, Prisma 5, PostgreSQL 15, Docker Compose, Python FastAPI

---

## File Structure Overview

### Files to DELETE:
- `server/src/routes/auth.ts`
- `server/src/routes/billing.ts`
- `server/src/services/billing.service.ts`
- `server/src/lib/stripe.ts`
- `web/app/api/auth/` (entire directory)
- `web/app/api/billing/` (entire directory)
- `web/app/login/page.tsx`
- `web/app/register/page.tsx`
- `web/app/pricing/page.tsx`
- `web/app/billing/` (entire directory)
- `web/components/billing/` (entire directory)
- `web/lib/billing/` (entire directory)
- `web/lib/auth/` (entire directory)
- `web/lib/api/billing.ts`
- `web/lib/hooks/use-subscription.ts`
- `web/lib/hooks/use-feature-gate.ts`
- `web/mock/handlers/billing.ts`
- `web/app/api/debug/session/route.ts`

### Files to CREATE:
- `server/src/lib/default-user.ts`
- `server/src/middleware/default-user.ts`
- `.env.example`

### Files to MODIFY:
- `server/src/config/index.ts`
- `server/src/app.ts`
- `server/src/server.ts`
- `server/src/services/storage.service.ts`
- `server/src/db/schema.prisma`
- `server/package.json`
- `web/app/providers.tsx`
- `web/app/layout.tsx`
- `web/app/page.tsx`
- `web/app/api/_utils/proxy.ts`
- `web/app/api/_utils/route-factory.ts`
- `web/package.json`
- `docker-compose.yml`
- `deploy/nginx.conf`
- `deploy/setup-dramo.sh`

---

## Task 1: Database Schema — Remove Billing Models

**Files:**
- Modify: `server/src/db/schema.prisma`

- [ ] **Step 1: Remove Subscription model from schema**

Open `server/src/db/schema.prisma` and delete the entire `model Subscription { ... }` block AND the `subscription Subscription?` line from the `User` model.

Before (in User model):
```prisma
  subscription  Subscription?
  llmConfigs    UserLLMConfig[]
```

After (in User model):
```prisma
  llmConfigs    UserLLMConfig[]
```

Delete entire block:
```prisma
model Subscription {
  id                   String    @id @default(cuid())
  userId               String    @unique
  stripeCustomerId     String    @unique
  stripeSubscriptionId String?   @unique
  planId               String    @default("free")
  status               String    @default("active")
  billingInterval      String?
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean   @default(false)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Remove UsageRecord model from schema**

Delete the entire `model UsageRecord { ... }` block AND the `usageRecords UsageRecord[]` line from the `User` model AND the `enum UsageRecordType { ... }` block.

Delete from User model:
```prisma
  usageRecords  UsageRecord[]
```

Delete entire model:
```prisma
model UsageRecord {
  id        String          @id @default(cuid())
  userId    String
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  month     String
  type      UsageRecordType
  count     Int             @default(0)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  @@unique([userId, month, type])
}
```

Delete enum:
```prisma
enum UsageRecordType {
  SCRIPT_GENERATION
  CHARACTER_EXTRACTION
  LOCATION_EXTRACTION
  IMAGE_GENERATION
  STORYBOARD_IMPORT
}
```

- [ ] **Step 3: Generate migration**

Run:
```bash
cd server && npx prisma migrate dev --name remove-billing-models
```

Expected: Migration created successfully, Prisma Client regenerated.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/schema.prisma server/src/db/migrations/
git commit -m "refactor(db): remove Subscription and UsageRecord models"
```

---

## Task 2: Backend — Create Default User Module

**Files:**
- Create: `server/src/lib/default-user.ts`
- Create: `server/src/middleware/default-user.ts`

- [ ] **Step 1: Create default-user.ts**

Create file `server/src/lib/default-user.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export const DEFAULT_USER_ID = 'default-local-user';
export const DEFAULT_USER_EMAIL = 'local@dramo.tool';
export const DEFAULT_USER_NAME = 'Local User';

/**
 * Ensure the default local user exists in the database.
 * Called once at server startup. Uses upsert to be idempotent.
 */
export async function ensureDefaultUser(prisma: PrismaClient): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    create: {
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
      name: DEFAULT_USER_NAME,
      password: '',
    },
    update: {},
  });

  logger.info({ userId: user.id, email: user.email }, 'Default user ready');
}
```

- [ ] **Step 2: Create default-user middleware**

Create file `server/src/middleware/default-user.ts`:

```typescript
import { createMiddleware } from 'hono/factory';
import { DEFAULT_USER_ID, DEFAULT_USER_EMAIL } from '../lib/default-user';

export interface AuthUser {
  userId: string;
  email: string;
}

export type AuthEnv = {
  Variables: {
    user: AuthUser;
    requestId: string;
  };
};

/**
 * Middleware that injects the default local user into every request.
 * Replaces the JWT auth middleware for single-user tool mode.
 */
export const defaultUserMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.set('user', { userId: DEFAULT_USER_ID, email: DEFAULT_USER_EMAIL });
  return next();
});
```

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/default-user.ts server/src/middleware/default-user.ts
git commit -m "feat(server): add default user module and middleware"
```

---

## Task 3: Backend — Replace Auth Middleware and Remove Auth/Billing Routes

**Files:**
- Modify: `server/src/app.ts`
- Delete: `server/src/middleware/auth.ts`
- Delete: `server/src/routes/auth.ts`
- Delete: `server/src/routes/billing.ts`
- Delete: `server/src/services/billing.service.ts`
- Delete: `server/src/lib/stripe.ts`

- [ ] **Step 1: Rewrite app.ts to use default-user middleware**

Replace the entire contents of `server/src/app.ts` with:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { defaultUserMiddleware, type AuthEnv } from './middleware/default-user';
import { errorHandler } from './middleware/error-handler';
import { config } from './config';

// Route modules
import { health } from './routes/health';
import { projects } from './routes/projects';
import { scripts } from './routes/scripts';
import { tasks } from './routes/tasks';
import { inspirations } from './routes/inspirations';
import { chat } from './routes/chat';
import { chatSessions } from './routes/chat-sessions';
import { assets } from './routes/assets';
import { polish } from './routes/polish';
import { characters } from './routes/characters';
import { locations } from './routes/locations';
import { storyboard } from './routes/storyboard';
import { storyboardPersistence } from './routes/storyboard-persistence';
import { aiProviders } from './routes/ai-providers';
import { relations } from './routes/relations';
import { uploads } from './routes/uploads';
import { generationJobs } from './routes/generation-jobs';
import { llmConfigs } from './routes/llm-config';
import { director } from './routes/director';

const app = new Hono<AuthEnv>();

// --- Global middleware ---
app.use('*', cors({
  origin: '*',
  credentials: true,
}));

// --- Legacy /api/* → /api/v1/* redirect (301 permanent) ---
app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (!path.startsWith('/api/v1')) {
    const newPath = path.replace(/^\/api\//, '/api/v1/');
    const newUrl = new URL(c.req.url);
    newUrl.pathname = newPath;
    return c.redirect(newUrl.toString(), 301);
  }
  return next();
});

// --- Default user injection (replaces auth middleware) ---
app.use('*', defaultUserMiddleware);

// --- Routes (all mounted under /api/v1) ---
app.route('/api/v1', health);
app.route('/api/v1', projects);
app.route('/api/v1', scripts);
app.route('/api/v1', tasks);
app.route('/api/v1', inspirations);
app.route('/api/v1', chat);
app.route('/api/v1', chatSessions);
app.route('/api/v1', assets);
app.route('/api/v1', polish);
app.route('/api/v1', characters);
app.route('/api/v1', locations);
app.route('/api/v1', storyboard);
app.route('/api/v1', storyboardPersistence);
app.route('/api/v1', aiProviders);
app.route('/api/v1', relations);
app.route('/api/v1', uploads);
app.route('/api/v1', generationJobs);
app.route('/api/v1', llmConfigs);
app.route('/api/v1', director);

// --- Error handler ---
app.onError(errorHandler);

// --- 404 handler ---
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
        retryable: false,
      },
    },
    404
  );
});

export default app;
export { app };
```

- [ ] **Step 2: Delete removed files**

```bash
rm server/src/middleware/auth.ts
rm server/src/routes/auth.ts
rm server/src/routes/billing.ts
rm server/src/services/billing.service.ts
rm server/src/lib/stripe.ts
```

- [ ] **Step 3: Remove billing service references from other files**

Search for and remove any imports of the deleted modules in other service files:
```bash
grep -rn "billing\|stripe\|UsageRecord" server/src --include="*.ts" | grep -v "node_modules"
```

Fix each reference found. Common patterns:
- Usage tracking calls in generation services → delete the usage increment lines
- Billing webhook route references → already removed from app.ts

- [ ] **Step 4: Verify backend compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: No errors (or only unrelated pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add -A server/src/
git commit -m "refactor(server): replace auth middleware with default-user, remove billing"
```

---

## Task 4: Backend — Simplify Config and Add Default User Seed

**Files:**
- Modify: `server/src/config/index.ts`
- Modify: `server/src/server.ts`

- [ ] **Step 1: Simplify config/index.ts**

Replace the entire contents of `server/src/config/index.ts` with:

```typescript
/** Parse an integer from env, falling back to defaultVal on NaN */
function safeParseInt(value: string | undefined, defaultVal: number): number {
  const parsed = parseInt(value || String(defaultVal), 10);
  return Number.isNaN(parsed) ? defaultVal : parsed;
}

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  port: safeParseInt(process.env.PORT, 12321),
  logLevel: process.env.LOG_LEVEL || 'info',
  version: '3.0.0',

  // Database (local PostgreSQL)
  databaseUrl: process.env.DATABASE_URL || 'postgresql://dramo:dramo_secret@localhost:5432/dramo',

  // AgentOS
  agentosUrl: process.env.AGENTOS_BASE_URL || 'http://localhost:12322',
  agentosSecurityKey: process.env.AGENTOS_SECURITY_KEY,

  // Encryption (for LLM config storage)
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // Storage (local only)
  storageDriver: 'local' as const,
  storageLocalDir: process.env.STORAGE_LOCAL_DIR || './uploads',
  storageBaseUrl: process.env.STORAGE_BASE_URL || `http://localhost:${safeParseInt(process.env.PORT, 12321)}/uploads`,

  // SSE
  sseTimeoutMs: safeParseInt(process.env.SSE_TIMEOUT_MS, 55000),
  sseHeartbeatMs: safeParseInt(process.env.SSE_HEARTBEAT_MS, 15000),

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:12323',
};

/** Validate critical config on startup */
function validateConfig() {
  if (!config.isDev) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes) in production');
    }
  }
}

validateConfig();
```

- [ ] **Step 2: Add default user seed to server.ts**

Modify `server/src/server.ts` to seed the default user after DB init:

```typescript
import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import app from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { initPrisma, prisma } from './lib/db';
import { ensureDefaultUser } from './lib/default-user';

const port = config.port;

const SERVER_HEADERS_TIMEOUT_MS = 600_000;
const SERVER_REQUEST_TIMEOUT_MS = 720_000;
const SERVER_KEEP_ALIVE_TIMEOUT_MS = 620_000;

logger.info({ port, nodeEnv: config.nodeEnv }, 'Starting server...');

const server = serve({
  fetch: app.fetch,
  port,
}, (info) => {
  logger.info(
    {
      port: info.port,
      nodeEnv: config.nodeEnv,
      url: `http://localhost:${info.port}`,
    },
    'Server started successfully'
  );
});

const httpServer = server as unknown as Server;
httpServer.headersTimeout = SERVER_HEADERS_TIMEOUT_MS;
httpServer.requestTimeout = SERVER_REQUEST_TIMEOUT_MS;
httpServer.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT_MS;

// Initialize DB and seed default user
initPrisma()
  .then(() => ensureDefaultUser(prisma))
  .catch((err) => {
    logger.error({ err }, 'Failed to initialize database — exiting');
    process.exit(1);
  });
```

- [ ] **Step 3: Verify compilation**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/src/config/index.ts server/src/server.ts
git commit -m "refactor(server): simplify config, add default user seed on startup"
```

---

## Task 5: Backend — Remove Supabase Storage, Keep Local Only

**Files:**
- Modify: `server/src/services/storage.service.ts`
- Modify: `server/package.json` (remove dependencies)

- [ ] **Step 1: Rewrite storage.service.ts for local-only**

Replace `server/src/services/storage.service.ts` with:

```typescript
import { config } from '../config';
import { logger } from '../lib/logger';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Local filesystem storage service.
 * All images stored in config.storageLocalDir, served via static route.
 */
export class StorageService {
  constructor() {
    logger.info(`[Storage] Using local storage (dir: ${config.storageLocalDir})`);
  }

  /**
   * Upload image from URL.
   * Returns a URL string by default; pass `{ detailed: true }` to get `{ url, path }`.
   */
  async uploadImageFromUrl(
    projectId: string,
    imageUrl: string,
    opts?: { detailed?: boolean }
  ): Promise<string | { url: string; path: string }> {
    logger.info(`[Storage] Uploading image from URL for project ${projectId}`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const response = await fetch(imageUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = this.getExtensionFromUrl(imageUrl) || 'png';
      const filename = `${uuidv4()}.${ext}`;
      const result = await this.uploadToLocal(projectId, filename, buffer);
      return opts?.detailed ? result : result.url;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`[Storage] Image fetch timeout after 60s`);
        throw new Error('Image download timeout');
      }
      logger.error(`[Storage] Failed to upload image from URL: ${error}`);
      throw error;
    }
  }

  /**
   * Upload image from base64.
   * Returns a URL string by default; pass `{ detailed: true }` to get `{ url, path }`.
   */
  async uploadImageFromBase64(
    projectId: string,
    base64Data: string,
    opts?: { detailed?: boolean }
  ): Promise<string | { url: string; path: string }> {
    logger.info(`[Storage] Uploading image from base64 for project ${projectId}`);
    try {
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');
      const formatMatch = base64Data.match(/^data:image\/(\w+);base64,/);
      const ext = formatMatch ? formatMatch[1] : 'png';
      const filename = `${uuidv4()}.${ext}`;
      const result = await this.uploadToLocal(projectId, filename, buffer);
      return opts?.detailed ? result : result.url;
    } catch (error) {
      logger.error(`[Storage] Failed to upload image from base64: ${error}`);
      throw error;
    }
  }

  /**
   * Get URL for a stored file path.
   * For local storage, simply constructs the public URL.
   */
  async getSignedUrl(filePath: string, _expiresInSec?: number): Promise<string> {
    const publicUrl = `${config.storageBaseUrl}/${filePath}`;
    return publicUrl;
  }

  /**
   * Get URLs for multiple file paths.
   */
  async getSignedUrls(filePaths: string[], expiresInSec?: number): Promise<string[]> {
    return Promise.all(filePaths.map(fp => this.getSignedUrl(fp, expiresInSec)));
  }

  private async uploadToLocal(projectId: string, filename: string, buffer: Buffer): Promise<{ url: string; path: string }> {
    const projectDir = path.join(config.storageLocalDir, 'projects', projectId);
    await fs.mkdir(projectDir, { recursive: true });

    const filePath = path.join(projectDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `${config.storageBaseUrl}/projects/${projectId}/${filename}`;
    const storagePath = `projects/${projectId}/${filename}`;
    logger.info(`[Storage] Uploaded to local: ${publicUrl}`);
    return { url: publicUrl, path: storagePath };
  }

  private getExtensionFromUrl(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const ext = path.extname(pathname).slice(1);
      return ext || null;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 2: Remove unused dependencies from server/package.json**

```bash
cd server && npm uninstall stripe @supabase/supabase-js jsonwebtoken bcrypt @types/jsonwebtoken @types/bcrypt
```

- [ ] **Step 3: Verify compilation**

```bash
cd server && npx tsc --noEmit
```

Fix any remaining references to removed packages (grep for `stripe`, `@supabase`, `jsonwebtoken`, `bcrypt`).

- [ ] **Step 4: Commit**

```bash
git add server/src/services/storage.service.ts server/package.json server/package-lock.json
git commit -m "refactor(server): remove Supabase storage, local-only mode"
```

---

## Task 6: Backend — Clean Up Remaining References

**Files:**
- Various server files that may reference removed modules

- [ ] **Step 1: Find all remaining references to removed code**

```bash
cd server && grep -rn "billing\|stripe\|Stripe\|UsageRecord\|Subscription\|bcrypt\|jsonwebtoken\|jwt\|supabase\|@supabase" src/ --include="*.ts" | grep -v "node_modules"
```

- [ ] **Step 2: Fix each reference**

Common patterns to fix:
- `src/services/usage.service.ts` (if exists) → delete entire file
- Any service that calls `usageService.increment(...)` → remove those lines
- Any route that imports from deleted files → remove the import
- `AuthEnv` type imports from `middleware/auth` → change to import from `middleware/default-user`
- `config.jwtSecret` references → remove (no longer in config)
- `config.stripeSecretKey` references → remove
- `config.supabaseUrl` references → remove

- [ ] **Step 3: Fix AuthEnv import in all route files**

Many route files import `AuthEnv` from the old auth middleware. Update them:

```bash
cd server && grep -rn "from.*middleware/auth" src/ --include="*.ts"
```

For each file found, change:
```typescript
import type { AuthEnv } from '../middleware/auth';
```
to:
```typescript
import type { AuthEnv } from '../middleware/default-user';
```

- [ ] **Step 4: Verify full compilation**

```bash
cd server && npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add -A server/src/
git commit -m "refactor(server): clean up all removed module references"
```

---

## Task 7: Frontend — Remove NextAuth and Simplify Proxy

**Files:**
- Modify: `web/app/api/_utils/proxy.ts`
- Modify: `web/app/api/_utils/route-factory.ts`
- Delete: `web/app/api/auth/` (entire directory)
- Delete: `web/lib/auth/` (entire directory)

- [ ] **Step 1: Rewrite proxy.ts without NextAuth**

Replace `web/app/api/_utils/proxy.ts` with:

```typescript
import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:12321";

const SAFE_PARAM_RE = /^[a-zA-Z0-9_\-\.]+$/;

export function isValidRouteParam(param: string): boolean {
  return SAFE_PARAM_RE.test(param) && !param.includes("..");
}

export function validateRouteParam(param: string, paramName: string): NextResponse | null {
  if (!isValidRouteParam(param)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PARAMETER",
          message: `Invalid ${paramName}`,
          retryable: false,
        },
      },
      { status: 400 }
    );
  }
  return null;
}

function resolveBackendUrl(targetPath: string, request: Request, appendIncomingQuery: boolean) {
  const normalizedBase = backendBaseUrl.replace(/\/$/, "");
  const incomingUrl = new URL(request.url);

  const rawTarget = targetPath.startsWith("http")
    ? targetPath
    : `${normalizedBase}/${targetPath.replace(/^\//, "")}`;

  const finalUrl = new URL(rawTarget);

  if (appendIncomingQuery && incomingUrl.search) {
    const separator = finalUrl.search ? "&" : "?";
    finalUrl.search += `${separator}${incomingUrl.search.slice(1)}`;
  } else if (!appendIncomingQuery && !rawTarget.includes("?") && incomingUrl.search) {
    finalUrl.search = incomingUrl.search;
  }

  return finalUrl;
}

interface ProxyOptions {
  method?: string;
  headers?: Record<string, string>;
  cache?: RequestCache;
  body?: BodyInit | Record<string, unknown> | null;
  appendQuery?: boolean;
  timeoutMs?: number;
  // requireAuth kept for API compat but ignored (always passes through)
  requireAuth?: boolean;
}

async function resolveRequestBody(
  request: Request,
  method: string,
  explicitBody: ProxyOptions["body"],
  headers: Headers
): Promise<BodyInit | undefined> {
  if (method === "GET" || method === "HEAD") {
    return undefined;
  }

  if (explicitBody !== undefined) {
    if (
      explicitBody instanceof FormData ||
      explicitBody instanceof Blob ||
      explicitBody instanceof ArrayBuffer ||
      explicitBody instanceof Uint8Array
    ) {
      headers.delete("Content-Type");
      return explicitBody as BodyInit;
    }

    if (typeof explicitBody === "string") {
      return explicitBody;
    }

    headers.set("Content-Type", "application/json");
    return JSON.stringify(explicitBody);
  }

  const originalContentType = request.headers.get("content-type") ?? "";

  if (originalContentType.includes("multipart/form-data")) {
    headers.delete("Content-Type");
    return await request.formData();
  }

  if (originalContentType.includes("application/json")) {
    const raw = await request.text();
    return raw || undefined;
  }

  if (originalContentType.includes("application/x-www-form-urlencoded")) {
    return await request.text();
  }

  if (!originalContentType) {
    const raw = await request.text();
    return raw || undefined;
  }

  headers.set("Content-Type", originalContentType);
  const buffer = await request.arrayBuffer();
  return buffer.byteLength > 0 ? buffer : undefined;
}

export async function proxyRequest(
  request: Request,
  targetPath: string,
  options: ProxyOptions = {}
) {
  if (targetPath.includes("..") || targetPath.includes("//") || /%2[eEfF]/i.test(targetPath)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PATH",
          message: "Invalid request path",
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  const method = options.method ?? request.method;
  const headers = new Headers(options.headers ?? {});

  // No auth token injection — backend uses default user middleware

  if (!headers.has("Content-Type")) {
    const incomingContentType = request.headers.get("content-type");
    if (incomingContentType) {
      headers.set("Content-Type", incomingContentType);
    }
  }

  const body = await resolveRequestBody(request, method, options.body, headers);
  const targetUrl = resolveBackendUrl(
    targetPath,
    request,
    options.appendQuery ?? false
  );

  try {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const backendResponse = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: options.cache ?? "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    backendResponse.headers.forEach((value, key) => {
      if (["content-type", "content-disposition"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });
    responseHeaders.set("Cache-Control", "no-store");

    const contentType = backendResponse.headers.get("content-type") ?? "";

    // SSE streaming passthrough
    if (contentType.includes("text/event-stream")) {
      responseHeaders.set("Content-Type", "text/event-stream");
      responseHeaders.set("Cache-Control", "no-cache");
      responseHeaders.set("Connection", "keep-alive");
      return new NextResponse(backendResponse.body, {
        status: backendResponse.status,
        headers: responseHeaders,
      });
    }

    if (contentType.includes("application/json")) {
      const text = await backendResponse.text();
      try {
        const data = JSON.parse(text);
        return NextResponse.json(data, {
          status: backendResponse.status,
          headers: responseHeaders,
        });
      } catch {
        return new NextResponse(text, {
          status: backendResponse.status,
          headers: responseHeaders,
        });
      }
    }

    const arrayBuffer = await backendResponse.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: backendResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(
      `[proxyRequest] Failed to proxy ${method} ${targetUrl.toString()}:`,
      error
    );

    const isTimeout = error instanceof Error && error.name === "AbortError";

    return NextResponse.json(
      {
        error: {
          code: isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
          message: isTimeout
            ? "后端服务响应超时，请稍后重试"
            : "后端服务暂不可用，请稍后重试",
          retryable: true,
        },
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
```

- [ ] **Step 2: Simplify route-factory.ts**

Replace `web/app/api/_utils/route-factory.ts` with:

```typescript
import { type NextRequest } from 'next/server';
import { proxyRequest } from './proxy';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RouteContext = { params: Promise<Record<string, string>> };
type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;

interface ProxyRouteOptions {
  requireAuth?: boolean; // kept for API compat, ignored
  appendQuery?: boolean;
  timeoutMs?: number;
}

function interpolatePath(
  template: string,
  params: Record<string, string>
): string {
  return template.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, (_, key) => {
    const value = params[key];
    if (value === undefined || value === '') {
      throw new Error(`[route-factory] Missing route param: ${key}`);
    }
    return encodeURIComponent(value);
  });
}

export function createProxyRoute(
  backendPath: string,
  methods: HttpMethod[],
  options: ProxyRouteOptions = {}
): Record<HttpMethod, RouteHandler> {
  const { appendQuery, timeoutMs } = options;

  const handler: RouteHandler = async (req, ctx) => {
    const params = await ctx.params;
    const resolvedPath = interpolatePath(backendPath, params);
    return proxyRequest(req, resolvedPath, {
      ...(appendQuery !== undefined && { appendQuery }),
      ...(timeoutMs !== undefined && { timeoutMs }),
    });
  };

  return Object.fromEntries(
    methods.map((method) => [method, handler])
  ) as Record<HttpMethod, RouteHandler>;
}
```

- [ ] **Step 3: Delete auth API routes and lib**

```bash
rm -rf web/app/api/auth/
rm -rf web/lib/auth/
rm -f web/app/api/debug/session/route.ts
```

- [ ] **Step 4: Commit**

```bash
git add -A web/app/api/ web/lib/auth/
git commit -m "refactor(web): remove NextAuth, simplify proxy to passthrough"
```

---

## Task 8: Frontend — Remove Billing and Subscription Components

**Files:**
- Delete: `web/app/pricing/page.tsx`
- Delete: `web/app/billing/` (entire directory)
- Delete: `web/app/api/billing/` (entire directory)
- Delete: `web/components/billing/` (entire directory)
- Delete: `web/lib/billing/` (entire directory)
- Delete: `web/lib/api/billing.ts`
- Delete: `web/lib/hooks/use-subscription.ts`
- Delete: `web/lib/hooks/use-feature-gate.ts`
- Delete: `web/mock/handlers/billing.ts`
- Modify: `web/app/providers.tsx`

- [ ] **Step 1: Delete all billing-related files**

```bash
rm -rf web/app/pricing/
rm -rf web/app/billing/
rm -rf web/app/api/billing/
rm -rf web/components/billing/
rm -rf web/lib/billing/
rm -f web/lib/api/billing.ts
rm -f web/lib/hooks/use-subscription.ts
rm -f web/lib/hooks/use-feature-gate.ts
rm -f web/mock/handlers/billing.ts
```

- [ ] **Step 2: Simplify providers.tsx**

Replace `web/app/providers.tsx` with:

```typescript
"use client";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Remove next-auth dependency**

```bash
cd web && npm uninstall next-auth
```

- [ ] **Step 4: Find and fix remaining billing/auth imports**

```bash
cd web && grep -rn "useSession\|getServerSession\|signIn\|signOut\|next-auth\|@/lib/auth\|useSubscription\|useFeatureGate\|SubscriptionProvider\|UpgradeDialog\|UpgradePrompt\|PastDueBanner\|@/lib/billing\|@/components/billing" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next
```

For each reference found:
- `useSession` → remove the hook call and any conditional rendering based on session
- `signIn`/`signOut` → remove the button/handler
- `useSubscription`/`useFeatureGate` → remove the hook and any gating logic (always allow)
- `UpgradeDialog`/`UpgradePrompt`/`PastDueBanner` → remove the component render

- [ ] **Step 5: Commit**

```bash
git add -A web/
git commit -m "refactor(web): remove all billing components and subscription logic"
```

---

## Task 9: Frontend — Simplify Landing Page and Remove Login/Register

**Files:**
- Modify: `web/app/page.tsx`
- Delete: `web/app/login/page.tsx`
- Delete: `web/app/register/page.tsx`
- Delete: `web/app/profile/page.tsx` (if auth-dependent)

- [ ] **Step 1: Simplify the landing page**

Replace `web/app/page.tsx` to remove `useSession` and redirect directly:

In the existing `page.tsx`, make these changes:
1. Remove `import { useSession } from "next-auth/react";`
2. Remove `const { status } = useSession();`
3. Change `handleGetStarted` to always navigate to `/projects`:

```typescript
const handleGetStarted = () => {
  router.push("/projects");
};
```

Remove the conditional login redirect logic entirely.

- [ ] **Step 2: Delete auth pages**

```bash
rm -f web/app/login/page.tsx
rm -f web/app/register/page.tsx
rm -rf web/app/login/
rm -rf web/app/register/
```

- [ ] **Step 3: Check and fix other pages**

Check `web/app/projects/page.tsx` and `web/app/settings/page.tsx` for session checks:

```bash
grep -n "useSession\|getServerSession\|redirect.*login" web/app/projects/page.tsx web/app/settings/page.tsx web/app/home/page.tsx 2>/dev/null
```

Remove any redirect-to-login logic. The app is now always accessible.

- [ ] **Step 4: Fix SiteHeader if it has login/logout buttons**

Check `web/components/landing/SiteHeader.tsx` for auth buttons and remove them.

- [ ] **Step 5: Verify frontend builds**

```bash
cd web && npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A web/
git commit -m "refactor(web): remove login/register pages, simplify landing"
```

---

## Task 10: Frontend — Fix API Client Billing References

**Files:**
- Modify: `web/lib/api/client.ts`
- Any other API client files with billing references

- [ ] **Step 1: Remove upgrade dialog callback from API client**

In `web/lib/api/client.ts`, find and remove the billing-related error handling:

```bash
grep -n "showUpgrade\|getUpgradeDialogCallback\|SubscriptionProvider" web/lib/api/client.ts
```

Remove lines like:
```typescript
const showUpgrade = getUpgradeDialogCallback();
// SubscriptionProvider not mounted — ignore
```

Replace with standard error handling (or just remove the special case entirely).

- [ ] **Step 2: Remove useGenerationJobs auth dependency if any**

Check `web/lib/hooks/useGenerationJobs.tsx`:
```bash
grep -n "useSession\|session\|auth" web/lib/hooks/useGenerationJobs.tsx
```

Remove any session-dependent logic.

- [ ] **Step 3: Verify frontend builds clean**

```bash
cd web && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A web/
git commit -m "refactor(web): clean up API client billing/auth references"
```

---

## Task 11: Docker Compose and Deployment Config

**Files:**
- Modify: `docker-compose.yml`
- Modify: `deploy/nginx.conf`
- Modify: `deploy/setup-dramo.sh`
- Create: `.env.example`

- [ ] **Step 1: Rewrite docker-compose.yml**

Replace `docker-compose.yml` with:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: dramo
      POSTGRES_USER: dramo
      POSTGRES_PASSWORD: ${DB_PASSWORD:-dramo_secret}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dramo -d dramo"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - dramo-network

  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 12321
      DATABASE_URL: postgresql://dramo:${DB_PASSWORD:-dramo_secret}@postgres:5432/dramo
      STORAGE_DRIVER: local
      STORAGE_LOCAL_DIR: /app/uploads
      STORAGE_BASE_URL: ${PUBLIC_URL:-http://localhost}/uploads
      AGENTOS_BASE_URL: http://agentos:12322
      AGENTOS_SECURITY_KEY: ${AGENTOS_KEY:-default_agentos_key}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      FRONTEND_URL: ${PUBLIC_URL:-http://localhost}
    volumes:
      - uploads:/app/uploads
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:12321/api/v1/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - dramo-network

  agentos:
    build:
      context: ./agentos
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    environment:
      PORT: 12322
      AGENTOS_SECURITY_KEY: ${AGENTOS_KEY:-default_agentos_key}
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:12322/health')"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - dramo-network

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: /api
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    environment:
      NEXT_PUBLIC_API_URL: /api
      BACKEND_API_URL: http://api:12321
    networks:
      - dramo-network

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "${PORT:-80}:80"
    depends_on:
      - web
      - api
    volumes:
      - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - uploads:/var/www/uploads:ro
    networks:
      - dramo-network

volumes:
  postgres_data:
  uploads:

networks:
  dramo-network:
    driver: bridge
```

- [ ] **Step 2: Update nginx.conf to serve uploads**

Add an uploads location to `deploy/nginx.conf`:

```nginx
# Add this location block for serving uploaded images directly
location /uploads/ {
    alias /var/www/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

- [ ] **Step 3: Create .env.example**

Create `.env.example` in the project root:

```env
# === Dramo Configuration ===

# Database password (auto-generated by setup script)
DB_PASSWORD=dramo_secret

# Encryption key for LLM config storage (64 hex chars = 32 bytes)
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=

# AgentOS internal communication key
AGENTOS_KEY=default_agentos_key

# Public-facing URL (change for production domain)
PUBLIC_URL=http://localhost

# Port to expose (default: 80)
PORT=80

# === LLM API Keys (optional here — can also configure in UI) ===
# OPENAI_API_KEY=sk-xxx
# ARK_API_KEY=xxx
# HUNYUAN_OPENAPI_KEY=xxx
```

- [ ] **Step 4: Update setup-dramo.sh**

Simplify `deploy/setup-dramo.sh` to remove Stripe/auth prompts:

Remove all prompts for:
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_*`
- `SUPABASE_*`
- `NEXTAUTH_SECRET`

Keep only:
- Docker installation
- `.env` generation with `ENCRYPTION_KEY`, `DB_PASSWORD`, `AGENTOS_KEY`
- `docker compose up -d`

- [ ] **Step 5: Remove switch-env.sh (no longer needed)**

The debug/prod split is unnecessary for single-server deployment. Remove or simplify:

```bash
rm -f switch-env.sh
rm -f .env.debug
rm -f .env.production
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml deploy/ .env.example
git rm -f switch-env.sh .env.debug .env.production 2>/dev/null
git commit -m "refactor(deploy): single-server Docker Compose with local PostgreSQL"
```

---

## Task 12: Integration Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Verify backend compiles and starts**

```bash
cd server && npx tsc --noEmit && echo "OK"
```

- [ ] **Step 2: Verify frontend builds**

```bash
cd web && npm run build
```

- [ ] **Step 3: Test Docker Compose startup**

```bash
cp .env.example .env
# Fill in ENCRYPTION_KEY
ENCRYPTION_KEY=$(openssl rand -hex 32)
sed -i "s/^ENCRYPTION_KEY=$/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env

docker compose up -d --build
docker compose logs -f api --tail=20
```

Expected: API starts, seeds default user, no crash.

- [ ] **Step 4: Verify health endpoints**

```bash
curl http://localhost/api/v1/health
```

Expected: `{"status":"ok"}` or similar.

- [ ] **Step 5: Verify project creation works**

```bash
curl -X POST http://localhost/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "description": "测试"}'
```

Expected: 201 with project JSON (userId = default-local-user).

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "fix: integration fixes after simplification refactoring"
```

---

## Task 13: Clean Up Documentation

**Files:**
- Modify: `CLAUDE.md`
- Delete: `DEPLOYMENT_ANALYSIS.md`, `DEPLOYMENT_QUICK_SUMMARY.md`, `CRITICAL_ISSUES_DETAILED.md`
- Delete: other analysis files from root

- [ ] **Step 1: Remove analysis artifacts from root**

```bash
rm -f DEPLOYMENT_ANALYSIS.md DEPLOYMENT_QUICK_SUMMARY.md CRITICAL_ISSUES_DETAILED.md
rm -f ANALYSIS_INDEX.md BEFORE_AFTER_COMPARISON.md BUG_REFERENCE_GUIDE.md
rm -f DATA_FLOW_EXPLANATION.md DETAILED_FLOW_DIAGRAM.md EXECUTION_CHECKLIST.md
rm -f IMPLEMENTATION_GUIDE.md INVESTIGATION_SUMMARY.txt QUICK_REFERENCE.txt
rm -f ROOT_CAUSE_ANALYSIS.md
```

- [ ] **Step 2: Update CLAUDE.md**

Update the project documentation to reflect the new simplified architecture:
- Remove Supabase/Stripe references
- Update deployment instructions
- Update environment variables section
- Note that auth is now auto (default user)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: update project documentation for single-server deployment"
```
