"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { getSubscription } from '@/lib/api/billing';

const MAX_POLLS = 15;
const POLL_INTERVAL_MS = 2000;

export default function BillingSuccessPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [status, setStatus] = useState<'polling' | 'success' | 'timeout'>('polling');
  const pollCountRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const poll = useCallback(async () => {
    try {
      const sub = await getSubscription();
      if (sub.planId !== 'free' && sub.status === 'active') {
        setStatus('success');
        await updateSession();
        return;
      }
    } catch (error) {
      console.error('[BillingSuccess] Poll error:', error);
    }

    pollCountRef.current += 1;
    if (pollCountRef.current >= MAX_POLLS) {
      setStatus('timeout');
      return;
    }

    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [updateSession]);

  useEffect(() => {
    poll();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poll]);

  const handleRetry = () => {
    pollCountRef.current = 0;
    setStatus('polling');
    poll();
  };

  return (
    <div className="min-h-screen muji-paper-bg muji-paper-texture flex items-center justify-center px-4">
      <div className="paper-card rounded-lg p-8 max-w-md w-full text-center space-y-4">
        {status === 'polling' && (
          <>
            <div className="text-5xl">⏳</div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--muji-charcoal)' }}>
              正在确认支付...
            </h1>
            <p className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
              请稍候，正在验证你的订阅状态
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-5xl">🎉</div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--muji-charcoal)' }}>
              订阅成功！
            </h1>
            <p className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
              感谢升级 Pro 计划，所有功能现已可用
            </p>
            <Button
              onClick={() => router.push('/projects')}
              className="w-full font-medium"
              style={{ background: 'var(--muji-charcoal)', color: 'var(--muji-cream)' }}
            >
              返回项目 →
            </Button>
          </>
        )}
        {status === 'timeout' && (
          <>
            <div className="text-5xl">⏱️</div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--muji-charcoal)' }}>
              正在处理中
            </h1>
            <p className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
              支付已提交，订阅激活可能需要几分钟。你可以稍后再检查。
            </p>
            <div className="flex gap-3">
              <Button onClick={handleRetry} variant="outline" className="flex-1">
                再次检查
              </Button>
              <Button
                onClick={() => router.push('/projects')}
                className="flex-1 font-medium"
                style={{ background: 'var(--muji-charcoal)', color: 'var(--muji-cream)' }}
              >
                返回项目
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
