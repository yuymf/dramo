// src/routes/billing.ts
import { Hono } from 'hono';
import { BillingService } from '../services/billing.service';
import { stripe } from '../lib/stripe';
import { config } from '../config';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';

const billing = new Hono<AuthEnv>();
const billingService = new BillingService();

// GET /api/billing/subscription — current user's subscription
billing.get('/billing/subscription', async (c) => {
  const userId = c.get('user').userId;
  const result = await billingService.getSubscription(userId);
  return c.json(result);
});

// GET /api/billing/usage — current user's usage stats
billing.get('/billing/usage', async (c) => {
  const userId = c.get('user').userId;
  const result = await billingService.getUsage(userId);
  return c.json(result);
});

// POST /api/billing/checkout-session — create Stripe Checkout
billing.post('/billing/checkout-session', async (c) => {
  const userId = c.get('user').userId;
  const email = c.get('user').email;
  const { planId, interval } = await c.req.json();

  const result = await billingService.createCheckoutSession(userId, email, planId, interval);
  return c.json(result);
});

// POST /api/billing/portal-session — create Stripe Customer Portal
billing.post('/billing/portal-session', async (c) => {
  const userId = c.get('user').userId;
  const result = await billingService.createPortalSession(userId);
  return c.json(result);
});

// POST /api/billing/webhook — Stripe webhook (public, no auth)
billing.post('/billing/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  const requestId = c.get('requestId');

  if (!signature) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'Missing stripe-signature header', retryable: false }, requestId },
      400,
    );
  }

  // Read raw body for signature verification
  const rawBody = await c.req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
  } catch (err) {
    logger.warn({ err }, '[billing/webhook] Signature verification failed');
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'Invalid webhook signature', retryable: false }, requestId },
      400,
    );
  }

  try {
    await billingService.handleWebhookEvent(event);
  } catch (err) {
    logger.error({ err, eventType: event.type }, '[billing/webhook] Event processing failed');
    // Still return 200 to prevent Stripe retries for processing errors
  }

  return c.json({ received: true });
});

export { billing };
