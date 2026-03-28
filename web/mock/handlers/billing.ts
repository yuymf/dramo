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
