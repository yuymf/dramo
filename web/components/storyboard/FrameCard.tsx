/**
 * FrameCard - MUJI-style storyboard frame
 * 设计原则: 极简留白 · 纯文字层级 · 单一柿红点缀 · 克制交互
 */
"use client";

import { useState, useMemo, useRef } from "react";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Sparkles, Copy, Trash2, ChevronDown, ChevronUp, Upload, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FrameData } from "@/lib/types/storyboard";
import { api } from "@/lib/api/client";

export const SHOT_SIZE_OPTIONS = ["大远景", "远景", "全景", "中景", "中近景", "近景", "特写", "大特写"];
export const CAMERA_ANGLE_OPTIONS = ["平视", "俯拍（高角度）", "仰拍（低角度）", "过肩", "鸟瞰", "虫视"];
export const CAMERA_MOVEMENT_OPTIONS = ["固定", "摇镜 (Pan)", "俯仰 (Tilt)", "推 (Dolly In)", "拉 (Dolly Out)", "跟拍 (Tracking)", "环绕 (Arc)", "升降 (Crane)"];
export const FOCAL_LENGTH_OPTIONS = ["14mm", "24mm", "35mm", "50mm", "85mm", "100mm", "135mm", "200mm"];
export const STYLE_OPTIONS = ["写实", "动画风", "水彩风", "油画风", "赛博朋克", "复古胶片", "线稿风", "漫画风"];

interface FrameCardProps {
  frame: FrameData;
  onGenerate: (frameId: string) => void;
  onDuplicate: (frameId: string) => void;
  onDelete: (frameId: string) => void;
  onImageDrop?: (frameId: string, imageUrl: string) => void;
  onChange?: (frameId: string, updates: Partial<FrameData>) => void;
  onInsertAfter?: (frameId: string) => void;
  projectId?: string;
  assets?: {
    characters: Array<{ id: string; name: string; images: Array<{ id: string; url: string }> }>;
    locations: Array<{ id: string; name: string; images: Array<{ id: string; url: string }> }>;
  };
}

/** Borderless ghost select — looks like plain text, click to change */
function GhostSelect({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 text-[11px] leading-none transition-colors group/gs"
        style={{ color: value ? 'var(--at-text-secondary)' : 'var(--at-text-tertiary)' }}
      >
        <span>{value || placeholder}</span>
        <ChevronDown
          className="w-2.5 h-2.5 opacity-40 group-hover/gs:opacity-80 transition-opacity"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 mt-1 min-w-[100px] bg-[var(--at-surface)] border border-[var(--at-border)] rounded-lg overflow-hidden z-20"
            style={{ boxShadow: 'var(--at-shadow-md)' }}
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-[11px] transition-colors",
                  value === opt
                    ? "text-[var(--at-accent)] bg-[var(--at-accent-light)]"
                    : "text-[var(--at-text)] hover:bg-[var(--at-surface-hover)]"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Double-click to edit inline */
function InlineEdit({
  value,
  onChange,
  placeholder = "双击编辑",
  multiline = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    const shared = cn(
      "w-full bg-transparent border-b border-[var(--at-border-focus)] focus:outline-none py-0.5",
      className
    );
    return multiline ? (
      <textarea
        autoFocus
        value={draft}
        rows={3}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Escape' && cancel()}
        className={cn(shared, "resize-none")}
      />
    ) : (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
        className={shared}
      />
    );
  }

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      className={cn("cursor-text", !value && "italic", className)}
      style={{ color: value ? undefined : 'var(--at-text-tertiary)' }}
    >
      {value || placeholder}
    </div>
  );
}

export function FrameCard({
  frame,
  onGenerate,
  onDuplicate,
  onDelete,
  onImageDrop,
  onChange,
  onInsertAfter,
  projectId,
  assets,
}: FrameCardProps) {
  const [hoveringImage, setHoveringImage] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  const [draggingOverRef, setDraggingOverRef] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: frame.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const assetTagsMap = useMemo(() => {
    const map = new Map<string, { characters: string[]; locations: string[] }>();
    if (!assets) return map;
    assets.characters.forEach((c) => c.images.forEach((img) => {
      const e = map.get(img.url) || { characters: [], locations: [] };
      e.characters.push(c.name); map.set(img.url, e);
    }));
    assets.locations.forEach((l) => l.images.forEach((img) => {
      const e = map.get(img.url) || { characters: [], locations: [] };
      e.locations.push(l.name); map.set(img.url, e);
    }));
    return map;
  }, [assets]);

  const set = (field: keyof FrameData, value: unknown) => onChange?.(frame.id, { [field]: value });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    const url = e.dataTransfer.getData("image/url");
    if (url) onImageDrop?.(frame.id, url);
  };

  const handleRefDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDraggingOverRef(false);
    const url = e.dataTransfer.getData("image/url");
    const path = e.dataTransfer.getData("image/path");
    if (url && onChange) {
      const imgs = frame.referenceImages || [];
      if (!imgs.includes(url))
        onChange(frame.id, { referenceImages: [...imgs, url], referencePaths: [...(frame.referencePaths || []), path || ''] });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target?.result as string;
      const imgs = frame.referenceImages || [];
      const paths = frame.referencePaths || [];
      onChange?.(frame.id, { referenceImages: [...imgs, b64], referencePaths: [...paths, ''] });
      if (projectId) {
        try {
          const res = await api<{ url: string; path: string }>(`/api/projects/${projectId}/uploads/image-v2`, { method: 'POST', body: { base64Data: b64 } });
          const updated = [...imgs, b64]; updated[updated.length - 1] = res.url;
          const updatedP = [...paths, '']; updatedP[updatedP.length - 1] = res.path;
          onChange?.(frame.id, { referenceImages: updated, referencePaths: updatedP });
        } catch { /* keep base64 preview */ }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeRef = (i: number) => onChange?.(frame.id, {
    referenceImages: (frame.referenceImages || []).filter((_, j) => j !== i),
    referencePaths: (frame.referencePaths || []).filter((_, j) => j !== i),
  });

  // Compose entity line: "七海 · 雄摩  /  城市"
  const chars = frame.characters?.filter(Boolean) ?? [];
  const locs = frame.locations?.filter(Boolean) ?? [];
  const entityLine = [
    chars.join(' · '),
    locs.join(' · '),
  ].filter(Boolean).join('  /  ');

  const hasCamera = frame.shot_size || frame.camera_angle || frame.camera_movement || frame.focal_length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col bg-[var(--at-surface)] transition-all duration-300",
        "rounded-lg overflow-hidden",
        draggingOver
          ? "ring-1 ring-[var(--at-accent)]"
          : "hover:shadow-[var(--at-shadow-md)]",
        // subtle border
        "border border-[var(--at-border-light)]"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* ── Image ── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '16 / 9', background: 'var(--at-surface-sunken)' }}
        onMouseEnter={() => setHoveringImage(true)}
        onMouseLeave={() => setHoveringImage(false)}
        onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={handleDrop}
      >
        {frame.image ? (
          <Image src={frame.image.url} alt={frame.title} fill className="object-cover" sizes="480px" unoptimized />
        ) : (
          /* Empty frame placeholder */
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="32" height="24" viewBox="0 0 32 24" fill="none" style={{ opacity: 0.15 }}>
              <rect x="1" y="1" width="30" height="22" rx="2" stroke="currentColor" strokeWidth="1.2" />
              <rect x="5" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
              <path d="M1 16l7-5 6 4 5-3 12 7" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Order + meta — top-left strip */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-2 py-1.5"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 100%)' }}
        >
          <span className="text-[11px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {String(frame.order).padStart(2, '0')}
          </span>
          {(frame.sceneType || frame.timeOfDay) && (
            <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>
              {[frame.sceneType, frame.timeOfDay].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {/* Hover: generate button + context menu */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all duration-200",
            hoveringImage ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          style={{ background: 'rgba(20,16,12,0.38)' }}
        >
          <button
            onClick={() => onGenerate(frame.id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium transition-all active:scale-95"
            style={{
              background: 'var(--at-accent)',
              color: 'white',
              letterSpacing: '0.02em',
            }}
            aria-label="生成图片"
          >
            <Sparkles className="w-3 h-3" />
            生成
          </button>
        </div>

        {/* Context menu — top right, hover only */}
        {showActions && (
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button
              onClick={() => onDuplicate(frame.id)}
              className="w-6 h-6 rounded flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.85)', color: 'var(--at-text-secondary)' }}
              title="复制"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDelete(frame.id)}
              className="w-6 h-6 rounded flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.85)', color: 'var(--at-error)' }}
              title="删除"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col gap-2 px-3 py-2.5">

        {/* Title + duration */}
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="flex-1 text-[13px] font-semibold leading-snug line-clamp-1 ink-display" style={{ color: 'var(--at-text)' }}>
            {frame.title}
          </h3>
          {frame.duration_seconds !== undefined && (
            <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--at-text-tertiary)' }}>
              {frame.duration_seconds}s
            </span>
          )}
        </div>

        {/* Entity line — plain text, no pills */}
        {entityLine && (
          <p className="text-[11px] leading-snug" style={{ color: 'var(--at-text-tertiary)' }}>
            {entityLine}
          </p>
        )}

        {/* Dialogues */}
        {frame.dialogues && frame.dialogues.length > 0 && (
          <div className="space-y-0.5">
            {frame.dialogues.slice(0, 2).map((d, i) => (
              <p key={i} className="text-[11px] leading-snug line-clamp-1 ink-body" style={{ color: 'var(--at-text-secondary)' }}>
                {d.speaker && <span className="font-medium" style={{ color: 'var(--at-text)' }}>{d.speaker}：</span>}
                {d.text}
              </p>
            ))}
            {frame.dialogues.length > 2 && (
              <p className="text-[10px]" style={{ color: 'var(--at-text-tertiary)' }}>+{frame.dialogues.length - 2}</p>
            )}
          </div>
        )}

        {/* Camera params — ghost selects in 2×2 */}
        {(hasCamera || true) && (
          <div
            className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5"
            style={{ borderTop: '1px solid var(--at-border-light)' }}
          >
            <GhostSelect value={frame.shot_size || ''} options={SHOT_SIZE_OPTIONS} onChange={(v) => set('shot_size', v)} placeholder="景别" />
            <GhostSelect value={frame.camera_angle || ''} options={CAMERA_ANGLE_OPTIONS} onChange={(v) => set('camera_angle', v)} placeholder="机位" />
            <GhostSelect value={frame.camera_movement || ''} options={CAMERA_MOVEMENT_OPTIONS} onChange={(v) => set('camera_movement', v)} placeholder="运镜" />
            <GhostSelect value={frame.focal_length || ''} options={FOCAL_LENGTH_OPTIONS} onChange={(v) => set('focal_length', v)} placeholder="焦距" />
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] transition-colors self-start mt-0.5"
          style={{ color: 'var(--at-text-tertiary)', letterSpacing: '0.05em' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--at-text-secondary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--at-text-tertiary)'; }}
        >
          {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          {expanded ? '收起' : '更多'}
        </button>

        {/* Expanded section */}
        {expanded && (
          <div className="space-y-3 pt-2" style={{ borderTop: '1px solid var(--at-border-light)' }}>

            {/* Style */}
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--at-text-tertiary)' }}>画风</p>
              <GhostSelect value={frame.style || ''} options={STYLE_OPTIONS} onChange={(v) => set('style', v)} placeholder="选择画风" />
            </div>

            {/* Scene description */}
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--at-text-tertiary)' }}>画面描述</p>
              <InlineEdit
                value={frame.scene_description || ''}
                onChange={(v) => set('scene_description', v)}
                placeholder="双击编辑"
                multiline
                className="text-[11px] leading-relaxed jp-serif"
              />
            </div>

            {/* Director notes */}
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--at-text-tertiary)' }}>导演提示</p>
              <InlineEdit
                value={frame.director_notes || ''}
                onChange={(v) => set('director_notes', v)}
                placeholder="双击编辑"
                multiline
                className="text-[11px] leading-relaxed jp-serif"
              />
            </div>

            {/* Audio */}
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--at-text-tertiary)' }}>音频</p>
              <InlineEdit
                value={frame.audio_description || ''}
                onChange={(v) => set('audio_description', v)}
                placeholder="双击编辑"
                className="text-[11px] leading-relaxed jp-serif"
              />
            </div>

            {/* Reference images */}
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--at-text-tertiary)' }}>参考图片</p>
              <div
                className={cn(
                  "flex flex-wrap gap-1.5 p-2 rounded-lg transition-all",
                  draggingOverRef
                    ? "bg-[var(--at-accent-light)] outline outline-1 outline-[var(--at-accent)]"
                    : "bg-[var(--at-surface-sunken)]"
                )}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingOverRef(true); }}
                onDragLeave={(e) => { e.stopPropagation(); setDraggingOverRef(false); }}
                onDrop={handleRefDrop}
              >
                {(frame.referenceImages || []).map((url, i) => {
                  const tags = assetTagsMap.get(url);
                  return (
                    <div key={i} className="relative group/ref">
                      <Image src={url} alt="" width={56} height={56} className="object-cover rounded w-14 h-14" unoptimized />
                      <button
                        onClick={() => removeRef(i)}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover/ref:opacity-100 transition-opacity"
                        style={{ background: 'var(--at-error)', color: 'white' }}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                      {tags && (tags.characters.length > 0 || tags.locations.length > 0) && (
                        <div className="absolute bottom-0 left-0 right-0">
                          <div className="text-[8px] px-0.5 py-px truncate text-center" style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}>
                            {[...tags.characters, ...tags.locations].join('·')}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <label className="cursor-pointer w-14 h-14 rounded flex items-center justify-center transition-colors" style={{ border: '1px dashed var(--at-border)', color: 'var(--at-text-tertiary)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--at-accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--at-accent)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--at-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--at-text-tertiary)'; }}
                >
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  <Upload className="w-3.5 h-3.5" />
                </label>
              </div>
              <p className="text-[9px] mt-1" style={{ color: 'var(--at-text-tertiary)' }}>可从资产库拖拽到此处</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Drag handle (hover only, bottom-right) ── */}
      <div
        {...attributes}
        {...listeners}
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
        style={{ color: 'var(--at-text-tertiary)' }}
        aria-label="拖拽排序"
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="2" cy="2" r="1.2" /><circle cx="2" cy="7" r="1.2" /><circle cx="2" cy="12" r="1.2" />
          <circle cx="8" cy="2" r="1.2" /><circle cx="8" cy="7" r="1.2" /><circle cx="8" cy="12" r="1.2" />
        </svg>
      </div>

      {/* ── Insert after (hover, right edge) ── */}
      {onInsertAfter && (
        <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onInsertAfter(frame.id)}
            className="w-6 h-10 rounded-full flex items-center justify-center text-sm transition-all"
            style={{
              background: 'var(--at-surface)',
              border: '1px solid var(--at-border)',
              color: 'var(--at-text-tertiary)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--at-accent)';
              (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'white';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--at-surface)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--at-border)';
              (e.currentTarget as HTMLElement).style.color = 'var(--at-text-tertiary)';
            }}
            aria-label="在此后插入"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
