"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessageOptions } from "@/lib/types/chat";

interface OptionCardsProps {
  options: ChatMessageOptions;
  disabled?: boolean;
  onSelect: (selected: string[]) => void;
  onCustomInput: () => void;
}

export function OptionCards({
  options,
  disabled = false,
  onSelect,
  onCustomInput,
}: OptionCardsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleCardClick = (id: string) => {
    if (disabled) return;

    if (options.multiSelect) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      onSelect([id]);
    }
  };

  const handleConfirm = () => {
    if (selected.size > 0) {
      onSelect(Array.from(selected));
    }
  };

  return (
    <div className="space-y-2 mt-3">
      {options.items.map((item) => {
        const isSelected = selected.has(item.id);
        return (
          <button
            key={item.id}
            onClick={() => handleCardClick(item.id)}
            disabled={disabled}
            className={cn(
              "w-full text-left px-4 py-3 rounded-xl border transition-all duration-200",
              "hover:shadow-sm hover:border-orange-300 hover:bg-orange-50/50",
              isSelected
                ? "border-orange-400 bg-orange-50 shadow-sm"
                : "border-stone-200 bg-white",
              disabled && "opacity-60 cursor-not-allowed hover:shadow-none hover:border-stone-200 hover:bg-white"
            )}
          >
            <div className="flex items-start gap-2.5">
              {item.icon && (
                <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-900">{item.label}</p>
                {item.description && (
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {/* Custom input card */}
      <button
        onClick={onCustomInput}
        disabled={disabled}
        className={cn(
          "w-full text-left px-4 py-3 rounded-xl border border-dashed transition-all duration-200",
          "border-stone-300 hover:border-orange-300 hover:bg-orange-50/30",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">✏️</span>
          <p className="text-sm text-stone-500">我有别的想法...</p>
        </div>
      </button>

      {/* Skip action */}
      {options.skipAction && (
        <button
          onClick={() => onSelect(['__skip__'])}
          disabled={disabled}
          className={cn(
            "w-full text-left px-4 py-3 rounded-xl border transition-all duration-200",
            "border-stone-200 bg-stone-50 hover:border-orange-300 hover:bg-orange-50/50",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{options.skipAction.icon}</span>
            <p className="text-sm font-medium text-stone-700">{options.skipAction.label}</p>
          </div>
        </button>
      )}

      {/* Confirm button for multi-select */}
      {options.multiSelect && selected.size > 0 && !disabled && (
        <button
          onClick={handleConfirm}
          className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          确认选择 ({selected.size})
        </button>
      )}
    </div>
  );
}

/** Renders already-answered option cards (disabled, shows selection) */
export function AnsweredOptionCards({
  options,
  selectedIds,
}: {
  options: ChatMessageOptions;
  selectedIds: string[];
}) {
  const selectedSet = new Set(selectedIds);

  return (
    <div className="space-y-1.5 mt-2 opacity-60">
      {options.items
        .filter((item) => selectedSet.has(item.id))
        .map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200"
          >
            {item.icon && <span className="text-sm">{item.icon}</span>}
            <span className="text-xs font-medium text-orange-700">{item.label}</span>
          </div>
        ))}
    </div>
  );
}
