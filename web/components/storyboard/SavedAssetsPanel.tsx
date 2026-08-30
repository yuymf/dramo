/**
 * SavedAssetsPanel - Right sidebar for managing and browsing assets
 */
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Upload, ChevronRight, Loader2 } from "lucide-react";
import { getProjectAssets } from "@/lib/utils/exporter";
import { useToast } from "@/components/ui/Toast";
import type { ImageItem } from "@/lib/models";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";

interface SavedAssetsPanelProps {
  projectId: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

type TabType = "all" | "characters" | "locations";

export function SavedAssetsPanel({
  projectId,
  collapsed = false,
  onToggleCollapse,
}: SavedAssetsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<
    Array<{
      id: string;
      name: string;
      description?: string;
      images: ImageItem[];
    }>
  >([]);
  const [locations, setLocations] = useState<
    Array<{
      id: string;
      name: string;
      description?: string;
      images: ImageItem[];
    }>
  >([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Load assets
  useEffect(() => {
    async function loadAssets() {
      try {
        const data = await getProjectAssets(projectId);
        setCharacters(data.characters);
        setLocations(data.locations);
      } catch (err) {
        console.error("Failed to load assets:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAssets();
  }, [projectId]);

  // Handle asset upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const images: ImageItem[] = [];
    let loaded = 0;

    // 先加载所有文件到内存
    const loadPromises = Array.from(files).map((file) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            images.push({
              id: `img_${Date.now()}_${loaded}`,
              url: event.target.result as string,
              source: "upload",
              createdAt: new Date().toISOString(),
            });
            loaded++;
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });

    await Promise.all(loadPromises);

    // 所有文件加载完成，上传到后端
    const uploadName = `上传 ${new Date().toLocaleTimeString()}`;
    const isLocation = activeTab === "locations";

    try {
      // 调用后端 API 创建资产（通过 Next.js API Routes 代理，认证由 Cookie 处理）
      const apiPath = isLocation
        ? `/api/projects/${projectId}/locations/assets`
        : `/api/projects/${projectId}/characters/assets`;

      const result = await api<{
        id: string;
        name: string;
        description?: string;
        images?: ImageItem[];
      }>(apiPath, {
        method: 'POST',
        body: {
          name: uploadName,
          description: "",
          images,
        },
      });

      // 更新本地状态（使用后端返回的数据）
      const newAsset = {
        id: result.id,
        name: result.name,
        description: result.description || "",
        images: result.images || images,
      };

      if (isLocation) {
        setLocations((prev) => [...prev, newAsset]);
      } else {
        setCharacters((prev) => [...prev, newAsset]);
      }

      showToast(`已上传 ${images.length} 张图片到云端`, "success");
    } catch (error) {
      console.error("上传到云端失败:", error);
      showToast("上传失败，请稍后重试", "error");
    }

    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, image: { url: string; path?: string }) => {
    e.dataTransfer.setData("image/url", image.url);
    if (image.path) {
      e.dataTransfer.setData("image/path", image.path);
    }
    e.dataTransfer.effectAllowed = "copy";
  };

  // Filter assets by tab
  const displayAssets = (() => {
    if (activeTab === "characters") return characters;
    if (activeTab === "locations") return locations;
    return [...characters, ...locations];
  })();

  if (collapsed) {
    return (
      <div className="w-12 bg-white border-l border-slate-200 flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-slate-100 rounded transition-colors"
          aria-label="展开资产面板"
        >
          <ChevronRight className="w-5 h-5 text-slate-600 rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold jp-serif">已存资产</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
          aria-label="收起面板"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "flex-1 px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "all"
              ? "text-[var(--brand-600)] border-b-2 border-[var(--brand-600)]"
              : "text-slate-600 hover:text-slate-800"
          )}
        >
          全部
        </button>
        <button
          onClick={() => setActiveTab("characters")}
          className={cn(
            "flex-1 px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "characters"
              ? "text-[var(--brand-600)] border-b-2 border-[var(--brand-600)]"
              : "text-slate-600 hover:text-slate-800"
          )}
        >
          角色
        </button>
        <button
          onClick={() => setActiveTab("locations")}
          className={cn(
            "flex-1 px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "locations"
              ? "text-[var(--brand-600)] border-b-2 border-[var(--brand-600)]"
              : "text-slate-600 hover:text-slate-800"
          )}
        >
          地点
        </button>
      </div>

      {/* Upload Area */}
      <div className="p-4 border-b border-slate-200">
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <button
          onClick={() => uploadInputRef.current?.click()}
          className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)] transition-colors flex items-center justify-center gap-2 text-sm font-medium text-slate-600"
        >
          <Upload className="w-4 h-4" />
          上传图片
        </button>
        <p className="text-xs text-slate-500 mt-2 text-center">
          拖拽图片到分镜卡片
        </p>
      </div>

      {/* Assets List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : displayAssets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-400 mb-2">暂无资产</p>
            <p className="text-xs text-slate-500">上传图片或生成资产</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayAssets.map((asset) => (
              <div
                key={asset.id}
                className="border border-slate-200 rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow"
              >
                <div className="p-2 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-xs font-semibold text-slate-700 line-clamp-1">
                    {asset.name}
                  </h3>
                  {asset.description && (
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {asset.description}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 p-1">
                  {asset.images.slice(0, 4).map((img) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, img)}
                      className="relative aspect-square cursor-move hover:opacity-80 transition-opacity group"
                    >
                      <Image
                        src={img.url}
                        alt={asset.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 120px"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded" />
                    </div>
                  ))}
                </div>
                {asset.images.length > 4 && (
                  <div className="px-2 pb-2">
                    <p className="text-xs text-slate-400">
                      +{asset.images.length - 4} 张
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

