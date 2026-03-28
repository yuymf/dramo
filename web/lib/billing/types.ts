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
