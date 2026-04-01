"use client";

import { cn } from "@/lib/utils";
import { OptionCards, AnsweredOptionCards } from "@/components/chat/OptionCards";
import { ProgressMessage } from "@/components/chat/ProgressMessage";
import type { ExtendedChatMessage, PipelineStep } from "@/lib/types/chat";

interface MessageRendererProps {
  message: ExtendedChatMessage;
  isLatest: boolean;
  onOptionSelect: (messageId: string, selected: string[]) => void;
  onCustomInput: () => void;
}

export function MessageRenderer({
  message,
  isLatest,
  onOptionSelect,
  onCustomInput,
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
          <p
            className="text-sm whitespace-pre-wrap"
            style={{ lineHeight: 1.6 }}
          >
            {message.content}
          </p>
        )}

        {/* Progress indicator */}
        {message.messageType === 'progress' && message.options?.items?.[0] && (
          <ProgressMessage
            step={message.options.items[0].id as PipelineStep}
          />
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

        {/* Blocks (legacy) */}
        {message.blocks && message.blocks.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[var(--at-border-light)] space-y-1">
            {message.blocks.map((block, idx) => (
              <div key={idx} className="text-xs opacity-70">
                <span className="font-medium">{block.label}:</span>{" "}
                <span>{block.text.substring(0, 50)}...</span>
              </div>
            ))}
          </div>
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
