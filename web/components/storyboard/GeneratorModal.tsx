/**
 * GeneratorModal - Image generation dialog with style and color options
 */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createGenerationJob, getJob } from "@/lib/api/jobs";
import { useGenerationJobs } from "@/lib/hooks/useGenerationJobs";
import { useToast } from "@/components/ui/Toast";
import type { ImageItem } from "@/lib/models";

interface GeneratorModalProps {
  projectId: string;
  frameId: string;
  frameTitle: string;
  frameDescription: string;
  frameBulletPoints: string[];
  referenceImages?: string[]; // Reference image URLs
  onClose: () => void;
  onGenerated: (frameId: string, images: ImageItem[]) => void;
  onPersistPrompt?: (frameId: string, prompt: string, hasReferences: boolean) => void;
}

type StyleType = "realistic" | "sketch" | "comic" | "doodle";
type ColorType = "default" | "warm" | "cool" | "monochrome";

const STYLES: Array<{ value: StyleType; label: string; description: string }> = [
  { value: "realistic", label: "写实", description: "真实照片风格" },
  { value: "sketch", label: "线稿", description: "黑白手绘线条" },
  { value: "comic", label: "漫画", description: "日式漫画风格" },
  { value: "doodle", label: "涂鸦", description: "手绘插画风" },
];

const COLORS: Array<{ value: ColorType; label: string; colors: string[] }> = [
  { value: "default", label: "默认", colors: ["#000000", "#FFFFFF", "#1E90FF"] },
  { value: "warm", label: "暖色", colors: ["#FF6B35", "#F7931E", "#FDC830"] },
  { value: "cool", label: "冷色", colors: ["#4ECDC4", "#556270", "#A8DADC"] },
  { value: "monochrome", label: "黑白", colors: ["#000000", "#808080", "#FFFFFF"] },
];

export function GeneratorModal({
  projectId,
  frameId,
  frameTitle,
  frameDescription,
  frameBulletPoints: _frameBulletPoints,
  referenceImages = [],
  onClose,
  onGenerated: _onGenerated,
  onPersistPrompt,
}: GeneratorModalProps) {
  void _frameBulletPoints;
  void _onGenerated;
  const [style, setStyle] = useState<StyleType>("sketch");
  const [colorGuide, setColorGuide] = useState<ColorType>("default");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { addJob } = useGenerationJobs();
  const { showToast } = useToast();

  const hasReferences = referenceImages && referenceImages.length > 0;

  // Use frameDescription as prompt (already computed by Auto logic) (why: parent handles Auto decision and name replacement)
  useEffect(() => {
    setPrompt(frameDescription || frameTitle || "");
  }, [frameTitle, frameDescription]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }

    // 生成前先持久化当前 prompt
    if (onPersistPrompt) {
      onPersistPrompt(frameId, prompt, hasReferences);
    }

    setSubmitting(true);

    try {
      // Create generation job
      const response = await createGenerationJob({
        projectId,
        frameId,
        params: {
        name: frameTitle,
        description: prompt,
        style,
        colorGuide,
          referenceImages,
        mode: "single",
        },
      });

      // 立即获取任务详情并添加到本地状态，确保用户能立即看到任务
      try {
        const job = await getJob(response.jobId);
        addJob(job);
        console.log('[GeneratorModal] Job added to local store immediately:', response.jobId);
      } catch (fetchErr) {
        console.warn('[GeneratorModal] Failed to fetch job details, will rely on next refresh:', fetchErr);
        // 如果获取失败，将在下一次任务刷新时同步
      }

      showToast('已加入生成队列', 'success');
      onClose();
    } catch (err) {
      console.error("Failed to create generation job:", err);
      showToast((err as Error).message || "生成失败，请重试", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 关闭时也持久化 prompt（如果有修改）
  const handleClose = () => {
    if (onPersistPrompt && prompt.trim() && prompt !== frameDescription) {
      onPersistPrompt(frameId, prompt, hasReferences);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold jp-serif">Image Generator</h2>
              <p className="text-sm text-slate-500">
                {frameTitle} • Frame {frameId.split("_").pop()}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>


        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Style Selection */}
          <div>
            <label className="block text-sm font-semibold mb-3 jp-serif">
              Style
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all duration-200 text-left",
                    style === s.value
                      ? "border-[var(--brand-500)] bg-[var(--brand-50)]"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="font-medium text-sm mb-1">{s.label}</div>
                  <div className="text-xs text-slate-500">{s.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Guide */}
          <div>
            <label className="block text-sm font-semibold mb-3 jp-serif">
              Color Guide
              <span className="ml-2 text-xs font-normal text-slate-500">
                (可选)
              </span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColorGuide(c.value)}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all duration-200",
                    colorGuide === c.value
                      ? "border-[var(--brand-500)] bg-[var(--brand-50)]"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="font-medium text-sm mb-2">{c.label}</div>
                  <div className="flex gap-1">
                    {c.colors.map((color, idx) => (
                      <div
                        key={idx}
                        className="w-6 h-6 rounded border border-slate-200"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-semibold mb-2 jp-serif">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm resize-none"
              placeholder="描述这一帧的场景、角色、氛围..."
            />
            <p className="text-xs text-slate-500 mt-2">
              已自动填充场景描述，可编辑调整
            </p>
          </div>

          {/* Reference Images Preview */}
          {referenceImages.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-2 jp-serif">
                参考图片
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({referenceImages.length} 张)
                </span>
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {referenceImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 w-20 h-20 rounded border border-slate-200 overflow-hidden"
                  >
                    <Image
                      src={img}
                      alt={`参考 ${idx + 1}`}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            任务将加入后台队列处理
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={submitting || !prompt.trim()}
              className="bg-gradient-to-r from-orange-400 to-pink-500 hover:shadow-lg"
            >
                  <Sparkles className="w-4 h-4 mr-2" />
              {submitting ? '提交中...' : 'Generate'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

