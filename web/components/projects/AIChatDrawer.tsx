"use client";

import { X } from "lucide-react";
import { AIChatPanel } from "@/components/chat/AIChatPanel";
import { useAIChat } from "@/app/ai-chat-provider";
import { cn } from "@/lib/utils";

interface AIChatDrawerProps {
  projectId: string;
}

export function AIChatDrawer({ projectId }: AIChatDrawerProps) {
  const { isOpen, closeDrawer } = useAIChat();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className={cn(
            "fixed inset-0 z-40 lg:hidden transition-opacity duration-300 bg-black/20",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={closeDrawer}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full lg:w-[500px] z-50",
          "bg-[var(--at-bg)]",
          "shadow-xl transition-all duration-500 ease-out",
          "border-l border-[var(--at-border)]",
          isOpen
            ? "translate-x-0 opacity-100"
            : "translate-x-full opacity-60 pointer-events-none"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
            <div className="flex items-center gap-2">
              <span className="text-lg">🐱</span>
              <h2 className="text-base font-semibold text-[var(--at-text)]">AI 助手</h2>
            </div>
            <button
              onClick={closeDrawer}
              className="p-1.5 rounded-lg hover:bg-[var(--at-surface-hover)] transition-colors"
            >
              <X className="w-5 h-5 text-[var(--at-text-secondary)]" strokeWidth={1.5} />
            </button>
          </div>

          {/* Chat Panel */}
          <div className="flex-1 overflow-hidden">
            <AIChatPanel projectId={projectId} onClose={closeDrawer} />
          </div>
        </div>
      </div>
    </>
  );
}
