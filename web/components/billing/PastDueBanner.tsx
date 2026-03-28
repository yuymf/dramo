"use client";

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { createPortalSession } from '@/lib/api/billing';

export function PastDueBanner() {
  const { subscription } = useSubscription();
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (subscription?.status !== 'past_due') return null;

  const handleUpdatePayment = async () => {
    setIsRedirecting(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (error) {
      console.error('[PastDueBanner] Failed to create portal session:', error);
      setIsRedirecting(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2 text-sm"
      style={{ background: '#fde8e8', color: '#c0392b' }}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>支付失败，请更新支付方式以继续使用 Pro 功能</span>
      <Button
        onClick={handleUpdatePayment}
        disabled={isRedirecting}
        size="sm"
        variant="outline"
        className="ml-2"
        style={{ borderColor: '#c0392b', color: '#c0392b' }}
      >
        {isRedirecting ? '跳转中...' : '更新支付方式'}
      </Button>
    </div>
  );
}
