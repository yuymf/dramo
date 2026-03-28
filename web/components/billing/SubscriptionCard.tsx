"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { createPortalSession } from '@/lib/api/billing';

const PLAN_LABELS: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  enterprise: '企业版',
};

const STATUS_LABELS: Record<string, { text: string; color: string; bg: string }> = {
  active: { text: '活跃', color: '#2d7a2d', bg: '#e8f4e8' },
  past_due: { text: '逾期', color: '#c0392b', bg: '#fde8e8' },
  canceled: { text: '已取消', color: '#7f8c8d', bg: '#f0f0f0' },
  trialing: { text: '试用中', color: '#2980b9', bg: '#e8f0f8' },
};

export function SubscriptionCard() {
  const { subscription, isLoading } = useSubscription();
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg p-6" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 rounded w-1/3" style={{ background: 'var(--muji-oatmeal)' }} />
          <div className="h-4 rounded w-1/2" style={{ background: 'var(--muji-oatmeal)' }} />
        </div>
      </div>
    );
  }

  const plan = subscription?.planId ?? 'free';
  const status = subscription?.status ?? 'active';
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.active;

  const handleManage = async () => {
    setIsRedirecting(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (error) {
      console.error('[SubscriptionCard] Failed to create portal session:', error);
      setIsRedirecting(false);
    }
  };

  return (
    <div className="rounded-lg p-6" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: 'var(--muji-charcoal)' }}>
            {PLAN_LABELS[plan] ?? plan}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ color: statusInfo.color, background: statusInfo.bg }}
          >
            {statusInfo.text}
          </span>
        </div>
        {subscription?.billingInterval && (
          <span className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
            {subscription.billingInterval === 'month' ? '¥99/月' : '¥999/年'}
          </span>
        )}
      </div>

      {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
        <p className="text-sm mb-3" style={{ color: '#c0392b' }}>
          Pro 计划将于 {new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')} 到期
        </p>
      )}

      {subscription?.currentPeriodEnd && !subscription.cancelAtPeriodEnd && (
        <p className="text-sm mb-3" style={{ color: 'var(--muji-dark-gray)' }}>
          下次续费: {new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')}
        </p>
      )}

      {plan !== 'free' && (
        <Button onClick={handleManage} disabled={isRedirecting} variant="outline" className="w-full">
          {isRedirecting ? '跳转中...' : '管理订阅'}
        </Button>
      )}
    </div>
  );
}
