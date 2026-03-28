/**
 * Base Chat Input - 空白故事板模式
 * 直接跳转到剧本编辑页
 */
"use client";

import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

interface BaseChatInputProps {
  projectId: string;
}

export function BaseChatInput({ projectId }: BaseChatInputProps) {
  const router = useRouter();

  const handleCreate = () => {
    // 跳转到 /projects/[id]/scripts 页面
    router.push(`/projects/${projectId}`);
  };

  return (
    <div className="p-8">
      <div className="ink-card p-12 flex flex-col items-center justify-center text-center">
        <FileText className="w-12 h-12 mb-4" style={{ color: 'var(--ink-light)', opacity: 0.4 }} />
        <p className="ink-display text-base mb-2" style={{ fontWeight: 500 }}>
          空白画布，从零开始创作
        </p>
        <p className="ink-body text-sm mb-6" style={{ color: 'var(--ink-light)' }}>
          创建一个空白故事板，自由编辑
        </p>

        <button
          onClick={handleCreate}
          className="ink-button text-sm"
        >
          创建空白故事板
        </button>
      </div>

      <p className="text-xs text-center mt-6" style={{ color: 'var(--ink-light)', opacity: 0.6 }}>
        你的内容将保持私密。我们不会存储剧本或用于AI训练。
      </p>
    </div>
  );
}

