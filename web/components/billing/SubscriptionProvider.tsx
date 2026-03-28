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
import { PastDueBanner } from './PastDueBanner';
import { UpgradeDialog } from './UpgradeDialog';

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
      <PastDueBanner />
      {children}
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </SubscriptionContext.Provider>
  );
}
