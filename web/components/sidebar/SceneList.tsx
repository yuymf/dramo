"use client";
import { useMemo, useState, useEffect, memo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/models";

interface SceneListProps {
  scenes: Scene[];
  activeSceneId?: string;
  scrollToSceneId?: string;
  onSceneClick: (sceneId: string) => void;
  onReorder: (scenes: Scene[]) => void;
  onAddScene?: () => void;
  onDeleteScene?: (sceneId: string) => void;
  onEditSceneTitle?: (sceneId: string, newTitle: string) => void;
}

const SortableSceneItem = memo(function SortableSceneItem({
  scene,
  isActive,
  onClick,
  onDelete,
  onEditTitle,
}: {
  scene: Scene;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onEditTitle?: (newTitle: string) => void;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editDescValue, setEditDescValue] = useState('');

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 解析场景数据：格式 "INT./EXT. 场景名 - 日/夜 | 场景描述"
  const parseSceneTitle = (title: string) => {
    // 先按 | 分隔场景名和场景描述
    const parts = title.split('|');
    const mainPart = parts[0]?.trim() || '';
    const description = parts[1]?.trim() || '';
    
    // 解析主要部分：INT./EXT. 场景名 - 日/夜
    const match = mainPart.match(/^(EXT\.|INT\.)?\s*(.+?)(?:\s*[-–—]\s*(.+))?$/);
    if (match) {
      const [, type, name, time] = match;
      return {
        type: (type || 'INT.') as 'INT.' | 'EXT.',
        name: name?.trim() || '',
        time: (time?.trim() || '日') as '日' | '夜',
        description: description,
      };
    }
    return {
      type: 'INT.' as 'INT.' | 'EXT.',
      name: mainPart || '',
      time: '日' as '日' | '夜',
      description: description,
    };
  };

  const sceneInfo = parseSceneTitle(scene.title);

  const buildTitle = (type: string, name: string, time: string, desc: string) => {
    const mainPart = `${type} ${name} - ${time}`;
    return desc ? `${mainPart} | ${desc}` : mainPart;
  };

  const handleTypeChange = (newType: 'INT.' | 'EXT.') => {
    if (onEditTitle) {
      const newTitle = buildTitle(newType, sceneInfo.name, sceneInfo.time, sceneInfo.description);
      onEditTitle(newTitle);
    }
  };

  const handleTimeChange = (newTime: '日' | '夜') => {
    if (onEditTitle) {
      const newTitle = buildTitle(sceneInfo.type, sceneInfo.name, newTime, sceneInfo.description);
      onEditTitle(newTitle);
    }
  };

  // 场景名编辑
  const handleNameDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditTitle) {
      setIsEditingName(true);
      setEditNameValue(sceneInfo.name);
    }
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (editNameValue.trim() && editNameValue !== sceneInfo.name && onEditTitle) {
      const trimmedValue = editNameValue.trim().slice(0, 50);
      const newTitle = buildTitle(sceneInfo.type, trimmedValue, sceneInfo.time, sceneInfo.description);
      onEditTitle(newTitle);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNameBlur();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
      setEditNameValue(sceneInfo.name);
    }
  };

  // 场景描述编辑
  const handleDescriptionDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditTitle) {
      setIsEditingDescription(true);
      setEditDescValue(sceneInfo.description);
    }
  };

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
    if (editDescValue.trim() !== sceneInfo.description && onEditTitle) {
      const trimmedValue = editDescValue.trim().slice(0, 100);
      const newTitle = buildTitle(sceneInfo.type, sceneInfo.name, sceneInfo.time, trimmedValue);
      onEditTitle(newTitle);
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleDescriptionBlur();
    } else if (e.key === "Escape") {
      setIsEditingDescription(false);
      setEditDescValue(sceneInfo.description);
    }
  };

  const isNameLong = sceneInfo.name.length > 15;
  const isDescLong = sceneInfo.description.length > 30;
  const nameCharCount = editNameValue.length;
  const descCharCount = editDescValue.length;
  const isNameNearLimit = nameCharCount > 40;
  const isDescNearLimit = descCharCount > 80;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="group relative mb-1 px-2" 
      id={`scene-item-${scene.id}`}
    >
      <div
        className={cn(
          "relative rounded transition-all border-l-2",
          isActive
            ? "bg-[var(--rice-warm)] border-l-[var(--persimmon)]"
            : "bg-transparent border-l-transparent hover:bg-[var(--rice-warm)]"
        )}
      >
        <div className="flex items-start gap-2 p-2">
          <span
            className="ink-display text-xs w-5 flex-shrink-0 cursor-pointer"
            style={{ fontWeight: 700, color: isActive ? 'var(--persimmon)' : 'var(--ink-light)' }}
            onClick={onClick}
          >
            {scene.order}
          </span>
          <div className="flex-1 min-w-[4rem] overflow-hidden">
            {/* 第一行：场景类型 + 场景名 */}
            <div className="flex items-baseline gap-2 mb-0.5">
              <select
                value={sceneInfo.type}
                onChange={(e) => handleTypeChange(e.target.value as 'INT.' | 'EXT.')}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-semibold jp-serif bg-transparent border-none outline-none cursor-pointer hover:text-[var(--persimmon)] p-0 flex-shrink-0"
              >
                <option value="INT.">INT.</option>
                <option value="EXT.">EXT.</option>
              </select>
              
              {isEditingName ? (
                <div className="flex items-center gap-1 flex-1 min-w-[3.5rem]">
                  <input
                    type="text"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onBlur={handleNameBlur}
                    onKeyDown={handleNameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    maxLength={50}
                    className={cn(
                      "flex-1 text-sm text-slate-600 jp-serif bg-transparent border-b outline-none px-0 min-w-0",
                      isNameNearLimit ? "border-amber-400" : "border-[var(--brand-500)]"
                    )}
                    placeholder="场景名"
                  />
                  <span className={cn(
                    "text-[10px] font-mono flex-shrink-0",
                    isNameNearLimit ? "text-amber-600 font-semibold" : "text-slate-400"
                  )}>
                    {nameCharCount}/50
                  </span>
                </div>
              ) : (
                <span 
                  className={cn(
                    "text-sm jp-serif cursor-text block overflow-hidden text-ellipsis whitespace-nowrap font-medium",
                    isNameLong ? "text-slate-500" : "text-slate-700"
                  )}
                  style={{ 
                    minWidth: '3.5rem',
                    maxWidth: 'calc(100% - 2rem)'
                  }}
                  onDoubleClick={handleNameDoubleClick}
                  title={sceneInfo.name ? `${sceneInfo.name}\n\n双击编辑场景名（当前${sceneInfo.name.length}字）` : "双击编辑场景名"}
                >
                  {sceneInfo.name || '场景名'}
                </span>
              )}
            </div>
            
            {/* 第二行：场景描述 */}
            <div className="min-h-[1rem]">
              {isEditingDescription ? (
                <div className="flex flex-col gap-1">
                  <textarea
                    value={editDescValue}
                    onChange={(e) => setEditDescValue(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    onKeyDown={handleDescriptionKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    maxLength={100}
                    rows={2}
                    className={cn(
                      "w-full text-xs text-slate-600 jp-serif bg-white border rounded px-2 py-1 outline-none resize-none",
                      isDescNearLimit ? "border-amber-400" : "border-[var(--brand-500)]"
                    )}
                    placeholder="场景描述"
                  />
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 italic truncate">Enter保存 · Esc取消</span>
                    <span className={cn(
                      "font-mono flex-shrink-0 ml-2",
                      isDescNearLimit ? "text-amber-600 font-semibold" : "text-slate-400"
                    )}>
                      {descCharCount}/100
                    </span>
                  </div>
                </div>
              ) : (
                <div 
                  className={cn(
                    "text-[11px] italic jp-serif cursor-text overflow-hidden text-ellipsis",
                    sceneInfo.description 
                      ? (isDescLong ? "text-amber-600" : "text-slate-500")
                      : "text-slate-400"
                  )}
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: '1.3',
                  }}
                  onDoubleClick={handleDescriptionDoubleClick}
                  title={sceneInfo.description 
                    ? `${sceneInfo.description}\n\n双击编辑场景描述（当前${sceneInfo.description.length}字）` 
                    : "双击编辑场景描述"}
                >
                  {sceneInfo.description || '请输入场景描述'}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <select
              value={sceneInfo.time}
              onChange={(e) => handleTimeChange(e.target.value as '日' | '夜')}
              onClick={(e) => e.stopPropagation()}
              className="text-xs jp-serif bg-transparent border-none outline-none cursor-pointer hover:text-[var(--persimmon)] flex-shrink-0 p-0 w-8"
              style={{ color: 'var(--ink-light)' }}
            >
              <option value="日">日</option>
              <option value="夜">夜</option>
            </select>
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 flex-shrink-0 transition-colors"
              style={{ color: 'var(--ink-light)' }}
              aria-label="拖拽排序"
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <circle cx="3" cy="3" r="1"/>
                <circle cx="3" cy="6" r="1"/>
                <circle cx="3" cy="9" r="1"/>
                <circle cx="9" cy="3" r="1"/>
                <circle cx="9" cy="6" r="1"/>
                <circle cx="9" cy="9" r="1"/>
              </svg>
            </button>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-1 flex-shrink-0"
                style={{ color: 'var(--ink-light)' }}
                aria-label="删除场景"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 2l8 8M10 2l-8 8"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export function SceneList({
  scenes,
  activeSceneId,
  scrollToSceneId,
  onSceneClick,
  onReorder,
  onAddScene,
  onDeleteScene,
  onEditSceneTitle,
}: SceneListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sceneIds = useMemo(() => scenes.map((s) => s.id), [scenes]);

  useEffect(() => {
    if (scrollToSceneId) {
      const element = document.getElementById(`scene-item-${scrollToSceneId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [scrollToSceneId]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);

      const reordered = arrayMove(scenes, oldIndex, newIndex).map((s, i) => ({
        ...s,
        order: i + 1,
      }));

      onReorder(reordered);
    }
  }

  return (
    <div className="h-[calc(100%-40px)] flex flex-col">
      <ScrollArea className="flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sceneIds} strategy={verticalListSortingStrategy}>
            <div className="pt-2 pb-1">
              {scenes.map((scene) => (
                <SortableSceneItem
                  key={scene.id}
                  scene={scene}
                  isActive={activeSceneId === scene.id}
                  onClick={() => onSceneClick(scene.id)}
                  onDelete={onDeleteScene ? () => onDeleteScene(scene.id) : undefined}
                  onEditTitle={onEditSceneTitle ? (newTitle) => onEditSceneTitle(scene.id, newTitle) : undefined}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>
      
      {onAddScene && (
        <div className="pt-2 pb-2 px-2 border-t border-[rgba(26,26,24,0.08)]">
          <button
            onClick={onAddScene}
            className="ink-button-ghost w-full text-xs h-8 flex items-center justify-center gap-1"
          >
            + 添加场景
          </button>
        </div>
      )}
    </div>
  );
}

