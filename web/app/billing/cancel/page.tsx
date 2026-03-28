"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function BillingCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen muji-paper-bg muji-paper-texture flex items-center justify-center px-4">
      <div className="paper-card rounded-lg p-8 max-w-md w-full text-center space-y-4">
        <div className="text-5xl">😿</div>
        <h1
          className="text-xl font-semibold"
          style={{ color: 'var(--muji-charcoal)' }}
        >
          支付已取消
        </h1>
        <p className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
          没关系，你可以随时升级
        </p>
        <div className="flex gap-3">
          <Button
            onClick={() => router.push('/projects')}
            variant="outline"
            className="flex-1"
          >
            返回项目
          </Button>
          <Button
            onClick={() => router.push('/pricing')}
            className="flex-1 font-medium"
            style={{ background: 'var(--muji-charcoal)', color: 'var(--muji-cream)' }}
          >
            重新选择
          </Button>
        </div>
      </div>
    </div>
  );
}
