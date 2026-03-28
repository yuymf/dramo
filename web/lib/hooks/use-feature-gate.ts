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
