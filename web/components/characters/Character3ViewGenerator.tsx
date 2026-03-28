/**
 * Character 3-View Generator - Generate 3-view character artwork
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import { Image as ImageIcon, Loader2, Download } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Character3ViewAsset, Character, Script } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface Character3ViewGeneratorProps {
  projectId: string;
  script?: Script;
  character?: Character;
  onGenerated?: (asset: Character3ViewAsset) => void;
}

export function Character3ViewGenerator({
  projectId,
  script,
  character,
  onGenerated,
}: Character3ViewGeneratorProps) {
  const [name, setName] = useState(character?.name || "");
  const [description, setDescription] = useState(character?.styleTags?.join(", ") || "");
  const [notes, setNotes] = useState("");
  const [artStyle, setArtStyle] = useState<"sketch" | "comic">("sketch");
  const [loading, setLoading] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<Character3ViewAsset | null>(null);
  const { showToast } = useToast();

  const handleGenerate = async () => {
    if (!name.trim()) {
      showToast("请输入角色名称", "error");
      return;
    }

    setLoading(true);

    try {
      const res = await api<Character3ViewAsset>(
        `/api/projects/${projectId}/characters/generate-3view`,
        {
          method: "POST",
          body: {
            name,
            description,
            notes,
            script,
            characterProfile: character,
            artStyle,
          },
        }
      );

      setGeneratedAsset(res);
      showToast("角色三视图生成成功", "success");
      onGenerated?.(res);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 输入表单 */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            角色名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：李小明"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">角色描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：20岁左右的年轻女性，短发，戴眼镜，休闲装扮..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">补充说明</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="例：参考某某角色，风格偏可爱..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">画风</label>
          <div className="flex gap-2">
            <button
              onClick={() => setArtStyle("sketch")}
              className={cn(
                "flex-1 px-4 py-2 border rounded-lg text-sm transition-colors",
                artStyle === "sketch"
                  ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                  : "border-slate-300 hover:border-slate-400"
              )}
            >
              线稿
            </button>
            <button
              onClick={() => setArtStyle("comic")}
              className={cn(
                "flex-1 px-4 py-2 border rounded-lg text-sm transition-colors",
                artStyle === "comic"
                  ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                  : "border-slate-300 hover:border-slate-400"
              )}
            >
              漫画
            </button>
          </div>
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
            生成三视图
          </>
        )}
      </Button>

      {/* 生成结果 */}
      {generatedAsset && (
        <div className="mt-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm jp-serif">生成结果</h3>
            <span className="text-xs text-slate-500">
              {new Date(generatedAsset.createdAt).toLocaleString("zh-CN")}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["front", "side", "back"].map((view) => (
              <div key={view} className="space-y-1">
                <p className="text-xs text-slate-600 text-center capitalize">
                  {view === "front" ? "正面" : view === "side" ? "侧面" : "背面"}
                </p>
                <div className="relative aspect-square bg-slate-100 rounded border border-slate-200 overflow-hidden">
                  <Image
                    src={
                      generatedAsset.assets[
                        view as keyof typeof generatedAsset.assets
                      ]
                    }
                    alt={`${view} view`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 33vw, 120px"
                    unoptimized
                  />
                </div>
                <a
                  href={
                    generatedAsset.assets[
                      view as keyof typeof generatedAsset.assets
                    ]
                  }
                  download={`${generatedAsset.characterName}_${view}.png`}
                  className="flex items-center justify-center gap-1 text-xs text-[var(--brand-600)] hover:text-[var(--brand-700)]"
                >
                  <Download className="w-3 h-3" />
                  下载
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

