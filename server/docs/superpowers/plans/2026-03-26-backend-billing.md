# Backend Stripe Billing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Stripe subscription billing endpoints in the Hono backend, providing the 5 API endpoints the frontend already proxies to.

**Architecture:** Prisma Subscription model stores billing state. BillingService encapsulates all Stripe SDK + DB logic. Routes follow existing Hono pattern. Webhook syncs Stripe events to local DB. All upserts keyed by `userId` for idempotency.

**Tech Stack:** Hono, Prisma, Stripe SDK, TypeScript, PostgreSQL (Supabase), Vercel Serverless.

**Spec:** `docs/superpowers/specs/2026-03-26-backend-billing-design.md`

**Working directory:** `/Users/halyu/Documents/Code/story_agent`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/stripe.ts` | Stripe SDK client singleton |
| `src/services/billing.service.ts` | All billing business logic (subscription CRUD, Stripe API calls, webhook handling) |
| `src/routes/billing.ts` | 5 HTTP endpoints mapping to BillingService methods |

### Modified Files

| File | Changes |
|------|---------|
| `src/db/schema.prisma` | Add Subscription model, User relation |
| `src/lib/errors.ts` | Add 4 new ErrorCode entries + status mappings |
| `src/config/index.ts` | Add Stripe + frontend URL config, production validation |
| `src/middleware/auth.ts` | Add webhook to PUBLIC_PATHS |
| `src/app.ts` | Register billing routes |
| `env.example` | Add Stripe env vars section |
| `package.json` | Add `stripe` dependency |
| `src/services/project.service.ts` | Add plan limit check in createProject |

---

## Task 1: Install Stripe and Update Config

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/config/index.ts`
- Modify: `env.example`

- [ ] **Step 1: Install stripe package**

```bash
cd /Users/halyu/Documents/Code/story_agent
npm install stripe
```

- [ ] **Step 2: Add Stripe config to `src/config/index.ts`**

Add these fields before the closing `};` of the config object (after the SSE section):

```typescript
  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePriceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  stripePriceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',

  // Frontend URL (for Checkout redirect URLs)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:12323',
```

Add production validation inside `validateConfig()`, after the existing DATABASE_URL check:

```typescript
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required in production');
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required in production');
    }
    if (!process.env.STRIPE_PRICE_PRO_MONTHLY) {
      throw new Error('STRIPE_PRICE_PRO_MONTHLY is required in production');
    }
    if (!process.env.STRIPE_PRICE_PRO_YEARLY) {
      throw new Error('STRIPE_PRICE_PRO_YEARLY is required in production');
    }
    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL is required in production');
    }
```

- [ ] **Step 3: Add Stripe section to `env.example`**

Append before the AGENTOS-ONLY section at the end:

```env
# =================================
# STRIPE BILLING
# =================================
# Create Products & Prices in Stripe Dashboard, paste IDs here
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx

# Frontend URL (for Checkout success/cancel redirects)
FRONTEND_URL=http://localhost:12323
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/config/index.ts env.example
git commit -m "feat(billing): install stripe SDK and add billing config"
```

---

## Task 2: Prisma Schema — Subscription Model

**Files:**
- Modify: `src/db/schema.prisma`

- [ ] **Step 1: Add Subscription model to schema**

Append at the end of `src/db/schema.prisma`:

```prisma
// Stripe subscription billing
model Subscription {
  id                    String    @id @default(cuid())
  userId                String    @unique
  stripeCustomerId      String    @unique
  stripeSubscriptionId  String?   @unique
  planId                String    @default("free")
  status                String    @default("active")
  billingInterval       String?
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  cancelAtPeriodEnd     Boolean   @default(false)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([stripeCustomerId])
  @@index([stripeSubscriptionId])
}
```

- [ ] **Step 2: Add relation to User model**

In the `User` model, after the `projects Project[]` line, add:

```prisma
  subscription Subscription?
```

- [ ] **Step 3: Generate Prisma client and create migration**

```bash
npx prisma migrate dev --name add-subscription-model
```

Expected: Migration created successfully, Prisma client regenerated.

- [ ] **Step 4: Verify**

```bash
npx prisma validate
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.prisma prisma/
git commit -m "feat(billing): add Subscription model to Prisma schema"
```

---

## Task 3: Error Codes and Stripe Client

**Files:**
- Modify: `src/lib/errors.ts`
- Create: `src/lib/stripe.ts`

- [ ] **Step 1: Add billing error codes to `src/lib/errors.ts`**

In the `ErrorCode` enum, after `WORKER_ERROR = 'WORKER_ERROR',`, add:

```typescript
  // Billing errors
  ALREADY_SUBSCRIBED = 'ALREADY_SUBSCRIBED',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',
  NO_STRIPE_CUSTOMER = 'NO_STRIPE_CUSTOMER',
```

In the `ERROR_STATUS_MAP`, after `[ErrorCode.WORKER_ERROR]: 500,`, add:

```typescript
  [ErrorCode.ALREADY_SUBSCRIBED]: 400,
  [ErrorCode.UPSTREAM_ERROR]: 502,
  [ErrorCode.PLAN_LIMIT_EXCEEDED]: 403,
  [ErrorCode.NO_STRIPE_CUSTOMER]: 400,
```

- [ ] **Step 2: Create Stripe client singleton**

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';
import { config } from '../config';

export const stripe = config.stripeSecretKey
  ? new Stripe(config.stripeSecretKey, {
      apiVersion: '2025-12-18.acacia' as Stripe.LatestApiVersion,
    })
  : (null as unknown as Stripe); // null in dev without key — service will guard
```

Note: The `as Stripe.LatestApiVersion` cast is needed because the exact version string may not match the SDK's type. If the installed SDK version has a different latest API version, use the SDK's exported type directly. The guard `config.stripeSecretKey ? ... : null` avoids crashing in dev when no Stripe key is configured.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/errors.ts src/lib/stripe.ts
git commit -m "feat(billing): add billing error codes and Stripe client"
```

---

## Task 4: BillingService — Core Implementation

**Files:**
- Create: `src/services/billing.service.ts`

This is the largest task. The service encapsulates all billing logic.

- [ ] **Step 1: Create billing service**

```typescript
// src/services/billing.service.ts
import Stripe from 'stripe';
import { prisma } from '../lib/db';
import { stripe } from '../lib/stripe';
import { config } from '../config';
import { AppException, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';

interface SubscriptionResponse {
  readonly planId: string;
  readonly status: string;
  readonly billingInterval: string | null;
  readonly currentPeriodEnd: string | null;
  readonly cancelAtPeriodEnd: boolean;
}

interface UsageResponse {
  readonly aiGenerations: { readonly used: number; readonly limit: number | null; readonly resetsAt: string | null };
  readonly projects: { readonly used: number; readonly limit: number | null };
  readonly characters: { readonly used: number; readonly limit: number | null };
}

const DEFAULT_SUBSCRIPTION: SubscriptionResponse = {
  planId: 'free',
  status: 'active',
  billingInterval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

const PLAN_LIMITS: Record<string, { projects: number | null; characters: number | null; aiGenerations: number | null }> = {
  free: { projects: 1, characters: 5, aiGenerations: 10 },
  pro: { projects: null, characters: null, aiGenerations: null },
  enterprise: { projects: null, characters: null, aiGenerations: null },
};

export class BillingService {
  // ─── Queries ───────────────────────────────────────────────

  async getSubscription(userId: string): Promise<SubscriptionResponse> {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return DEFAULT_SUBSCRIPTION;

    return {
      planId: sub.planId,
      status: sub.status,
      billingInterval: sub.billingInterval,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  }

  async getUsage(userId: string): Promise<UsageResponse> {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const planId = sub?.planId ?? 'free';
    const limits = PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;

    // Count projects
    const projectCount = await prisma.project.count({ where: { userId } });

    // Count characters (two-step: projects → characterAssets)
    const projectIds = await prisma.project.findMany({
      where: { userId },
      select: { id: true },
    });
    const characterCount = projectIds.length > 0
      ? await prisma.characterAsset.count({
          where: { projectId: { in: projectIds.map((p) => p.id) } },
        })
      : 0;

    // AI generations: TODO — hardcode 0 until UsageRecord table exists
    const aiUsed = 0;

    // Compute reset time (next midnight UTC)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    return {
      aiGenerations: {
        used: aiUsed,
        limit: limits.aiGenerations,
        resetsAt: limits.aiGenerations !== null ? tomorrow.toISOString() : null,
      },
      projects: { used: projectCount, limit: limits.projects },
      characters: { used: characterCount, limit: limits.characters },
    };
  }

  // ─── Checkout & Portal ─────────────────────────────────────

  async createCheckoutSession(
    userId: string,
    email: string,
    planId: string,
    interval: string,
  ): Promise<{ url: string }> {
    // Validate input
    if (planId !== 'pro') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Only pro plan is available for checkout');
    }
    if (interval !== 'month' && interval !== 'year') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Interval must be "month" or "year"');
    }

    // Check existing subscription
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing && existing.planId !== 'free' && existing.status === 'active' && !existing.cancelAtPeriodEnd) {
      throw new AppException(ErrorCode.ALREADY_SUBSCRIBED, '你已经是 Pro 用户');
    }

    // Get or create Stripe customer
    const stripeCustomerId = await this.getOrCreateCustomer(userId, email);

    // Select price ID
    const priceId = interval === 'month'
      ? config.stripePriceProMonthly
      : config.stripePriceProYearly;

    if (!priceId) {
      throw new AppException(ErrorCode.INTERNAL_ERROR, 'Stripe price not configured');
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${config.frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/billing/cancel`,
        metadata: { userId, planId },
      });

      if (!session.url) {
        throw new AppException(ErrorCode.UPSTREAM_ERROR, 'Stripe did not return a checkout URL');
      }

      return { url: session.url };
    } catch (error) {
      if (error instanceof AppException) throw error;
      logger.error({ err: error }, '[BillingService] Stripe checkout session creation failed');
      throw new AppException(ErrorCode.UPSTREAM_ERROR, '支付服务暂不可用，请稍后重试', { retryable: true });
    }
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeCustomerId) {
      throw new AppException(ErrorCode.NO_STRIPE_CUSTOMER, '未找到支付信息，请先订阅');
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${config.frontendUrl}/pricing`,
      });

      return { url: session.url };
    } catch (error) {
      logger.error({ err: error }, '[BillingService] Stripe portal session creation failed');
      throw new AppException(ErrorCode.UPSTREAM_ERROR, '支付服务暂不可用，请稍后重试', { retryable: true });
    }
  }

  // ─── Webhook ───────────────────────────────────────────────

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        logger.info({ eventType: event.type }, '[BillingService] Unhandled webhook event type');
    }
  }

  // ─── Private: Webhook Handlers ─────────────────────────────

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      logger.warn({ sessionId: session.id }, '[BillingService] checkout.session.completed missing userId in metadata');
      return;
    }

    const stripeSubscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    if (!stripeSubscriptionId) {
      logger.warn({ sessionId: session.id }, '[BillingService] checkout.session.completed missing subscription');
      return;
    }

    // Fetch full subscription from Stripe
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    await this.syncSubscriptionFromStripe(stripeSub, userId);
  }

  private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription): Promise<void> {
    const customerId = typeof stripeSub.customer === 'string'
      ? stripeSub.customer
      : stripeSub.customer.id;

    const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
    if (!sub) {
      logger.warn({ customerId }, '[BillingService] subscription.updated for unknown customer');
      return;
    }

    await this.syncSubscriptionFromStripe(stripeSub, sub.userId);
  }

  private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
    const customerId = typeof stripeSub.customer === 'string'
      ? stripeSub.customer
      : stripeSub.customer.id;

    const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
    if (!sub) {
      logger.warn({ customerId }, '[BillingService] subscription.deleted for unknown customer');
      return;
    }

    await prisma.subscription.update({
      where: { userId: sub.userId },
      data: {
        planId: 'free',
        status: 'canceled',
        stripeSubscriptionId: null,
        billingInterval: null,
        cancelAtPeriodEnd: false,
      },
    });

    logger.info({ userId: sub.userId }, '[BillingService] Subscription deleted, reverted to free');
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

    if (!customerId) return;

    const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
    if (!sub) {
      logger.warn({ customerId }, '[BillingService] invoice.payment_failed for unknown customer');
      return;
    }

    await prisma.subscription.update({
      where: { userId: sub.userId },
      data: { status: 'past_due' },
    });

    logger.warn({ userId: sub.userId }, '[BillingService] Payment failed, marked as past_due');
  }

  // ─── Private: Helpers ──────────────────────────────────────

  private async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    // Check existing
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    // Create in Stripe
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });

    // Upsert subscription record with free plan
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customer.id,
        planId: 'free',
        status: 'active',
      },
      update: {
        stripeCustomerId: customer.id,
      },
    });

    return customer.id;
  }

  private async syncSubscriptionFromStripe(
    stripeSub: Stripe.Subscription,
    userId: string,
  ): Promise<void> {
    const customerId = typeof stripeSub.customer === 'string'
      ? stripeSub.customer
      : stripeSub.customer.id;

    const priceId = stripeSub.items.data[0]?.price?.id;
    const planId = this.getPlanIdFromPriceId(priceId);
    const interval = stripeSub.items.data[0]?.price?.recurring?.interval ?? null;

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSub.id,
        planId,
        status: stripeSub.status,
        billingInterval: interval,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: stripeSub.id,
        planId,
        status: stripeSub.status,
        billingInterval: interval,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });

    logger.info({ userId, planId, status: stripeSub.status }, '[BillingService] Subscription synced');
  }

  private getPlanIdFromPriceId(priceId: string | undefined): string {
    if (!priceId) return 'free';
    if (priceId === config.stripePriceProMonthly || priceId === config.stripePriceProYearly) {
      return 'pro';
    }
    logger.warn({ priceId }, '[BillingService] Unknown price ID, defaulting to free');
    return 'free';
  }

  getPlanLimits(planId: string): { projects: number | null; characters: number | null; aiGenerations: number | null } {
    return PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/services/billing.service.ts
git commit -m "feat(billing): add BillingService with subscription, checkout, portal, and webhook handling"
```

---

## Task 5: Billing Routes

**Files:**
- Create: `src/routes/billing.ts`
- Modify: `src/middleware/auth.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create billing routes**

```typescript
// src/routes/billing.ts
import { Hono } from 'hono';
import { BillingService } from '../services/billing.service';
import { stripe } from '../lib/stripe';
import { config } from '../config';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';

const billing = new Hono<AuthEnv>();
const billingService = new BillingService();

// GET /api/billing/subscription — current user's subscription
billing.get('/api/billing/subscription', async (c) => {
  const userId = c.get('user').userId;
  const result = await billingService.getSubscription(userId);
  return c.json(result);
});

// GET /api/billing/usage — current user's usage stats
billing.get('/api/billing/usage', async (c) => {
  const userId = c.get('user').userId;
  const result = await billingService.getUsage(userId);
  return c.json(result);
});

// POST /api/billing/checkout-session — create Stripe Checkout
billing.post('/api/billing/checkout-session', async (c) => {
  const userId = c.get('user').userId;
  const email = c.get('user').email;
  const { planId, interval } = await c.req.json();

  const result = await billingService.createCheckoutSession(userId, email, planId, interval);
  return c.json(result);
});

// POST /api/billing/portal-session — create Stripe Customer Portal
billing.post('/api/billing/portal-session', async (c) => {
  const userId = c.get('user').userId;
  const result = await billingService.createPortalSession(userId);
  return c.json(result);
});

// POST /api/billing/webhook — Stripe webhook (public, no auth)
billing.post('/api/billing/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  const requestId = c.get('requestId');

  if (!signature) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'Missing stripe-signature header', retryable: false }, requestId },
      400,
    );
  }

  // Read raw body for signature verification
  const rawBody = await c.req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
  } catch (err) {
    logger.warn({ err }, '[billing/webhook] Signature verification failed');
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'Invalid webhook signature', retryable: false }, requestId },
      400,
    );
  }

  try {
    await billingService.handleWebhookEvent(event);
  } catch (err) {
    logger.error({ err, eventType: event.type }, '[billing/webhook] Event processing failed');
    // Still return 200 to prevent Stripe retries for processing errors
  }

  return c.json({ received: true });
});

export { billing };
```

- [ ] **Step 2: Add webhook to PUBLIC_PATHS in auth middleware**

In `src/middleware/auth.ts`, add to the `PUBLIC_PATHS` array:

```typescript
  '/api/billing/webhook',
```

- [ ] **Step 3: Register billing routes in app**

In `src/app.ts`, add the import after the existing route imports:

```typescript
import { billing } from './routes/billing';
```

Add the route registration after the existing `app.route('/', generationJobs);` line:

```typescript
app.route('/', billing);
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/billing.ts src/middleware/auth.ts src/app.ts
git commit -m "feat(billing): add billing routes and register in app"
```

---

## Task 6: Plan Limit Enforcement in ProjectService

**Files:**
- Modify: `src/services/project.service.ts`

- [ ] **Step 1: Add plan limit check to createProject**

In `src/services/project.service.ts`, add import at the top:

```typescript
import { BillingService } from './billing.service';
```

Replace the `createProject` method with:

```typescript
  async createProject(userId: string, data: { name: string; description?: string }) {
    // Check plan limit
    const billingService = new BillingService();
    const sub = await billingService.getSubscription(userId);
    const limits = billingService.getPlanLimits(sub.planId);

    if (limits.projects !== null) {
      const currentCount = await prisma.project.count({ where: { userId } });
      if (currentCount >= limits.projects) {
        throw new AppException(
          ErrorCode.PLAN_LIMIT_EXCEEDED,
          `已达到${sub.planId === 'free' ? '免费版' : '当前计划'}项目数量上限（${limits.projects}个）`,
        );
      }
    }

    const project = await prisma.project.create({
      data: {
        ...data,
        userId,
      },
    });

    return project;
  }
```

Add `ErrorCode` to the existing import if not already there (the current file imports `AppException, ErrorCode` already).

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/services/project.service.ts
git commit -m "feat(billing): add plan limit check to project creation"
```

---

## Task 7: Manual Verification

No code changes. Verify the complete integration.

- [ ] **Step 1: Start dev server**

```bash
cd /Users/halyu/Documents/Code/story_agent
npm run dev
```

- [ ] **Step 2: Test subscription endpoint**

```bash
# Get a JWT token first (login)
TOKEN=$(curl -s http://localhost:12321/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test"}' | jq -r '.token')

# Test subscription (should return free default)
curl -s http://localhost:12321/api/billing/subscription \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ "planId": "free", "status": "active", "billingInterval": null, "currentPeriodEnd": null, "cancelAtPeriodEnd": false }`

- [ ] **Step 3: Test usage endpoint**

```bash
curl -s http://localhost:12321/api/billing/usage \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: Usage response with actual project/character counts and free limits.

- [ ] **Step 4: Test webhook (unauthenticated, should require signature)**

```bash
curl -s -X POST http://localhost:12321/api/billing/webhook \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

Expected: 400 error about missing stripe-signature header.

- [ ] **Step 5: Verify type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(billing): integration fixes from manual verification"
```
