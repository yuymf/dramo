"use client";

import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/lib/hooks/use-subscription';

interface UpgradePromptProps {
  readonly feature?: string;
}

export function UpgradePrompt({ feature }: UpgradePromptProps) {
  const { showUpgradeDialog } = useSubscription();

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3"
      style={{
        background: 'var(--muji-oatmeal)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <Lock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muji-dark-gray)' }} />
      <span className="text-sm flex-1" style={{ color: 'var(--muji-dark-gray)' }}>
        {feature ? `${feature}需要 Pro 计划` : '此功能需要 Pro 计划'}
      </span>
      <Button
        onClick={showUpgradeDialog}
        size="sm"
        className="font-medium"
        style={{ background: 'var(--muji-charcoal)', color: 'var(--muji-cream)' }}
      >
        升级 Pro
      </Button>
    </div>
  );
}
