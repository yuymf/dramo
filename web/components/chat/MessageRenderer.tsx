"use client";

import { cn } from "@/lib/utils";
import { OptionCards, AnsweredOptionCards } from "@/components/chat/OptionCards";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import type { ExtendedChatMessage } from "@/lib/types/chat";

interface MessageRendererProps {
  message: ExtendedChatMessage;
  isLatest: boolean;
  isStreaming?: boolean;
  onOptionSelect: (messageId: string, selected: string[]) => void;
  onCustomInput: () => void;
  onConfirmScript?: () => void;
}

export function MessageRenderer({
  message,
  isLatest,
  isStreaming = false,
  onOptionSelect,
  onCustomInput,
  onConfirmScript,
}: MessageRendererProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-2.5",
          isUser
            ? "bg-[var(--at-accent)] text-[var(--at-text-inverse)]"
            : "bg-[var(--at-surface)] border border-[var(--at-border)] text-[var(--at-text)]"
        )}
      >
        {/* Text content */}
        {message.content && (
          isUser ? (
            <p
              className="text-sm whitespace-pre-wrap"
              style={{ lineHeight: 1.6 }}
            >
              {message.content}
            </p>
          ) : (
            <MarkdownContent
              content={message.content}
              isStreaming={isStreaming && isLatest}
            />
          )
        )}

        {/* Option cards */}
        {message.options && message.role === 'assistant' && (
          message.selectedOption ? (
            <AnsweredOptionCards
              options={message.options}
              selectedIds={
                Array.isArray(message.selectedOption)
                  ? message.selectedOption
                  : [message.selectedOption]
              }
            />
          ) : isLatest ? (
            <OptionCards
              options={message.options}
              onSelect={(selected) => onOptionSelect(message.id, selected)}
              onCustomInput={onCustomInput}
            />
          ) : (
            <OptionCards
              options={message.options}
              disabled
              onSelect={() => {}}
              onCustomInput={() => {}}
            />
          )
        )}

        {/* Confirm-script gate: shown only when pipeline is paused for review */}
        {message.messageType === 'confirm_script' && onConfirmScript && (
          <button
            onClick={onConfirmScript}
            className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium bg-[var(--at-accent)] text-[var(--at-text-inverse)] hover:opacity-90 active:opacity-80 transition-opacity"
          >
            🚀 确认台本，继续生成角色 & 分镜
          </button>
        )}

        {/* Timestamp */}
        <p className="text-xs opacity-50 mt-1">
          {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
