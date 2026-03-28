import { http, HttpResponse } from 'msw';
import { billingHandlers } from './handlers/billing';

export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ ok: true })),
  ...billingHandlers,
];
