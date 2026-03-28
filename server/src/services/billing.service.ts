// src/services/billing.service.ts
import Stripe from 'stripe';
import { prisma } from '../lib/db';
import { stripe } from '../lib/stripe';
import { config } from '../config';
import { AppException, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';

interface SubscriptionResponse {
  readonly planId: string;
  readonly status: string;
  readonly billingInterval: string | null;
  readonly currentPeriodEnd: string | null;
  readonly cancelAtPeriodEnd: boolean;
}

interface UsageResponse {
  readonly aiGenerations: { readonly used: number; readonly limit: number | null; readonly resetsAt: string | null };
  readonly projects: { readonly used: number; readonly limit: number | null };
  readonly characters: { readonly used: number; readonly limit: number | null };
}

const DEFAULT_SUBSCRIPTION: SubscriptionResponse = {
  planId: 'free',
  status: 'active',
  billingInterval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

const PLAN_LIMITS: Record<string, { projects: number | null; characters: number | null; aiGenerations: number | null }> = {
  free: { projects: 1, characters: 5, aiGenerations: 10 },
  pro: { projects: null, characters: null, aiGenerations: null },
  enterprise: { projects: null, characters: null, aiGenerations: null },
};

export class BillingService {
  // ─── Queries ───────────────────────────────────────────────

  async getSubscription(userId: string): Promise<SubscriptionResponse> {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return DEFAULT_SUBSCRIPTION;

    return {
      planId: sub.planId,
      status: sub.status,
      billingInterval: sub.billingInterval,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  }

  async getUsage(userId: string): Promise<UsageResponse> {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const planId = sub?.planId ?? 'free';
    const limits = PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;

    // Count projects
    const projectCount = await prisma.project.count({ where: { userId } });

    // Count characters (two-step: projects → characterAssets)
    const projectIds = await prisma.project.findMany({
      where: { userId },
      select: { id: true },
    });
    const characterCount = projectIds.length > 0
      ? await prisma.characterAsset.count({
          where: { projectId: { in: projectIds.map((p) => p.id) } },
        })
      : 0;

    // AI generations: TODO — hardcode 0 until UsageRecord table exists
    const aiUsed = 0;

    // Compute reset time (next midnight UTC)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    return {
      aiGenerations: {
        used: aiUsed,
        limit: limits.aiGenerations,
        resetsAt: limits.aiGenerations !== null ? tomorrow.toISOString() : null,
      },
      projects: { used: projectCount, limit: limits.projects },
      characters: { used: characterCount, limit: limits.characters },
    };
  }

  // ─── Checkout & Portal ─────────────────────────────────────

  async createCheckoutSession(
    userId: string,
    email: string,
    planId: string,
    interval: string,
  ): Promise<{ url: string }> {
    // Validate input
    if (planId !== 'pro') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Only pro plan is available for checkout');
    }
    if (interval !== 'month' && interval !== 'year') {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Interval must be "month" or "year"');
    }

    // Check existing subscription
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing && existing.planId !== 'free' && existing.status === 'active' && !existing.cancelAtPeriodEnd) {
      throw new AppException(ErrorCode.ALREADY_SUBSCRIBED, '你已经是 Pro 用户');
    }

    // Get or create Stripe customer
    const stripeCustomerId = await this.getOrCreateCustomer(userId, email);

    // Select price ID
    const priceId = interval === 'month'
      ? config.stripePriceProMonthly
      : config.stripePriceProYearly;

    if (!priceId) {
      throw new AppException(ErrorCode.INTERNAL_ERROR, 'Stripe price not configured');
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${config.frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/billing/cancel`,
        metadata: { userId, planId },
      });

      if (!session.url) {
        throw new AppException(ErrorCode.UPSTREAM_ERROR, 'Stripe did not return a checkout URL');
      }

      return { url: session.url };
    } catch (error) {
      if (error instanceof AppException) throw error;
      logger.error({ err: error }, '[BillingService] Stripe checkout session creation failed');
      throw new AppException(ErrorCode.UPSTREAM_ERROR, '支付服务暂不可用，请稍后重试', { retryable: true });
    }
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeCustomerId) {
      throw new AppException(ErrorCode.NO_STRIPE_CUSTOMER, '未找到支付信息，请先订阅');
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${config.frontendUrl}/pricing`,
      });

      return { url: session.url };
    } catch (error) {
      logger.error({ err: error }, '[BillingService] Stripe portal session creation failed');
      throw new AppException(ErrorCode.UPSTREAM_ERROR, '支付服务暂不可用，请稍后重试', { retryable: true });
    }
  }

  // ─── Webhook ───────────────────────────────────────────────

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        logger.info({ eventType: event.type }, '[BillingService] Unhandled webhook event type');
    }
  }

  // ─── Private: Webhook Handlers ─────────────────────────────

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      logger.warn({ sessionId: session.id }, '[BillingService] checkout.session.completed missing userId in metadata');
      return;
    }

    const stripeSubscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    if (!stripeSubscriptionId) {
      logger.warn({ sessionId: session.id }, '[BillingService] checkout.session.completed missing subscription');
      return;
    }

    // Fetch full subscription from Stripe
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    await this.syncSubscriptionFromStripe(stripeSub, userId);
  }

  private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription): Promise<void> {
    const customerId = typeof stripeSub.customer === 'string'
      ? stripeSub.customer
      : stripeSub.customer.id;

    const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
    if (!sub) {
      logger.warn({ customerId }, '[BillingService] subscription.updated for unknown customer');
      return;
    }

    await this.syncSubscriptionFromStripe(stripeSub, sub.userId);
  }

  private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
    const customerId = typeof stripeSub.customer === 'string'
      ? stripeSub.customer
      : stripeSub.customer.id;

    const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
    if (!sub) {
      logger.warn({ customerId }, '[BillingService] subscription.deleted for unknown customer');
      return;
    }

    await prisma.subscription.update({
      where: { userId: sub.userId },
      data: {
        planId: 'free',
        status: 'canceled',
        stripeSubscriptionId: null,
        billingInterval: null,
        cancelAtPeriodEnd: false,
      },
    });

    logger.info({ userId: sub.userId }, '[BillingService] Subscription deleted, reverted to free');
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

    if (!customerId) return;

    const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
    if (!sub) {
      logger.warn({ customerId }, '[BillingService] invoice.payment_failed for unknown customer');
      return;
    }

    await prisma.subscription.update({
      where: { userId: sub.userId },
      data: { status: 'past_due' },
    });

    logger.warn({ userId: sub.userId }, '[BillingService] Payment failed, marked as past_due');
  }

  // ─── Private: Helpers ──────────────────────────────────────

  private async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    // Check existing
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    // Create in Stripe
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });

    // Upsert subscription record with free plan
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customer.id,
        planId: 'free',
        status: 'active',
      },
      update: {
        stripeCustomerId: customer.id,
      },
    });

    return customer.id;
  }

  private async syncSubscriptionFromStripe(
    stripeSub: Stripe.Subscription,
    userId: string,
  ): Promise<void> {
    const customerId = typeof stripeSub.customer === 'string'
      ? stripeSub.customer
      : stripeSub.customer.id;

    const firstItem = stripeSub.items.data[0];
    const priceId = firstItem?.price?.id;
    const planId = this.getPlanIdFromPriceId(priceId);
    const interval = firstItem?.price?.recurring?.interval ?? null;

    // In Stripe SDK v20+, current_period_start/end moved from Subscription to SubscriptionItem
    const periodStart = firstItem?.current_period_start ?? null;
    const periodEnd = firstItem?.current_period_end ?? null;

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSub.id,
        planId,
        status: stripeSub.status,
        billingInterval: interval,
        currentPeriodStart: periodStart != null ? new Date(periodStart * 1000) : null,
        currentPeriodEnd: periodEnd != null ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: stripeSub.id,
        planId,
        status: stripeSub.status,
        billingInterval: interval,
        currentPeriodStart: periodStart != null ? new Date(periodStart * 1000) : null,
        currentPeriodEnd: periodEnd != null ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });

    logger.info({ userId, planId, status: stripeSub.status }, '[BillingService] Subscription synced');
  }

  private getPlanIdFromPriceId(priceId: string | undefined): string {
    if (!priceId) return 'free';
    if (priceId === config.stripePriceProMonthly || priceId === config.stripePriceProYearly) {
      return 'pro';
    }
    logger.warn({ priceId }, '[BillingService] Unknown price ID, defaulting to free');
    return 'free';
  }

  getPlanLimits(planId: string): { projects: number | null; characters: number | null; aiGenerations: number | null } {
    return PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;
  }
}
