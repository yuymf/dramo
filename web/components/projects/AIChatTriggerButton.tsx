"use client";

import { useAIChat } from "@/app/ai-chat-provider";
import { cn } from "@/lib/utils";

interface AIChatTriggerButtonProps {
  className?: string;
}

export function AIChatTriggerButton({ className }: AIChatTriggerButtonProps) {
  const { isOpen, toggleDrawer } = useAIChat();

  return (
    <button
      onClick={toggleDrawer}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "w-14 h-14 rounded-full",
        "bg-[var(--at-surface)] border border-[var(--at-border)]",
        "shadow-lg hover:shadow-xl",
        "transition-all duration-300",
        "hover:scale-[1.03] active:scale-[0.98]",
        "flex items-center justify-center",
        "group",
        !isOpen && "animate-breathe",
        className
      )}
      aria-label="打开AI助手"
      title="打开AI助手"
      style={{ opacity: isOpen ? 0.8 : 1 }}
    >
      <div className="relative w-8 h-8">
        <div
          className={cn(
            "w-full h-full flex items-center justify-center",
            "text-2xl transition-transform duration-300",
            "group-hover:scale-110"
          )}
        >
          🐱
        </div>
      </div>
    </button>
  );
}
