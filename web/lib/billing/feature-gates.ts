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
