"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Sparkles, Wand2, Trash2, GripVertical, ChevronDown } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import type { Editor } from "@tiptap/react";
import type { Block, PolishOperation } from "@/lib/models";
// import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface EditorBlockProps {
  block: Block;
  onChange: (content: string) => void;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
  onPolish: (operation: PolishOperation) => void;
  onGenerate: () => void;
  onEditorReady?: (editor: Editor) => void;
  editorId?: string;
  autoFocus?: boolean;
}

export function EditorBlock({
  block,
  onChange,
  onLabelChange,
  onDelete,
  onPolish,
  onGenerate,
  onEditorReady,
  editorId,
  autoFocus,
}: EditorBlockProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(block.label || "正文");
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (isEditingLabel && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingLabel]);

  const handleLabelDoubleClick = () => {
    setIsEditingLabel(true);
  };

  const handleLabelSave = () => {
    setIsEditingLabel(false);
    if (labelValue.trim()) {
      onLabelChange(labelValue.trim());
    } else {
      setLabelValue(block.label || "正文");
    }
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLabelSave();
    } else if (e.key === "Escape") {
      setIsEditingLabel(false);
      setLabelValue(block.label || "正文");
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      <div className="flex items-center justify-between">
        {/* 左侧：拖拽把手 + 标题 */}
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1"
            aria-label="拖拽排序"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {isEditingLabel ? (
            <input
              ref={inputRef}
              type="text"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={handleLabelKeyDown}
              className="text-xs font-semibold text-slate-600 uppercase tracking-wide border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-[var(--brand-500)]"
            />
          ) : (
            <label
              onDoubleClick={handleLabelDoubleClick}
              className="text-xs font-semibold text-slate-600 uppercase tracking-wide cursor-pointer hover:text-slate-800"
              title="双击编辑"
            >
              {labelValue}
            </label>
          )}
        </div>

        {/* 右侧：操作图标 */}
        <div className="flex items-center gap-1">
          {/* 润色下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-0.5 p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-[var(--brand-500)] transition-colors"
                aria-label="润色选项"
                title="润色"
              >
                <Wand2 className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onPolish('adjust_style')}>
                🎨 改变风格
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPolish('simplify')}>
                ✂️ 简化
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPolish('expand')}>
                📝 扩写
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onPolish('rewrite')}>
                🔄 重写
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={onGenerate}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-[var(--brand-500)] transition-colors"
            aria-label="生成"
            title="生成"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-500 transition-colors"
            aria-label="删除"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 编辑器 */}
      <RichTextEditor
        content={block.text}
        onChange={onChange}
        onEditorReady={onEditorReady}
        editorId={editorId}
        autoFocus={autoFocus}
        placeholder="请输入剧本内容"
      />
    </div>
  );
}

