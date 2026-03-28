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
    cacheTtlMs: 30000,
  });
}
