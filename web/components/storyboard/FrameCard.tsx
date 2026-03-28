/**
 * FrameCard - Single storyboard frame with image, hover tools, and drag support
 */
"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Sparkles, Copy, Trash2, ChevronDown, ChevronUp, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FrameData } from "@/lib/types/storyboard";
import { api } from "@/lib/api/client";

// 下拉选择选项常量
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

interface DropdownSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function DropdownSelect({ value, options, onChange, placeholder = "选择", className }: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-2 py-1 text-xs border rounded flex items-center justify-between gap-1 hover:bg-slate-50 transition-colors",
          value ? "text-slate-800 border-slate-300" : "text-slate-400 border-slate-200",
          className
        )}
      >
        <span className="truncate flex-1 text-left">{value || placeholder}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-full max-h-40 overflow-y-auto bg-white border border-slate-200 rounded shadow-lg z-20">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-2 py-1.5 text-xs text-left hover:bg-slate-100 transition-colors",
                  value === option && "bg-slate-50 font-medium"
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}

function EditableText({ value, onChange, placeholder = "双击编辑", className, multiline = true }: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  
  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };
  
  if (isEditing) {
    return multiline ? (
      <textarea
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            handleCancel();
          }
        }}
        autoFocus
        rows={3}
        className={cn(
          "w-full px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none jp-serif",
          className
        )}
      />
    ) : (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSave();
          } else if (e.key === 'Escape') {
            handleCancel();
          }
        }}
        autoFocus
        className={cn(
          "w-full px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 jp-serif",
          className
        )}
      />
    );
  }
  
  return (
    <div
      onDoubleClick={() => setIsEditing(true)}
      className={cn(
        "cursor-pointer hover:bg-slate-50 px-2 py-1 rounded transition-colors jp-serif",
        !value && "text-slate-400 italic",
        className
      )}
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
  const [showMenu, setShowMenu] = useState(false);
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverRef, setIsDraggingOverRef] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: frame.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Build a memoized map of imageUrl -> { characters, locations }
  const assetTagsMap = useMemo(() => {
    const map = new Map<string, { characters: string[]; locations: string[] }>();
    if (!assets) return map;

    // For each character asset
    assets.characters.forEach((char) => {
      char.images.forEach((img) => {
        const existing = map.get(img.url) || { characters: [], locations: [] };
        existing.characters.push(char.name);
        map.set(img.url, existing);
      });
    });

    // For each location asset
    assets.locations.forEach((loc) => {
      loc.images.forEach((img) => {
        const existing = map.get(img.url) || { characters: [], locations: [] };
        existing.locations.push(loc.name);
        map.set(img.url, existing);
      });
    });

    return map;
  }, [assets]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    const imageUrl = e.dataTransfer.getData("image/url");
    if (imageUrl && onImageDrop) {
      onImageDrop(frame.id, imageUrl);
    }
  };

  const handleFieldChange = (field: keyof FrameData, value: unknown) => {
    if (onChange) {
      onChange(frame.id, { [field]: value });
    }
  };

  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      const currentImages = frame.referenceImages || [];
      const currentPaths = frame.referencePaths || [];
      
      // 立即显示预览（使用 base64）
      if (onChange) {
        onChange(frame.id, {
          referenceImages: [...currentImages, base64Data],
          referencePaths: [...currentPaths, ''], // 临时占位
        });
      }
      
      // 如果有 projectId，后台上传到 Supabase
      if (projectId) {
        try {
          const result = await api<{ url: string; path: string }>(
            `/api/projects/${projectId}/uploads/image-v2`,
            {
              method: 'POST',
              body: { base64Data },
            }
          );
          const imageUrl = result.url;
          const imagePath = result.path;
          console.log('[FrameCard] Upload successful:', { imageUrl, imagePath });
          
          // 替换为真实 URL
          const updatedImages = [...currentImages, base64Data];
          const updatedPaths = [...currentPaths, ''];
          const lastIndex = updatedImages.length - 1;
          updatedImages[lastIndex] = imageUrl;
          updatedPaths[lastIndex] = imagePath;
          
          if (onChange) {
            onChange(frame.id, {
              referenceImages: updatedImages,
              referencePaths: updatedPaths,
            });
          }
          console.log('[FrameCard] Replaced with real URL');
        } catch (error) {
          console.error('Failed to upload reference image:', error);
          console.warn('[FrameCard] Using base64 preview only (upload failed)');
        }
      }
    };
    
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveReferenceImage = (index: number) => {
    const currentImages = frame.referenceImages || [];
    const currentPaths = frame.referencePaths || [];
    
    // Update both fields at once
    if (onChange) {
      onChange(frame.id, {
        referenceImages: currentImages.filter((_, i) => i !== index),
        referencePaths: currentPaths.filter((_, i) => i !== index),
      });
    }
  };

  const handleRefDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverRef(true);
  };

  const handleRefDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDraggingOverRef(false);
  };

  const handleRefDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverRef(false);
    
    const imageUrl = e.dataTransfer.getData("image/url");
    const imagePath = e.dataTransfer.getData("image/path");
    
    if (imageUrl && onChange) {
      const currentImages = frame.referenceImages || [];
      const currentPaths = frame.referencePaths || [];
      
      // Check if already exists
      if (currentImages.includes(imageUrl)) {
        return;
      }
      
      // Append to reference images with path (if available)
      onChange(frame.id, {
        referenceImages: [...currentImages, imageUrl],
        referencePaths: [...currentPaths, imagePath || ''],
      });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative ink-card overflow-hidden transition-all duration-200",
        isDraggingOver
          ? "border-[var(--persimmon)] shadow-lg"
          : "ink-card-interactive"
      )}
    >
      {/* Order Badge */}
      <div
        className="absolute top-2 left-2 z-10 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
        style={{ background: 'var(--persimmon)', color: 'white' }}
      >
        {frame.order}
      </div>

      {/* Scene Type Badge */}
      {frame.sceneType && (
        <div
          className="absolute top-2 right-2 z-10 ink-chip text-[10px] font-bold"
          style={{
            background: frame.sceneType === 'INT.'
              ? 'rgba(100, 140, 80, 0.15)'
              : 'rgba(180, 120, 80, 0.15)',
            color: frame.sceneType === 'INT.'
              ? 'var(--bamboo)'
              : 'var(--clay)',
          }}
        >
          {frame.sceneType}
        </div>
      )}

      {/* Image Area */}
      <div
        className="relative aspect-[16/10] overflow-hidden"
        style={{ background: 'var(--rice-warm)' }}
        onMouseEnter={() => setIsHoveringImage(true)}
        onMouseLeave={() => setIsHoveringImage(false)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {frame.image ? (
          <Image
            src={frame.image.url}
            alt={frame.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 480px"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--ink-light)', opacity: 0.3 }}>
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Hover Overlay with Tools */}
        {isHoveringImage && (
          <div className="absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center">
            <button
              onClick={() => onGenerate(frame.id)}
              className="px-4 py-2 bg-gradient-to-r from-orange-400 to-pink-500 text-white rounded-lg hover:shadow-lg transition-all duration-200 flex items-center gap-2 font-medium"
              aria-label="生成图片"
            >
              <Sparkles className="w-4 h-4" />
              Generate
            </button>
          </div>
        )}

        {/* Top-right: More Menu */}
        <div className="absolute top-2 right-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded transition-colors"
            aria-label="更多选项"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
              <button
                onClick={() => {
                  onDuplicate(frame.id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" />
                复制
              </button>
              <button
                onClick={() => {
                  onDelete(frame.id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-3 space-y-2">
        {/* Title Row with Duration */}
        <div className="flex items-baseline gap-2">
          <h3
            className="flex-1 text-sm font-semibold line-clamp-1 ink-display"
            title={frame.title}
          >
            {frame.title}
          </h3>
          {frame.duration_seconds !== undefined && (
            <span className="text-xs" style={{ color: 'var(--ink-light)' }}>
              {frame.duration_seconds}s
            </span>
          )}
          {frame.timeOfDay && (
            <span className="text-xs" style={{ color: 'var(--ink-light)' }}>{frame.timeOfDay}</span>
          )}
        </div>

        {/* Characters, Locations, Dialogues - Compact display */}
        {(frame.characters?.length || frame.locations?.length || frame.dialogues?.length) ? (
          <div className="space-y-1 text-xs border-t border-[rgba(26,26,24,0.06)] pt-2">
            {frame.characters && frame.characters.length > 0 && (
              <div className="flex gap-1 items-center">
                <span className="font-medium shrink-0" style={{ color: 'var(--ink-light)' }}>角色:</span>
                <div className="flex flex-wrap gap-1">
                  {frame.characters.slice(0, 3).map((char, idx) => (
                    <span key={idx} className="ink-chip" style={{ fontSize: '10px', padding: '1px 6px' }}>
                      {char}
                    </span>
                  ))}
                  {frame.characters.length > 3 && (
                    <span style={{ color: 'var(--ink-light)' }}>+{frame.characters.length - 3}</span>
                  )}
                </div>
              </div>
            )}
            {frame.locations && frame.locations.length > 0 && (
              <div className="flex gap-1 items-center">
                <span className="font-medium shrink-0" style={{ color: 'var(--ink-light)' }}>地点:</span>
                <div className="flex flex-wrap gap-1">
                  {frame.locations.slice(0, 2).map((loc, idx) => (
                    <span key={idx} className="ink-chip" style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(100,140,80,0.1)', color: 'var(--bamboo)' }}>
                      {loc}
                    </span>
                  ))}
                  {frame.locations.length > 2 && (
                    <span style={{ color: 'var(--ink-light)' }}>+{frame.locations.length - 2}</span>
                  )}
                </div>
              </div>
            )}
            {frame.dialogues && frame.dialogues.length > 0 && (
              <div className="flex gap-1 items-start">
                <span className="font-medium shrink-0" style={{ color: 'var(--ink-light)' }}>对白:</span>
                <div className="flex-1 space-y-0.5">
                  {frame.dialogues.slice(0, 2).map((dialogue, idx) => (
                    <div key={idx} className="ink-body" style={{ color: 'var(--ink-wash)' }}>
                      {dialogue.speaker && (
                        <span className="font-medium" style={{ color: 'var(--ink-black)' }}>{dialogue.speaker}: </span>
                      )}
                      <span className="line-clamp-1">{dialogue.text}</span>
                    </div>
                  ))}
                  {frame.dialogues.length > 2 && (
                    <span className="text-slate-400">+{frame.dialogues.length - 2} 条对白</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Core Info - Dropdowns in 2x2 grid */}
        <div className="grid grid-cols-2 gap-2">
          <DropdownSelect
            value={frame.shot_size || ""}
            options={SHOT_SIZE_OPTIONS}
            onChange={(value) => handleFieldChange('shot_size', value)}
            placeholder="景别"
          />
          <DropdownSelect
            value={frame.camera_angle || ""}
            options={CAMERA_ANGLE_OPTIONS}
            onChange={(value) => handleFieldChange('camera_angle', value)}
            placeholder="机位角度"
          />
          <DropdownSelect
            value={frame.camera_movement || ""}
            options={CAMERA_MOVEMENT_OPTIONS}
            onChange={(value) => handleFieldChange('camera_movement', value)}
            placeholder="运镜方式"
          />
          <DropdownSelect
            value={frame.focal_length || ""}
            options={FOCAL_LENGTH_OPTIONS}
            onChange={(value) => handleFieldChange('focal_length', value)}
            placeholder="焦距"
          />
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-700 py-1 hover:bg-slate-50 rounded transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              收起详情
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              展开详情
            </>
          )}
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {/* Scene Description */}
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">画面描述</label>
              <EditableText
                value={frame.scene_description || ""}
                onChange={(value) => handleFieldChange('scene_description', value)}
                placeholder="双击编辑画面描述"
                className="text-xs text-slate-700"
              />
            </div>

            {/* Director Notes */}
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">导演提示</label>
              <EditableText
                value={frame.director_notes || ""}
                onChange={(value) => handleFieldChange('director_notes', value)}
                placeholder="双击编辑导演提示"
                className="text-xs text-slate-700"
              />
            </div>

            {/* Audio Description */}
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">音频描述</label>
              <EditableText
                value={frame.audio_description || ""}
                onChange={(value) => handleFieldChange('audio_description', value)}
                placeholder="双击编辑音频描述"
                className="text-xs text-slate-700"
              />
            </div>

            {/* Style Selection */}
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">画风</label>
              <DropdownSelect
                value={frame.style || "线稿风"}
                options={STYLE_OPTIONS}
                onChange={(value) => handleFieldChange('style', value)}
                placeholder="选择画风"
              />
            </div>

            {/* Reference Images */}
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">参考图片</label>
              <div 
                className={cn(
                  "flex flex-wrap gap-2 items-center p-2 rounded border-2 transition-colors",
                  isDraggingOverRef 
                    ? "border-[var(--brand-500)] bg-[var(--brand-50)]" 
                    : "border-transparent"
                )}
                onDragOver={handleRefDragOver}
                onDragLeave={handleRefDragLeave}
                onDrop={handleRefDrop}
              >
                {frame.referenceImages && frame.referenceImages.length > 0 && (
                  frame.referenceImages.map((imgUrl, idx) => {
                    const tags = assetTagsMap.get(imgUrl);
                    return (
                      <div key={idx} className="relative group/img">
                        <Image
                          src={imgUrl}
                          alt={`参考图 ${idx + 1}`}
                          width={80}
                          height={80}
                          className="object-cover rounded border border-slate-200 w-20 h-20"
                          unoptimized
                        />
                        <button
                          onClick={() => handleRemoveReferenceImage(idx)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                          aria-label="删除图片"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {tags && (tags.characters.length > 0 || tags.locations.length > 0) && (
                          <div className="absolute -bottom-1 left-0 right-0 flex flex-col gap-0.5 px-1">
                            {tags.characters.length > 0 && (
                              <div className="text-[9px] bg-blue-500 text-white px-1 py-0.5 rounded truncate">
                                角色: {tags.characters.join(', ')}
                              </div>
                            )}
                            {tags.locations.length > 0 && (
                              <div className="text-[9px] bg-green-500 text-white px-1 py-0.5 rounded truncate">
                                地点: {tags.locations.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceImageUpload}
                    className="hidden"
                  />
                  <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded flex items-center justify-center hover:border-slate-400 hover:bg-slate-50 transition-colors">
                    <Upload className="w-5 h-5 text-slate-400" />
                  </div>
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-1">可从右侧资产库拖拽图片到此处</p>
            </div>
          </div>
        )}

        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 transition-opacity"
          aria-label="拖拽排序"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="4" r="1.5" />
            <circle cx="4" cy="8" r="1.5" />
            <circle cx="4" cy="12" r="1.5" />
            <circle cx="12" cy="4" r="1.5" />
            <circle cx="12" cy="8" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
          </svg>
        </div>
      </div>

      {/* Insert After Button (hover only) */}
      {onInsertAfter && (
        <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10">
          <button
            onClick={() => onInsertAfter(frame.id)}
            className="opacity-0 group-hover:opacity-100 w-6 h-16 rounded-full bg-slate-300 hover:bg-[var(--brand-500)] hover:text-white text-slate-600 flex items-center justify-center shadow-md transition-all duration-200 text-lg font-bold"
            aria-label="在此后插入"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
