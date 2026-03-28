"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface UpgradeDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function UpgradeDialog({ open, onClose }: UpgradeDialogProps) {
  const router = useRouter();

  if (!open) return null;

  const handleUpgrade = () => {
    onClose();
    router.push('/pricing');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative paper-card rounded-lg p-8 max-w-md w-full mx-4 space-y-4"
        role="dialog"
        aria-modal
        aria-labelledby="upgrade-dialog-title"
      >
        <h2
          id="upgrade-dialog-title"
          className="text-xl font-semibold"
          style={{ color: 'var(--muji-charcoal)' }}
        >
          升级以解锁完整功能
        </h2>
        <p className="text-sm" style={{ color: 'var(--muji-dark-gray)' }}>
          Pro 计划包含无限 AI 生成、分支剧本编辑、故事板模式、DOCX/PDF 导出等全部功能。
        </p>
        <div className="flex gap-3 pt-2">
          <Button onClick={onClose} variant="outline" className="flex-1">
            稍后再说
          </Button>
          <Button
            onClick={handleUpgrade}
            className="flex-1 font-medium"
            style={{ background: 'var(--muji-charcoal)', color: 'var(--muji-cream)' }}
          >
            查看计划
          </Button>
        </div>
      </div>
    </div>
  );
}
