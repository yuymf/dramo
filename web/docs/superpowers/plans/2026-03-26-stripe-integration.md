# Stripe Subscription Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Stripe subscription billing into the Dramo.ai frontend, enabling Free/Pro/Enterprise plans with Stripe Checkout and Customer Portal.

**Architecture:** All Stripe API calls go through Fastify backend (:12321). Frontend proxies via existing `proxyRequest` pattern, never touches Stripe secrets. Frontend handles UI, redirects, subscription state display, and feature gating. No Stripe client SDK needed.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, NextAuth v4, Tailwind CSS v4, shadcn/ui, MSW for mocks.

**Spec:** `docs/superpowers/specs/2026-03-25-stripe-integration-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `lib/billing/types.ts` | Billing type definitions (PlanId, Subscription, Usage, etc.) — *spec deviation: separate file instead of inline in models.ts for focused files per coding-style rules; re-export preserves compat* |
| `lib/billing/feature-gates.ts` | Feature gate configuration and `checkFeatureAccess()` utility |
| `lib/api/billing.ts` | Client-side billing API functions |
| `lib/hooks/use-subscription.ts` | Global subscription state hook with auto-refresh |
| `lib/hooks/use-feature-gate.ts` | Feature gate hook composing subscription + usage |
| `app/api/billing/checkout/route.ts` | Proxy: create Stripe Checkout Session |
| `app/api/billing/portal/route.ts` | Proxy: create Stripe Customer Portal Session |
| `app/api/billing/subscription/route.ts` | Proxy: query subscription status |
| `app/api/billing/usage/route.ts` | Proxy: query usage stats |
| `components/billing/SubscriptionProvider.tsx` | Context provider for global subscription state + UpgradeDialog — *spec deviation: separate file instead of inline in providers.tsx for better separation of concerns* |
| `components/billing/UpgradeDialog.tsx` | Modal dialog prompting upgrade |
| `components/billing/UpgradePrompt.tsx` | Inline upgrade prompt (lock icon + CTA) |
| `components/billing/SubscriptionCard.tsx` | Subscription status card for settings page |
| `components/billing/PastDueBanner.tsx` | Global banner for past_due status |
| `components/billing/index.ts` | Barrel exports |
| `app/billing/success/page.tsx` | Post-checkout success page with polling |
| `app/billing/cancel/page.tsx` | Post-checkout cancellation page |
| `mock/handlers/billing.ts` | MSW mock handlers for billing endpoints |

### Modified Files

| File | Changes |
|------|---------|
| `lib/models.ts` | Re-export billing types for backward compat |
| `next-auth.d.ts` | Add `planId` to Session and JWT types |
| `lib/auth/options.ts` | Add `planId` to JWT/session callbacks, handle `trigger === 'update'` |
| `lib/api/client.ts` | Add `PLAN_LIMIT_EXCEEDED` error interception hook |
| `app/providers.tsx` | Wrap with `SubscriptionProvider` |
| `app/pricing/page.tsx` | Connect to real Stripe Checkout, show current plan, add billing interval toggle |
| `.gitignore` | Add `.superpowers/` |
| `mock/handlers.ts` | Import and spread billing handlers |

---

## Task 1: Billing Types and Feature Gate Config

**Files:**
- Create: `lib/billing/types.ts`
- Create: `lib/billing/feature-gates.ts`
- Modify: `lib/models.ts` (add re-export)

- [ ] **Step 1: Create billing types**

```typescript
// lib/billing/types.ts
export type PlanId = 'free' | 'pro' | 'enterprise';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trialing'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired';

export type BillingInterval = 'month' | 'year';

export interface Subscription {
  readonly planId: PlanId;
  readonly status: SubscriptionStatus;
  readonly billingInterval: BillingInterval | null;
  readonly currentPeriodEnd: string | null;
  readonly cancelAtPeriodEnd: boolean;
}

export interface Usage {
  readonly aiGenerations: {
    readonly used: number;
    readonly limit: number | null;
    readonly resetsAt: string | null;
  };
  readonly projects: {
    readonly used: number;
    readonly limit: number | null;
  };
  readonly characters: {
    readonly used: number;
    readonly limit: number | null;
  };
}

export interface FeatureGateResult {
  readonly allowed: boolean;
  readonly reason: 'plan_required' | 'limit_reached' | null;
  readonly currentUsage: number | null;
  readonly limit: number | null;
}
```

- [ ] **Step 2: Create feature gates config**

```typescript
// lib/billing/feature-gates.ts
import type { PlanId, FeatureGateResult, Subscription, Usage } from './types';

interface FeatureGateConfig {
  readonly requiredPlan: PlanId;
  readonly usageKey?: keyof Usage;
}

const PLAN_HIERARCHY: Record<PlanId, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
} as const;

export const FEATURE_GATES: Record<string, FeatureGateConfig> = {
  'project:create': { requiredPlan: 'free', usageKey: 'projects' },
  'script:branching': { requiredPlan: 'pro' },
  'script:storyboard': { requiredPlan: 'pro' },
  'character:create': { requiredPlan: 'free', usageKey: 'characters' },
  'ai:generate': { requiredPlan: 'free', usageKey: 'aiGenerations' },
  'export:docx': { requiredPlan: 'pro' },
  'export:pdf': { requiredPlan: 'pro' },
  'ai:chat': { requiredPlan: 'pro' },
} as const;

export function checkFeatureAccess(
  featureKey: string,
  subscription: Subscription | null,
  usage: Usage | null,
): FeatureGateResult {
  const gate = FEATURE_GATES[featureKey];
  if (!gate) {
    return { allowed: true, reason: null, currentUsage: null, limit: null };
  }

  const currentPlan = subscription?.planId ?? 'free';
  const hasRequiredPlan = PLAN_HIERARCHY[currentPlan] >= PLAN_HIERARCHY[gate.requiredPlan];

  if (!hasRequiredPlan) {
    return { allowed: false, reason: 'plan_required', currentUsage: null, limit: null };
  }

  if (gate.usageKey && usage) {
    const usageData = usage[gate.usageKey];
    if (usageData.limit !== null && usageData.used >= usageData.limit) {
      return {
        allowed: false,
        reason: 'limit_reached',
        currentUsage: usageData.used,
        limit: usageData.limit,
      };
    }
    return {
      allowed: true,
      reason: null,
      currentUsage: usageData.used,
      limit: usageData.limit,
    };
  }

  return { allowed: true, reason: null, currentUsage: null, limit: null };
}
```

- [ ] **Step 3: Add re-export to models.ts**

Append to end of `lib/models.ts`:

```typescript
// Billing types (re-export for convenience)
export type { PlanId, SubscriptionStatus, BillingInterval, Subscription, Usage } from '@/lib/billing/types';
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add lib/billing/types.ts lib/billing/feature-gates.ts lib/models.ts
git commit -m "feat(billing): add billing types and feature gate config"
```

---

## Task 2: NextAuth Session Extension

**Files:**
- Modify: `next-auth.d.ts`
- Modify: `lib/auth/options.ts`

- [ ] **Step 1: Extend Session and JWT types**

Replace the full content of `next-auth.d.ts`:

```typescript
import "next-auth";
import type { PlanId } from "@/lib/billing/types";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
    };
    backendToken?: string;
    planId?: PlanId;
  }

  interface User {
    backendToken?: string;
    planId?: PlanId;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    backendToken?: string;
    planId?: string;
  }
}
```

- [ ] **Step 2: Update auth callbacks to include planId**

In `lib/auth/options.ts`, update the `jwt` callback to handle `planId` from login and session updates:

```typescript
// In the jwt callback, update to:
async jwt({ token, user, trigger }) {
  if (user) {
    token.backendToken = (user as User & { backendToken: string }).backendToken;
    token.sub = user.id;
    token.planId = (user as User & { planId?: string }).planId ?? 'free';
  }
  // When client calls update() to refresh subscription
  if (trigger === 'update' && token.backendToken) {
    try {
      const res = await fetch(`${backendUrl}/api/billing/subscription`, {
        headers: { Authorization: `Bearer ${token.backendToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        token.planId = data.planId ?? 'free';
      }
    } catch (error) {
      console.error('[auth] Failed to refresh planId:', error);
    }
  }
  return token;
},
```

Update the `session` callback to pass `planId`:

```typescript
// In the session callback, add after backendToken logic:
session.planId = (token.planId as PlanId) ?? 'free';
```

Note: Add `import type { PlanId } from "@/lib/billing/types";` at the top of the file, and add `User` to the existing `import type { NextAuthOptions, User } from "next-auth";`.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add next-auth.d.ts lib/auth/options.ts
git commit -m "feat(billing): extend NextAuth session with planId"
```

---

## Task 3: Billing API Routes (Proxy Layer)

**Files:**
- Create: `app/api/billing/checkout/route.ts`
- Create: `app/api/billing/portal/route.ts`
- Create: `app/api/billing/subscription/route.ts`
- Create: `app/api/billing/usage/route.ts`

These routes follow the exact same pattern as existing routes (e.g., `app/api/projects/route.ts`). They proxy to backend billing endpoints. The `ensureContract` call is omitted since billing routes are not yet in the OpenAPI spec. All backend paths use the `/api/` prefix matching the existing codebase convention.

- [ ] **Step 1: Create checkout route**

```typescript
// app/api/billing/checkout/route.ts
import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

// TODO: Add ensureContract once billing routes are in OpenAPI spec
export async function POST(request: NextRequest) {
  return proxyRequest(request, "/api/billing/checkout-session", {
    requireAuth: true,
  });
}
```

- [ ] **Step 2: Create portal route**

```typescript
// app/api/billing/portal/route.ts
import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

// TODO: Add ensureContract once billing routes are in OpenAPI spec
export async function POST(request: NextRequest) {
  return proxyRequest(request, "/api/billing/portal-session", {
    requireAuth: true,
  });
}
```

- [ ] **Step 3: Create subscription route**

```typescript
// app/api/billing/subscription/route.ts
import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

// TODO: Add ensureContract once billing routes are in OpenAPI spec
export async function GET(request: NextRequest) {
  return proxyRequest(request, "/api/billing/subscription", {
    requireAuth: true,
  });
}
```

- [ ] **Step 4: Create usage route**

```typescript
// app/api/billing/usage/route.ts
import { NextRequest } from "next/server";
import { proxyRequest } from "@/app/api/_utils/proxy";

// TODO: Add ensureContract once billing routes are in OpenAPI spec
export async function GET(request: NextRequest) {
  return proxyRequest(request, "/api/billing/usage", {
    requireAuth: true,
  });
}
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add app/api/billing/
git commit -m "feat(billing): add API proxy routes for billing endpoints"
```

---

## Task 4: Client-Side Billing API Functions

**Files:**
- Create: `lib/api/billing.ts`

Follows the same pattern as `lib/api/projects.ts` — uses `api<T>()` from `./client`.

- [ ] **Step 1: Create billing API functions**

```typescript
// lib/api/billing.ts
import { api } from './client';
import type { PlanId, BillingInterval, Subscription, Usage } from '@/lib/billing/types';

export interface CheckoutSessionResponse {
  readonly url: string;
}

export interface PortalSessionResponse {
  readonly url: string;
}

export async function createCheckoutSession(
  planId: PlanId,
  interval: BillingInterval,
): Promise<CheckoutSessionResponse> {
  return api<CheckoutSessionResponse>('/api/billing/checkout', {
    method: 'POST',
    body: { planId, interval },
  });
}

export async function createPortalSession(): Promise<PortalSessionResponse> {
  return api<PortalSessionResponse>('/api/billing/portal', {
    method: 'POST',
  });
}

export async function getSubscription(): Promise<Subscription> {
  return api<Subscription>('/api/billing/subscription', {
    noCache: true,
  });
}

export async function getUsage(): Promise<Usage> {
  return api<Usage>('/api/billing/usage', {
    cacheTtlMs: 30000, // Cache for 30s — usage doesn't change rapidly
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add lib/api/billing.ts
git commit -m "feat(billing): add client-side billing API functions"
```

---

## Task 5: MSW Mock Handlers

**Files:**
- Create: `mock/handlers/billing.ts`
- Modify: `mock/handlers.ts`

Mocks enable frontend development before backend billing endpoints are ready.

- [ ] **Step 1: Create billing mock handlers**

```typescript
// mock/handlers/billing.ts
import { http, HttpResponse } from 'msw';

// Use inline types instead of @/ imports — MSW handlers may run outside bundler context
interface MockSubscription {
  planId: string;
  status: string;
  billingInterval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface MockUsage {
  aiGenerations: { used: number; limit: number | null; resetsAt: string | null };
  projects: { used: number; limit: number | null };
  characters: { used: number; limit: number | null };
}

const mockSubscription: MockSubscription = {
  planId: 'free',
  status: 'active',
  billingInterval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

const mockUsage: MockUsage = {
  aiGenerations: { used: 3, limit: 10, resetsAt: new Date(Date.now() + 86400000).toISOString() },
  projects: { used: 1, limit: 1 },
  characters: { used: 2, limit: 5 },
};

export const billingHandlers = [
  http.get('/api/billing/subscription', () => {
    return HttpResponse.json(mockSubscription);
  }),

  http.get('/api/billing/usage', () => {
    return HttpResponse.json(mockUsage);
  }),

  http.post('/api/billing/checkout', () => {
    return HttpResponse.json({
      url: 'https://checkout.stripe.com/c/pay/test_session_id',
    });
  }),

  http.post('/api/billing/portal', () => {
    return HttpResponse.json({
      url: 'https://billing.stripe.com/p/session/test_portal_id',
    });
  }),
];
```

- [ ] **Step 2: Register billing handlers in main handlers file**

Replace `mock/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';
import { billingHandlers } from './handlers/billing';

export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ ok: true })),
  ...billingHandlers,
];
```

- [ ] **Step 3: Commit**

```bash
git add mock/handlers/billing.ts mock/handlers.ts
git commit -m "feat(billing): add MSW mock handlers for billing endpoints"
```

---

## Task 6: SubscriptionProvider and useSubscription Hook

**Files:**
- Create: `components/billing/SubscriptionProvider.tsx`
- Create: `lib/hooks/use-subscription.ts`
- Modify: `app/providers.tsx`

Follows the same Context + Provider pattern as `useGenerationJobs.tsx`.

- [ ] **Step 1: Create useSubscription hook**

```typescript
// lib/hooks/use-subscription.ts
"use client";

import { useContext } from 'react';
import { SubscriptionContext } from '@/components/billing/SubscriptionProvider';

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}
```

- [ ] **Step 2: Create SubscriptionProvider**

```typescript
// components/billing/SubscriptionProvider.tsx
"use client";

import React, {
  createContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import type { Subscription } from '@/lib/billing/types';
import { getSubscription } from '@/lib/api/billing';

interface SubscriptionContextValue {
  readonly subscription: Subscription | null;
  readonly isLoading: boolean;
  readonly isPro: boolean;
  readonly isFree: boolean;
  readonly refresh: () => Promise<void>;
  readonly showUpgradeDialog: () => void;
}

export const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// Global callback ref for triggering upgrade dialog from api client
let upgradeDialogCallback: (() => void) | null = null;

export function getUpgradeDialogCallback(): (() => void) | null {
  return upgradeDialogCallback;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { data: session, status: authStatus, update: updateSession } = useSession();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);

  // Upgrade dialog state — wired to UI in Task 8
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const showUpgradeDialog = useCallback(() => {
    setUpgradeOpen(true);
  }, []);

  // Register global callback for api client interception
  useEffect(() => {
    upgradeDialogCallback = showUpgradeDialog;
    return () => {
      upgradeDialogCallback = null;
    };
  }, [showUpgradeDialog]);

  const refresh = useCallback(async () => {
    if (authStatus !== 'authenticated') return;

    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return; // debounce 2s
    lastFetchRef.current = now;

    try {
      const data = await getSubscription();
      setSubscription(data);

      // Sync planId to session if out of date
      if (data.planId !== session?.planId) {
        await updateSession();
      }
    } catch (error) {
      console.error('[SubscriptionProvider] Failed to fetch subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authStatus, session?.planId, updateSession]);

  // Initial fetch on auth ready
  useEffect(() => {
    if (authStatus === 'authenticated') {
      refresh();
    } else if (authStatus === 'unauthenticated') {
      setSubscription(null);
      setIsLoading(false);
    }
  }, [authStatus, refresh]);

  // Refresh on window focus (multi-tab sync)
  useEffect(() => {
    const handleFocus = () => {
      if (authStatus === 'authenticated') {
        refresh();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [authStatus, refresh]);

  const isPro = subscription?.planId === 'pro' || subscription?.planId === 'enterprise';
  const isFree = !subscription || subscription.planId === 'free';

  const value = useMemo<SubscriptionContextValue>(
    () => ({ subscription, isLoading, isPro, isFree, refresh, showUpgradeDialog }),
    [subscription, isLoading, isPro, isFree, refresh, showUpgradeDialog],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      {/* UpgradeDialog rendered here globally — implemented in Task 8 */}
    </SubscriptionContext.Provider>
  );
}
```

- [ ] **Step 3: Wire SubscriptionProvider into app providers**

Replace `app/providers.tsx`:

```typescript
"use client";

import { SessionProvider } from "next-auth/react";
import { SubscriptionProvider } from "@/components/billing/SubscriptionProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SubscriptionProvider>{children}</SubscriptionProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/use-subscription.ts components/billing/SubscriptionProvider.tsx app/providers.tsx
git commit -m "feat(billing): add SubscriptionProvider and useSubscription hook"
```

---

## Task 7: PLAN_LIMIT_EXCEEDED Error Interception

**Files:**
- Modify: `lib/api/client.ts`

Add a hook into the existing error handling in `api<T>()` to detect `PLAN_LIMIT_EXCEEDED` errors and trigger the global UpgradeDialog.

- [ ] **Step 1: Add interception to api client**

In `lib/api/client.ts`, after the line `if (errorCode) apiError.code = errorCode;` (around line 156), add:

```typescript
      // Trigger upgrade dialog for plan limit errors
      if (errorCode === 'PLAN_LIMIT_EXCEEDED') {
        try {
          const { getUpgradeDialogCallback } = await import('@/components/billing/SubscriptionProvider');
          const showUpgrade = getUpgradeDialogCallback();
          if (showUpgrade) showUpgrade();
        } catch {
          // SubscriptionProvider not mounted — ignore
        }
      }
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add lib/api/client.ts
git commit -m "feat(billing): add PLAN_LIMIT_EXCEEDED global error interception"
```

---

## Task 8: Billing UI Components

**Files:**
- Create: `components/billing/UpgradeDialog.tsx`
- Create: `components/billing/UpgradePrompt.tsx`
- Create: `components/billing/SubscriptionCard.tsx`
- Create: `components/billing/PastDueBanner.tsx`
- Create: `components/billing/index.ts`

All components follow the project's Muji-inspired design tokens (see `app/pricing/page.tsx` for reference — `var(--muji-charcoal)`, `var(--muji-cream)`, etc.). They use shadcn `Button` from `components/ui/button`.

- [ ] **Step 1: Create UpgradeDialog**

```typescript
// components/billing/UpgradeDialog.tsx
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface UpgradeDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function UpgradeDialog({ open, onClose }: UpgradeDialogProps) {
  const router = useRouter();

  if (!open) return null;

  const handleUpgrade = () => {
    onClose();
    router.push('/pricing');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      {/* Dialog */}
      <div
        className="relative paper-card rounded-lg p-8 max-w-md w-full mx-4 space-y-4"
        role="dialog"
        aria-modal
        aria-labelledby="upgrade-dialog-title"
      >
        <h2
          id="upgrade-dialog-title"
          className="text-xl font-semibold"
          style={{ color: 'var(--muji-charcoal)' }}
        >
          升级以解锁完整功能
        </h2>
        <p className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
          Pro 计划包含无限 AI 生成、分支剧本编辑、故事板模式、DOCX/PDF 导出等全部功能。
        </p>
        <div className="flex gap-3 pt-2">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            稍后再说
          </Button>
          <Button
            onClick={handleUpgrade}
            className="flex-1 font-medium"
            style={{
              background: 'var(--muji-charcoal)',
              color: 'var(--muji-cream)',
            }}
          >
            查看计划
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create UpgradePrompt**

```typescript
// components/billing/UpgradePrompt.tsx
"use client";

import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/lib/hooks/use-subscription';

interface UpgradePromptProps {
  readonly feature?: string;
}

export function UpgradePrompt({ feature }: UpgradePromptProps) {
  const { showUpgradeDialog } = useSubscription();

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3"
      style={{
        background: 'var(--muji-oatmeal)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <Lock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muji-dark-gray)' }} />
      <span className="text-sm flex-1" style={{ color: 'var(--muji-dark-gray)' }}>
        {feature ? `${feature}需要 Pro 计划` : '此功能需要 Pro 计划'}
      </span>
      <Button
        onClick={showUpgradeDialog}
        size="sm"
        className="font-medium"
        style={{
          background: 'var(--muji-charcoal)',
          color: 'var(--muji-cream)',
        }}
      >
        升级 Pro
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create SubscriptionCard**

```typescript
// components/billing/SubscriptionCard.tsx
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { createPortalSession } from '@/lib/api/billing';

const PLAN_LABELS: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  enterprise: '企业版',
};

const STATUS_LABELS: Record<string, { text: string; color: string; bg: string }> = {
  active: { text: '活跃', color: '#2d7a2d', bg: '#e8f4e8' },
  past_due: { text: '逾期', color: '#c0392b', bg: '#fde8e8' },
  canceled: { text: '已取消', color: '#7f8c8d', bg: '#f0f0f0' },
  trialing: { text: '试用中', color: '#2980b9', bg: '#e8f0f8' },
};

export function SubscriptionCard() {
  const { subscription, isLoading } = useSubscription();
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg p-6" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 rounded w-1/3" style={{ background: 'var(--muji-oatmeal)' }} />
          <div className="h-4 rounded w-1/2" style={{ background: 'var(--muji-oatmeal)' }} />
        </div>
      </div>
    );
  }

  const plan = subscription?.planId ?? 'free';
  const status = subscription?.status ?? 'active';
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.active;

  const handleManage = async () => {
    setIsRedirecting(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (error) {
      console.error('[SubscriptionCard] Failed to create portal session:', error);
      setIsRedirecting(false);
    }
  };

  return (
    <div className="rounded-lg p-6" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: 'var(--muji-charcoal)' }}>
            {PLAN_LABELS[plan] ?? plan}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ color: statusInfo.color, background: statusInfo.bg }}
          >
            {statusInfo.text}
          </span>
        </div>
        {subscription?.billingInterval && (
          <span className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
            {subscription.billingInterval === 'month' ? '¥99/月' : '¥999/年'}
          </span>
        )}
      </div>

      {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
        <p className="text-sm mb-3" style={{ color: '#c0392b' }}>
          Pro 计划将于 {new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')} 到期
        </p>
      )}

      {subscription?.currentPeriodEnd && !subscription.cancelAtPeriodEnd && (
        <p className="text-sm mb-3" style={{ color: 'var(--muji-dark-gray)' }}>
          下次续费: {new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')}
        </p>
      )}

      {plan !== 'free' && (
        <Button
          onClick={handleManage}
          disabled={isRedirecting}
          variant="outline"
          className="w-full"
        >
          {isRedirecting ? '跳转中...' : '管理订阅'}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create PastDueBanner**

```typescript
// components/billing/PastDueBanner.tsx
"use client";

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { createPortalSession } from '@/lib/api/billing';

export function PastDueBanner() {
  const { subscription } = useSubscription();
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (subscription?.status !== 'past_due') return null;

  const handleUpdatePayment = async () => {
    setIsRedirecting(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (error) {
      console.error('[PastDueBanner] Failed to create portal session:', error);
      setIsRedirecting(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2 text-sm"
      style={{ background: '#fde8e8', color: '#c0392b' }}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>支付失败，请更新支付方式以继续使用 Pro 功能</span>
      <Button
        onClick={handleUpdatePayment}
        disabled={isRedirecting}
        size="sm"
        variant="outline"
        className="ml-2"
        style={{ borderColor: '#c0392b', color: '#c0392b' }}
      >
        {isRedirecting ? '跳转中...' : '更新支付方式'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Create barrel export**

```typescript
// components/billing/index.ts
export { SubscriptionProvider } from './SubscriptionProvider';
export { UpgradeDialog } from './UpgradeDialog';
export { UpgradePrompt } from './UpgradePrompt';
export { SubscriptionCard } from './SubscriptionCard';
export { PastDueBanner } from './PastDueBanner';
```

- [ ] **Step 6: Wire UpgradeDialog and PastDueBanner into SubscriptionProvider**

Update `components/billing/SubscriptionProvider.tsx` — the `upgradeOpen` state and `showUpgradeDialog` callback already exist from Task 6. Now add the imports and render the dialog + banner.

Add imports at top:

```typescript
import { PastDueBanner } from './PastDueBanner';
import { UpgradeDialog } from './UpgradeDialog';
```

Update the provider's JSX return (replace the existing return block):

```tsx
return (
  <SubscriptionContext.Provider value={value}>
    <PastDueBanner />
    {children}
    <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
  </SubscriptionContext.Provider>
);
```

Note: `PastDueBanner` renders **before** `{children}` so it appears at the top of the page as the spec requires.

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add components/billing/
git commit -m "feat(billing): add billing UI components"
```

---

## Task 9: useFeatureGate Hook

**Files:**
- Create: `lib/hooks/use-feature-gate.ts`

- [ ] **Step 1: Create feature gate hook**

```typescript
// lib/hooks/use-feature-gate.ts
"use client";

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSubscription } from './use-subscription';
import { checkFeatureAccess, FEATURE_GATES } from '@/lib/billing/feature-gates';
import { getUsage } from '@/lib/api/billing';
import type { Usage, FeatureGateResult } from '@/lib/billing/types';

export function useFeatureGate(featureKey: string) {
  const { subscription, showUpgradeDialog, isLoading: subLoading } = useSubscription();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Only fetch usage if the feature's gate config has a usageKey
  const gateConfig = FEATURE_GATES[featureKey];
  const needsUsage = Boolean(gateConfig?.usageKey);

  useEffect(() => {
    if (!subscription || !needsUsage) return;

    let cancelled = false;
    setUsageLoading(true);
    getUsage()
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch((error) => {
        console.error('[useFeatureGate] Failed to fetch usage:', error);
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => { cancelled = true; };
  }, [subscription, needsUsage]);

  const result = useMemo<FeatureGateResult>(
    () => checkFeatureAccess(featureKey, subscription, usage),
    [featureKey, subscription, usage],
  );

  const showUpgrade = useCallback(() => {
    showUpgradeDialog();
  }, [showUpgradeDialog]);

  return {
    ...result,
    isLoading: subLoading || usageLoading,
    showUpgrade,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/use-feature-gate.ts
git commit -m "feat(billing): add useFeatureGate hook"
```

---

## Task 10: Payment Callback Pages

**Files:**
- Create: `app/billing/success/page.tsx`
- Create: `app/billing/cancel/page.tsx`

- [ ] **Step 1: Create success page**

```typescript
// app/billing/success/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { getSubscription } from '@/lib/api/billing';

const MAX_POLLS = 15;
const POLL_INTERVAL_MS = 2000;

export default function BillingSuccessPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [status, setStatus] = useState<'polling' | 'success' | 'timeout'>('polling');
  const pollCountRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const poll = useCallback(async () => {
    try {
      const sub = await getSubscription();
      if (sub.planId !== 'free' && sub.status === 'active') {
        setStatus('success');
        await updateSession(); // refresh JWT with new planId
        return;
      }
    } catch (error) {
      console.error('[BillingSuccess] Poll error:', error);
    }

    pollCountRef.current += 1;
    if (pollCountRef.current >= MAX_POLLS) {
      setStatus('timeout');
      return;
    }

    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [updateSession]);

  useEffect(() => {
    poll();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poll]);

  const handleRetry = () => {
    pollCountRef.current = 0;
    setStatus('polling');
    poll();
  };

  return (
    <div className="min-h-screen muji-paper-bg muji-paper-texture flex items-center justify-center px-4">
      <div className="paper-card rounded-lg p-8 max-w-md w-full text-center space-y-4">
        {status === 'polling' && (
          <>
            <div className="text-5xl">⏳</div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--muji-charcoal)' }}>
              正在确认支付...
            </h1>
            <p className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
              请稍候，正在验证你的订阅状态
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-5xl">🎉</div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--muji-charcoal)' }}>
              订阅成功！
            </h1>
            <p className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
              感谢升级 Pro 计划，所有功能现已可用
            </p>
            <Button
              onClick={() => router.push('/projects')}
              className="w-full font-medium"
              style={{ background: 'var(--muji-charcoal)', color: 'var(--muji-cream)' }}
            >
              返回项目 →
            </Button>
          </>
        )}
        {status === 'timeout' && (
          <>
            <div className="text-5xl">⏱️</div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--muji-charcoal)' }}>
              正在处理中
            </h1>
            <p className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
              支付已提交，订阅激活可能需要几分钟。你可以稍后再检查。
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleRetry}
                variant="outline"
                className="flex-1"
              >
                再次检查
              </Button>
              <Button
                onClick={() => router.push('/projects')}
                className="flex-1 font-medium"
                style={{ background: 'var(--muji-charcoal)', color: 'var(--muji-cream)' }}
              >
                返回项目
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create cancel page**

```typescript
// app/billing/cancel/page.tsx
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function BillingCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen muji-paper-bg muji-paper-texture flex items-center justify-center px-4">
      <div className="paper-card rounded-lg p-8 max-w-md w-full text-center space-y-4">
        <div className="text-5xl">😿</div>
        <h1
          className="text-xl font-semibold"
          style={{ color: 'var(--muji-charcoal)' }}
        >
          支付已取消
        </h1>
        <p className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
          没关系，你可以随时升级
        </p>
        <div className="flex gap-3">
          <Button
            onClick={() => router.push('/projects')}
            variant="outline"
            className="flex-1"
          >
            返回项目
          </Button>
          <Button
            onClick={() => router.push('/pricing')}
            className="flex-1 font-medium"
            style={{ background: 'var(--muji-charcoal)', color: 'var(--muji-cream)' }}
          >
            重新选择
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add app/billing/
git commit -m "feat(billing): add payment success and cancel pages"
```

---

## Task 11: Pricing Page Overhaul

**Files:**
- Modify: `app/pricing/page.tsx`

Connects the existing pricing page to real Stripe Checkout. Reference the current file (172 lines) for design tokens and structure.

- [ ] **Step 1: Rewrite pricing page with billing integration**

Key changes from existing:
- Add month/year billing interval toggle
- Show current plan for authenticated users
- CTA buttons call `createCheckoutSession` and redirect
- Loading/disabled states on buttons
- Unauthenticated users redirect to login with `?redirect=/pricing&plan=pro&interval=month`

Full replacement of `app/pricing/page.tsx`:

```typescript
"use client";

import { useState } from 'react';
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { useSubscription } from '@/lib/hooks/use-subscription';
import { createCheckoutSession, createPortalSession } from '@/lib/api/billing';
import type { BillingInterval, PlanId } from '@/lib/billing/types';

interface PlanConfig {
  readonly id: PlanId;
  readonly name: string;
  readonly monthlyPrice: string;
  readonly yearlyPrice: string;
  readonly yearlySavings: string;
  readonly features: readonly string[];
  readonly highlighted: boolean;
}

const PLANS: readonly PlanConfig[] = [
  {
    id: 'free',
    name: '免费版',
    monthlyPrice: '¥0',
    yearlyPrice: '¥0',
    yearlySavings: '',
    features: ['1 个项目', '基础 AI 功能（每日限量）', '线性剧本编辑', '5 个角色', '导出 TXT'],
    highlighted: false,
  },
  {
    id: 'pro',
    name: '专业版',
    monthlyPrice: '¥99',
    yearlyPrice: '¥999',
    yearlySavings: '省 17%',
    features: [
      '无限项目',
      '无限 AI 生成',
      '分支 + 故事板模式',
      '无限角色 + 关系图谱',
      '导出 DOCX / PDF',
      'AI 聊天助手',
      '优先支持',
    ],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: '企业版',
    monthlyPrice: '联系我们',
    yearlyPrice: '联系我们',
    yearlySavings: '',
    features: ['专业版所有功能', '无限团队成员', '专属客户经理', '定制化功能', 'SLA 保障'],
    highlighted: false,
  },
] as const;

export default function PricingPage() {
  const router = useRouter();
  const { status } = useSession();
  const { subscription, isPro } = useSubscription();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

  const handleSelectPlan = async (plan: PlanConfig) => {
    if (plan.id === 'enterprise') {
      window.location.href = 'mailto:sales@dramo.ai';
      return;
    }

    if (plan.id === 'free') {
      router.push('/projects');
      return;
    }

    // Unauthenticated → login first
    if (status !== 'authenticated') {
      const params = new URLSearchParams({
        redirect: '/pricing',
        plan: plan.id,
        interval: billingInterval,
      });
      router.push(`/login?${params.toString()}`);
      return;
    }

    // Already on this plan → manage
    if (subscription?.planId === plan.id) {
      setLoadingPlan(plan.id);
      try {
        const { url } = await createPortalSession();
        window.location.href = url;
      } catch (error) {
        console.error('[Pricing] Portal session error:', error);
      } finally {
        setLoadingPlan(null);
      }
      return;
    }

    // Upgrade → Stripe Checkout
    setLoadingPlan(plan.id);
    try {
      const { url } = await createCheckoutSession(plan.id, billingInterval);
      window.location.href = url;
    } catch (error) {
      console.error('[Pricing] Checkout session error:', error);
    } finally {
      setLoadingPlan(null);
    }
  };

  const getCtaText = (plan: PlanConfig): string => {
    if (plan.id === 'enterprise') return '联系销售';
    if (status !== 'authenticated') return plan.id === 'free' ? '开始使用' : '立即订阅';
    if (subscription?.planId === plan.id) return '✓ 当前计划';
    if (plan.id === 'free') return '当前计划';
    if (isPro) return '管理订阅';
    return '升级 Pro';
  };

  const isCurrentPlan = (plan: PlanConfig): boolean =>
    status === 'authenticated' && subscription?.planId === plan.id;

  return (
    <div className="min-h-screen muji-paper-bg muji-paper-texture">
      <SiteHeader />

      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 space-y-4">
            <h1
              className="text-4xl lg:text-5xl font-semibold"
              style={{ color: "var(--muji-charcoal)" }}
            >
              订阅计划与价格
            </h1>
            <p
              className="text-lg max-w-2xl mx-auto"
              style={{ color: "var(--muji-dark-gray)" }}
            >
              从个人创作者到专业团队，总有适合你的选择
            </p>
          </div>

          {/* Billing interval toggle */}
          <div className="flex justify-center mb-12">
            <div
              className="inline-flex rounded-full p-1"
              style={{ background: 'var(--muji-oatmeal)' }}
            >
              <button
                onClick={() => setBillingInterval('month')}
                className="px-6 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: billingInterval === 'month' ? 'var(--muji-charcoal)' : 'transparent',
                  color: billingInterval === 'month' ? 'var(--muji-cream)' : 'var(--muji-dark-gray)',
                }}
              >
                月付
              </button>
              <button
                onClick={() => setBillingInterval('year')}
                className="px-6 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: billingInterval === 'year' ? 'var(--muji-charcoal)' : 'transparent',
                  color: billingInterval === 'year' ? 'var(--muji-cream)' : 'var(--muji-dark-gray)',
                }}
              >
                年付
                <span className="ml-1 text-xs opacity-75">省 17%</span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`paper-card rounded-lg p-8 transition-all ${
                  plan.highlighted ? "scale-105" : ""
                }`}
              >
                {plan.highlighted && (
                  <div
                    className="text-xs font-semibold mb-4 px-3 py-1 inline-block rounded-full"
                    style={{
                      background: "var(--muji-charcoal)",
                      color: "var(--muji-cream)",
                    }}
                  >
                    最受欢迎
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h3
                      className="text-2xl font-semibold mb-2"
                      style={{ color: "var(--muji-charcoal)" }}
                    >
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-4xl font-semibold"
                        style={{ color: "var(--muji-charcoal)" }}
                      >
                        {billingInterval === 'month' ? plan.monthlyPrice : plan.yearlyPrice}
                      </span>
                      {plan.id !== 'enterprise' && (
                        <span
                          className="text-lg"
                          style={{ color: "var(--muji-dark-gray)" }}
                        >
                          {billingInterval === 'month' ? '/月' : '/年'}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2"
                        style={{ color: "var(--muji-dark-gray)" }}
                      >
                        <Check className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isCurrentPlan(plan) || loadingPlan !== null}
                    className="w-full font-medium"
                    style={{
                      background: isCurrentPlan(plan)
                        ? 'var(--muji-oatmeal)'
                        : plan.highlighted
                          ? "var(--muji-charcoal)"
                          : "var(--muji-oatmeal)",
                      color: isCurrentPlan(plan)
                        ? 'var(--muji-dark-gray)'
                        : plan.highlighted
                          ? "var(--muji-cream)"
                          : "var(--muji-charcoal)",
                      border: "none",
                    }}
                    size="lg"
                  >
                    {loadingPlan === plan.id ? '跳转中...' : getCtaText(plan)}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative py-12 px-4 sm:px-6 lg:px-8 border-t"
        style={{ borderColor: "rgba(0, 0, 0, 0.06)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center" style={{ color: "var(--muji-dark-gray)" }}>
            <p className="text-sm">© 2026 DRAMO. 保留所有权利。</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Verify dev server renders**

Run: `npm run dev`
Open: `http://localhost:12323/pricing`
Expected: Pricing page renders with month/year toggle, correct plan cards

- [ ] **Step 4: Commit**

```bash
git add app/pricing/page.tsx
git commit -m "feat(billing): overhaul pricing page with Stripe Checkout integration"
```

---

## Task 12: Gitignore and Cleanup

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add .superpowers/ to .gitignore**

Append to `.gitignore`:

```
# Superpowers brainstorm sessions
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers/ to gitignore"
```

---

## Task 13: Manual Integration Verification

This is a manual verification task — no code changes, just checking that everything works together.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify pricing page**

Open: `http://localhost:12323/pricing`
Expected:
- Month/year toggle works
- Plan cards show correct features
- For unauthenticated users, CTA redirects to `/login?redirect=...`

- [ ] **Step 3: Verify billing pages**

Open: `http://localhost:12323/billing/success`
Expected: Polling state shown, then timeout message after 30s

Open: `http://localhost:12323/billing/cancel`
Expected: Cancel message with "返回项目" and "重新选择" buttons

- [ ] **Step 4: Verify type safety**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 5: Verify lint**

Run: `npm run lint`
Expected: No errors (warnings OK)

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(billing): integration fixes from manual verification"
```
