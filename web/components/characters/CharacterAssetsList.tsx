/**
 * Character Assets List - Display generated and uploaded character images
 */
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { Loader2, Download, Trash2, Copy, Filter, Upload, Plus, X, ChevronDown, ChevronUp, Edit } from "lucide-react";
import { api } from "@/lib/api/client";
import type { CharacterImageAsset } from "@/lib/models";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/Toast";
import {
  getProjectCharacterAssets,
  deleteProjectCharacterAsset,
  updateProjectCharacterAsset,
  setProjectCharacterAssets,
} from "@/lib/storage/local";
import { cn } from "@/lib/utils";

interface CharacterAssetsListProps {
  projectId: string;
  refreshTrigger?: number;
  filterCharacterIds?: string[]; // If provided, only show these characters
  onCountChange?: (count: number) => void; // Callback to report total character count
  highlightId?: string | null; // Character ID to highlight and scroll to
  onDeleteCharacter?: (characterId: string) => void; // Callback when character is deleted
  onRenameCharacter?: (characterId: string, newName: string) => void; // Callback when character is renamed
  onSelectCharacter?: (characterId: string) => void; // Callback when character card is clicked
}

export function CharacterAssetsList({
  projectId,
  refreshTrigger,
  filterCharacterIds,
  onCountChange,
  highlightId,
  onDeleteCharacter,
  onRenameCharacter,
  onSelectCharacter,
}: CharacterAssetsListProps) {
  const [assets, setAssets] = useState<CharacterImageAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "upload" | "generated" | "reference"
  >("all");
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { showToast } = useToast();
  
  const checkAndLoadAssets = useCallback(async () => {
    if (!projectId) return;

    try {
      // Load from API (remote is source of truth)
      const res = await api<{ dataV2?: CharacterImageAsset[] }>(
        `/api/projects/${projectId}/characters/assets`
      );

      const remoteAssets = res.dataV2 || [];
      
      // Online: Use remote as source of truth and update local cache
      setAssets(remoteAssets);
      setProjectCharacterAssets(projectId, remoteAssets);
      console.log(`[Online] Loaded ${remoteAssets.length} assets from remote and synced to local cache`);
    } catch (err) {
      console.error("Failed to load character assets from remote:", err);
      // Offline: Fallback to local cache only
      const localAssets = getProjectCharacterAssets(projectId);
      setAssets(localAssets);
      console.log(`[Offline] Loaded ${localAssets.length} assets from local cache`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    checkAndLoadAssets();
  }, [projectId, refreshTrigger, checkAndLoadAssets]);

  // Apply character ID filter and source filter using useMemo
  const filteredAssets = useMemo(() => {
    let filtered = assets;
    
    // Apply character ID filter
    // If filterCharacterIds is provided (even if empty), only show those characters
    if (filterCharacterIds !== undefined) {
      filtered = filtered.filter((asset) =>
        filterCharacterIds.includes(asset.id)
      );
    }
    
    // Apply source filter
    if (sourceFilter !== "all") {
      // Only keep characters that have at least one image matching the filter
      filtered = filtered
        .filter((asset) => 
          asset.images.some((img) => img.source === sourceFilter)
        )
        .map((asset) => ({
          ...asset,
          images: asset.images.filter((img) => img.source === sourceFilter),
        }));
    }
    
    return filtered;
  }, [assets, filterCharacterIds, sourceFilter]);

  // Report total character count to parent (after filtering)
  useEffect(() => {
    if (onCountChange) {
      onCountChange(filteredAssets.length);
    }
  }, [filteredAssets.length, onCountChange]);

  // Scroll to and highlight the selected character
  useEffect(() => {
    if (highlightId) {
      const element = document.getElementById(`asset-card-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightId]);

  const handleDelete = async (assetId: string) => {
    if (window.confirm("确定要删除这个资产吗？")) {
      try {
        // First delete from backend
        await api(`/api/projects/${projectId}/characters/assets/${assetId}`, {
          method: 'DELETE',
        });
        
        // Only update local and UI after backend success
        deleteProjectCharacterAsset(projectId, assetId);
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
        showToast("资产已删除", "success");
        
        // Notify parent to remove from relation graph
        if (onDeleteCharacter) {
          onDeleteCharacter(assetId);
        }
      } catch (err) {
        console.error('Failed to delete from backend:', err);
        showToast("删除失败，请稍后重试", "error");
      }
    }
  };

  const handleRenameCharacterName = async (assetId: string, currentName: string) => {
    const newName = prompt("请输入新的角色名称：", currentName);
    if (newName === null || newName.trim() === "" || newName.trim() === currentName) return;
    
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    try {
      // First update backend
      await api(`/api/projects/${projectId}/characters/assets/${assetId}`, {
        method: "PUT",
        body: {
          name: newName.trim(),
          description: asset.description,
          alias: asset.alias,
          images: asset.images,
        },
      });

      // Only update local and UI after backend success
      const updatedAsset = {
        ...asset,
        characterName: newName.trim(),
      };

      updateProjectCharacterAsset(projectId, updatedAsset);
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? updatedAsset : a))
      );
      
      showToast("角色名已更新", "success");
      
      // Notify parent to update relation graph
      if (onRenameCharacter) {
        onRenameCharacter(assetId, newName.trim());
      }
    } catch (err) {
      console.error("Failed to update name on backend:", err);
      showToast("更新失败，请稍后重试", "error");
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast("图片链接已复制", "success");
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleEditAlias = async (assetId: string, currentAlias?: string) => {
    const newAlias = prompt("请输入角色别称：", currentAlias || "");
    if (newAlias === null) return; // User cancelled
    
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    try {
      // First update backend
      await api(`/api/projects/${projectId}/characters/assets/${assetId}`, {
        method: "PUT",
        body: {
          name: asset.characterName,
          description: asset.description,
          alias: newAlias.trim() || undefined,
          images: asset.images,
        },
      });

      // Only update local and UI after backend success
      const updatedAsset = {
        ...asset,
        alias: newAlias.trim() || undefined,
      };

      updateProjectCharacterAsset(projectId, updatedAsset);
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? updatedAsset : a))
      );
      
      showToast("别称已更新", "success");
    } catch (err) {
      console.error("Failed to update alias on backend:", err);
      showToast("更新失败，请稍后重试", "error");
    }
  };

  const handleEditDescription = async (assetId: string, currentDescription?: string) => {
    const newDescription = prompt("请输入角色描述：", currentDescription || "");
    if (newDescription === null) return; // User cancelled
    
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    try {
      // First update backend
      await api(`/api/projects/${projectId}/characters/assets/${assetId}`, {
        method: "PUT",
        body: {
          name: asset.characterName,
          description: newDescription.trim() || undefined,
          alias: asset.alias,
          images: asset.images,
        },
      });

      // Only update local and UI after backend success
      const updatedAsset = {
        ...asset,
        description: newDescription.trim() || undefined,
      };

      updateProjectCharacterAsset(projectId, updatedAsset);
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? updatedAsset : a))
      );
      
      showToast("描述已更新", "success");
    } catch (err) {
      console.error("Failed to update description on backend:", err);
      showToast("更新失败，请稍后重试", "error");
    }
  };

  const handleDeleteImage = async (assetId: string, imageId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const updatedImages = asset.images.filter((img) => img.id !== imageId);
    
    if (updatedImages.length === 0) {
      // If no images left, delete the entire asset
      handleDelete(assetId);
      return;
    }

    const updatedAsset = { ...asset, images: updatedImages };
    
    // Update local storage
    updateProjectCharacterAsset(projectId, updatedAsset);
    
    // Update state
    setAssets((prev) => prev.map((a) => (a.id === assetId ? updatedAsset : a)));
    
    showToast("图片已删除", "success");

    // Try to update backend
    try {
      await api(`/api/projects/${projectId}/characters/assets/${assetId}`, {
        method: 'PUT',
        body: updatedAsset,
      });
    } catch (err) {
      console.error('Failed to update asset on backend:', err);
    }
  };

  const handleAddImages = async (assetId: string, files: FileList) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const newImages = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      const result = await new Promise<string>((resolve) => {
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve(e.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      });

      newImages.push({
        id: `img_${Date.now()}_${i}`,
        url: result,
        source: 'upload' as const,
        createdAt: new Date().toISOString(),
      });
    }

    const updatedAsset = {
      ...asset,
      images: [...asset.images, ...newImages],
    };

    // Update local storage
    updateProjectCharacterAsset(projectId, updatedAsset);
    
    // Update state
    setAssets((prev) => prev.map((a) => (a.id === assetId ? updatedAsset : a)));
    
    showToast(`已添加 ${newImages.length} 张图片`, "success");

    // Try to update backend
    try {
      await api(`/api/projects/${projectId}/characters/assets/${assetId}`, {
        method: 'PUT',
        body: updatedAsset,
      });
    } catch (err) {
      console.error('Failed to update asset on backend:', err);
    }
  };

  const toggleExpanded = (assetId: string) => {
    setExpandedAssets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
      <div className="space-y-4">
        {/* Filter */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
        <Filter className="w-4 h-4 text-slate-500" />
        <div className="flex gap-1">
          {(["all", "generated", "upload", "reference"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSourceFilter(filter)}
              className={cn(
                "px-3 py-1 text-xs rounded-full transition-colors",
                sourceFilter === filter
                  ? "bg-[var(--brand-500)] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {filter === "all"
                ? "全部"
                : filter === "generated"
                ? "生成"
                : filter === "upload"
                ? "上传"
                : "参考"}
            </button>
          ))}
        </div>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="ink-empty-state" style={{ padding: '32px 0' }}>
          <p className="ink-empty-state-title">暂无角色</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-3 pr-4">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                id={`asset-card-${asset.id}`}
                onClick={() => onSelectCharacter?.(asset.id)}
                className={cn(
                  "p-3 ink-card ink-card-interactive",
                  highlightId === asset.id
                    ? "border-[var(--persimmon)] shadow-md"
                    : ""
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 
                      className="font-semibold text-sm ink-display cursor-pointer hover:text-[var(--persimmon)] transition-colors"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleRenameCharacterName(asset.id, asset.characterName);
                      }}
                      title="双击可改名"
                    >
                      {asset.characterName}
                    </h3>
                    {asset.alias && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        别称：{asset.alias}
                      </p>
                    )}
                    {asset.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {asset.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-xs text-slate-400">
                      {new Date(asset.createdAt).toLocaleDateString("zh-CN", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAlias(asset.id, asset.alias);
                      }}
                      className="p-1 text-slate-400 hover:text-[var(--brand-500)] transition-colors"
                      title="编辑别称"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditDescription(asset.id, asset.description);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                      title="编辑描述"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id);
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Image grid */}
                {asset.images.length > 0 ? (
                  <>
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                      }}
                    >
                      {(expandedAssets.has(asset.id) ? asset.images : asset.images.slice(0, 4)).map((img) => (
                        <div key={img.id} className="space-y-1">
                          <div className="relative group bg-slate-100 rounded border border-slate-200 overflow-hidden aspect-square">
                            <Image
                              src={img.url}
                              alt={asset.characterName}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 33vw, 120px"
                              unoptimized
                            />
                            {/* Source badge */}
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] bg-black/60 text-white rounded">
                              {img.source === "generated"
                                ? "生成"
                                : img.source === "upload"
                                ? "上传"
                                : "参考"}
                            </span>
                            {/* Delete button - visible on hover */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteImage(asset.id, img.id);
                              }}
                              className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="删除图片"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(
                                  img.url,
                                  `${asset.characterName}_${img.id}.png`
                                );
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                              title="下载"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyUrl(img.url);
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                              title="复制链接"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Expand/Collapse and Add button */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
                      {asset.images.length > 4 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(asset.id);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        >
                          {expandedAssets.has(asset.id) ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              收起
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              显示全部 ({asset.images.length})
                            </>
                          )}
                        </button>
                      )}
                      <input
                        ref={(el) => { fileInputRefs.current[asset.id] = el; }}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleAddImages(asset.id, e.target.files);
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRefs.current[asset.id]?.click();
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--brand-600)] hover:text-[var(--brand-700)] hover:bg-[var(--brand-50)] rounded transition-colors ml-auto"
                      >
                        <Plus className="w-3 h-3" />
                        添加图片
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-col items-center justify-center h-32 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border-2 border-dashed border-slate-300">
                      <Upload className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400">暂无图片</p>
                      <p className="text-xs text-slate-300 mt-1">点击下方按钮上传</p>
                    </div>
                    <input
                      ref={(el) => { fileInputRefs.current[asset.id] = el; }}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleAddImages(asset.id, e.target.files);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRefs.current[asset.id]?.click();
                      }}
                      className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-white bg-[var(--brand-500)] hover:bg-[var(--brand-600)] rounded-lg transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      上传图片
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
      </div>
  );
}
