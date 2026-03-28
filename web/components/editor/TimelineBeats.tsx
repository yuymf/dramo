"use client";

import { useState, memo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Act } from "@/lib/models";

interface ActTimelineProps {
  acts: Act[];
  activeActId?: string;
  onActClick: (actId: string) => void;
  onAddAct: () => void;
  onEditActName: (actId: string, newName: string) => void;
  onReorderActs: (reorderedActs: Act[]) => void;
}

const SortableActChip = memo(function SortableActChip({
  act,
  isActive,
  onClick,
  onEditName,
}: {
  act: Act;
  isActive: boolean;
  onClick: () => void;
  onEditName: (newName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(act.name);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: act.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(act.name);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== act.name) {
      onEditName(editValue.trim());
    } else {
      setEditValue(act.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(act.name);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex flex-col items-center px-6"
    >
      <div className="flex flex-col items-center">
        <div
          {...listeners}
          onClick={onClick}
          className={cn(
            "w-3 h-3 rounded-full border-2 transition-all relative z-10 cursor-pointer",
            isActive
              ? "border-[var(--persimmon)] shadow-md scale-125"
              : "bg-white border-[rgba(26,26,24,0.15)] hover:border-[var(--persimmon)]"
          )}
          style={isActive ? { background: 'var(--persimmon)' } : undefined}
        />

        <div className="w-[2px] h-3" style={{ background: 'rgba(26,26,24,0.1)' }} />
        
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="mt-1 px-2 py-1 text-xs font-medium border border-[var(--brand-500)] rounded focus:outline-none text-center"
            style={{ width: `${Math.max(editValue.length * 8 + 20, 60)}px` }}
          />
        ) : (
          <button
            onClick={onClick}
            onDoubleClick={handleDoubleClick}
            className={cn(
              "mt-1 px-2 py-1 text-xs font-medium transition-all whitespace-nowrap rounded cursor-pointer",
              isActive
                ? "font-semibold"
                : "hover:text-[var(--ink-black)]"
            )}
            style={{ color: isActive ? 'var(--persimmon)' : 'var(--ink-light)' }}
          >
            {act.name}
          </button>
        )}
      </div>
    </div>
  );
});

export function ActTimeline({
  acts,
  activeActId,
  onActClick,
  onAddAct,
  onEditActName,
  onReorderActs,
}: ActTimelineProps) {
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = acts.findIndex((a) => a.id === active.id);
      const newIndex = acts.findIndex((a) => a.id === over.id);

      const reordered = arrayMove(acts, oldIndex, newIndex).map((a, i) => ({
        ...a,
        order: i + 1,
      }));

      onReorderActs(reordered);
    }
  }

  return (
    <div className="sticky bottom-0 border-t border-[rgba(26,26,24,0.08)] rice-paper-bg">
      <ScrollArea className="w-full">
        <div className="relative px-4 py-2 min-w-max">
          <div className="absolute left-4 right-4 top-[12px] h-[2px]" style={{ background: 'rgba(26,26,24,0.08)' }} />
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={acts.map((a) => a.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex items-start">
                {acts.map((act) => (
                  <SortableActChip
                    key={act.id}
                    act={act}
                    isActive={activeActId === act.id}
                    onClick={() => onActClick(act.id)}
                    onEditName={(newName) => onEditActName(act.id, newName)}
                  />
                ))}
                
                <div className="flex items-center ml-4 mt-1">
                  <button
                    onClick={onAddAct}
                    className="ink-button-ghost h-7 px-3 text-xs whitespace-nowrap"
                    style={{ borderStyle: 'dashed' }}
                  >
                    + 添加幕
                  </button>
                </div>
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export { ActTimeline as TimelineBeats };

