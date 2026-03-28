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
