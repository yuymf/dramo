/**
 * Location Image Generator - Generate location images with reference support
 */
"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Image as ImageIcon, Loader2, Upload, X, Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import type { LocationImageAssetV2, Script } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";

interface LocationImageGeneratorProps {
  projectId: string;
  script?: Script;
  onGenerated?: (asset: LocationImageAssetV2) => void;
  onUploaded?: () => void;
}

export function LocationImageGenerator({
  projectId,
  script,
  onGenerated,
  onUploaded,
}: LocationImageGeneratorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [alias, setAlias] = useState("");
  const [notes, setNotes] = useState("");
  const [style, setStyle] = useState("");
  const [loading, setLoading] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const { showToast } = useToast();

  const refInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Handle reference image upload
  const handleReferenceUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setReferenceImages((prev) => [...prev, event.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });

      // Reset input
      if (refInputRef.current) {
        refInputRef.current.value = "";
      }
    },
    []
  );

  // Remove reference image
  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle direct upload (no generation)
  const handleDirectUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const images: Array<{
        id: string;
        url: string;
        source: "upload";
        createdAt: string;
      }> = [];

      let loaded = 0;
      
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const result = await new Promise<string>((resolve) => {
          reader.onload = (event) => {
            if (event.target?.result) {
              resolve(event.target.result as string);
            }
          };
          reader.readAsDataURL(file);
        });
        
        images.push({
          id: `img_${Date.now()}_${loaded}`,
          url: result,
          source: "upload",
          createdAt: new Date().toISOString(),
        });
        loaded++;
      }

      // All files loaded, save to local storage and backend
      const locationName = name.trim() || "未命名地点";
      const asset: LocationImageAssetV2 = {
        id: `loc_upload_${Date.now()}`,
        locationName,
        description: description.trim(),
        alias: alias.trim() || undefined,
        images,
        createdAt: new Date().toISOString(),
      };

      try {
        await api(`/api/projects/${projectId}/locations/assets`, {
          method: 'POST',
          body: {
            name: locationName,
            description: asset.description,
            alias: asset.alias,
            images: asset.images,
          },
        });
        showToast(`已上传 ${images.length} 张图片到地点 "${locationName}"`, "success");
      } catch (err) {
        console.error('Failed to save location to backend:', err);
        showToast('保存到服务器失败', 'error');
        return;
      }

      // Reset form
      setName("");
      setDescription("");
      setAlias("");
      
      // Trigger parent refresh
      onUploaded?.();

      // Reset input
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    },
    [projectId, name, description, alias, showToast, onUploaded]
  );

  // Handle generation
  const handleGenerate = async () => {
    if (!name.trim()) {
      showToast("请输入地点名称", "error");
      return;
    }

    setLoading(true);

    try {
      const res = await api<LocationImageAssetV2>(
        `/api/projects/${projectId}/locations/generate-image`,
        {
          method: "POST",
          body: {
            name,
            description,
            alias,
            notes,
            style,
            script,
            referenceImages,
          },
        }
      );

      showToast("地点图片生成成功", "success");
      onGenerated?.(res);

      // Reset form
      setName("");
      setDescription("");
      setAlias("");
      setNotes("");
      setStyle("");
      setReferenceImages([]);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 border border-slate-200 rounded-lg bg-white">
      <h2 className="text-lg font-semibold jp-serif">生成地点图片</h2>

      {/* 输入表单 */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            地点名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：咖啡馆"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">地点描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：温馨的小咖啡馆，复古装修，暖色调灯光，有书架和绿植..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">地点别称</label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="例：老王咖啡、市中心店等"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">补充说明</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="例：参考某某店，风格偏日式..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">画风风格</label>
          <input
            type="text"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="例：写实、插画、水彩等"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm"
          />
        </div>

        {/* Reference Images */}
        <div>
          <label className="block text-sm font-medium mb-2">参考图片（可选）</label>
          <input
            ref={refInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleReferenceUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => refInputRef.current?.click()}
            className="w-full px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-[var(--brand-500)] transition-colors flex items-center justify-center gap-2 text-sm text-slate-600"
          >
            <Plus className="w-4 h-4" />
            添加参考图片
          </button>

          {referenceImages.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {referenceImages.map((img, idx) => (
                <div key={idx} className="relative group aspect-square overflow-hidden rounded border border-slate-200">
                  <Image
                    src={img}
                    alt={`参考 ${idx + 1}`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 33vw, 120px"
                    unoptimized
                  />
                  <button
                    onClick={() => removeReferenceImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 生成按钮 */}
      <Button
        onClick={handleGenerate}
        disabled={loading || !name.trim()}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <ImageIcon className="w-4 h-4 mr-2" />
            生成地点图片
          </>
        )}
      </Button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-white text-slate-500">或</span>
        </div>
      </div>

      {/* Direct Upload */}
      <div>
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleDirectUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <Upload className="w-4 h-4" />
          直接上传图片
        </button>
        <p className="text-xs text-slate-500 mt-2 text-center">
          支持多选，无需填写描述
        </p>
      </div>
    </div>
  );
}
