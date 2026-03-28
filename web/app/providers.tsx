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
