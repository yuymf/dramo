/**
 * Pro Structured Form - 结构化构建模式
 * 包含形式、内容、风格、目标选择器及五个输入字段
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProFormData {
  format: string; // 形式
  content: string; // 内容
  styles: string[]; // 风格（多选）
  target: string; // 目标
  keyword: string; // 主题关键词
  targetDirection: string; // 目标方向
  topic: string; // 标题
  situation: string; // 场景说明
  hotStuffs: string; // 最近时事
}

interface ProStructuredFormProps {
  projectId: string;
  onSubmit?: (data: ProFormData) => Promise<void>;
}

const FORMAT_OPTIONS = [
  { value: "script", label: "台本式" },
  { value: "dialogue", label: "对话式" },
  { value: "storyboard", label: "分镜式" },
];

const CONTENT_OPTIONS = [
  { value: "live", label: "直播" },
  { value: "movie", label: "电影" },
  { value: "series", label: "短剧" },
  { value: "short", label: "短视频" },
  { value: "vlog", label: "Vlog" },
];

const STYLE_OPTIONS = [
  { value: "humor", label: "幽默" },
  { value: "curious", label: "猎奇" },
  { value: "healing", label: "治愈" },
  { value: "passionate", label: "热血" },
  { value: "sad", label: "伤感" },
  { value: "suspense", label: "悬疑" },
  { value: "thriller", label: "惊悚" },
  { value: "absurd", label: "荒诞" },
  { value: "realistic", label: "写实" },
  { value: "retro", label: "复古" },
  { value: "anime", label: "二次元" },
  { value: "artistic", label: "文艺" },
];

const TARGET_OPTIONS = [
  { value: "chat", label: "杂谈" },
  { value: "game", label: "游戏" },
  { value: "discussion", label: "讨论" },
  { value: "education", label: "知识科普" },
  { value: "commerce", label: "带货" },
  { value: "other", label: "其他" },
];

export function ProStructuredForm({ projectId: _projectId, onSubmit }: ProStructuredFormProps) {
  void _projectId;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showProMode, setShowProMode] = useState(false);
  
  const [formData, setFormData] = useState<ProFormData>({
    format: "script",
    content: "live",
    styles: [],
    target: "chat",
    keyword: "",
    targetDirection: "",
    topic: "",
    situation: "",
    hotStuffs: "",
  });

  const toggleStyle = (style: string) => {
    setFormData((prev) => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style],
    }));
  };

  const handleSubmit = async () => {
    // 基本校验
    if (!formData.keyword.trim()) {
      showToast("请输入主题关键词", "error");
      return;
    }
    if (!formData.topic.trim()) {
      showToast("请输入标题", "error");
      return;
    }

    setLoading(true);
    try {
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        // 占位：模拟提交
        await new Promise((resolve) => setTimeout(resolve, 1500));
        showToast("结构化构建已提交（占位）", "success");
        console.log("ProStructuredForm submitted:", formData);
      }
    } catch (err) {
      showToast((err as Error).message || "提交失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.keyword.trim() !== "" && formData.topic.trim() !== "";

  return (
    <div className="p-6 md:p-8">
      <div className="space-y-6">
        <div className="text-center mb-4">
          <p className="text-slate-600 text-sm jp-serif">
            将粗略想法转换为多帧故事板
          </p>
        </div>

        {/* 主输入区域 */}
        <div className="space-y-4">
          <textarea
            value={formData.situation}
            onChange={(e) => setFormData({ ...formData, situation: e.target.value })}
            placeholder="将粗略想法转换为多帧故事板"
            rows={8}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm bg-[#f5f6f4]"
          />
          
          <div className="flex items-center justify-between text-xs text-slate-500 jp-serif">
            <span>{formData.situation.length} / 20,000</span>
          </div>
        </div>

        {/* Pro 模式展开区域 */}
        {showProMode ? (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700 jp-serif">结构化选项</h3>
              <button
                onClick={() => setShowProMode(false)}
                className="text-xs text-slate-500 hover:text-slate-700 jp-serif"
              >
                收起
              </button>
            </div>

            {/* 形式 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2 jp-serif">
                形式
              </label>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFormData({ ...formData, format: opt.value })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs jp-serif transition-all",
                      formData.format === opt.value
                        ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
                        : "bg-white text-slate-700 border-slate-300 hover:border-[var(--brand-500)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 内容 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2 jp-serif">
                内容
              </label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFormData({ ...formData, content: opt.value })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs jp-serif transition-all",
                      formData.content === opt.value
                        ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
                        : "bg-white text-slate-700 border-slate-300 hover:border-[var(--brand-500)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 风格（多选） */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2 jp-serif">
                风格（可多选）
              </label>
              <div className="flex flex-wrap gap-2">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleStyle(opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs jp-serif transition-all",
                      formData.styles.includes(opt.value)
                        ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
                        : "bg-white text-slate-700 border-slate-300 hover:border-[var(--brand-500)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 目标 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2 jp-serif">
                目标
              </label>
              <div className="flex flex-wrap gap-2">
                {TARGET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFormData({ ...formData, target: opt.value })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs jp-serif transition-all",
                      formData.target === opt.value
                        ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]"
                        : "bg-white text-slate-700 border-slate-300 hover:border-[var(--brand-500)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 详细输入字段 */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 jp-serif">
                  主题关键词 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.keyword}
                  onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                  placeholder="例如：科幻、青春、冒险..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 jp-serif">
                  目标方向
                </label>
                <input
                  type="text"
                  value={formData.targetDirection}
                  onChange={(e) => setFormData({ ...formData, targetDirection: e.target.value })}
                  placeholder="例如：面向年轻观众、探讨社会议题..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 jp-serif">
                  标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="给你的剧本起个名字"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 jp-serif">
                  最近时事
                </label>
                <input
                  type="text"
                  value={formData.hotStuffs}
                  onChange={(e) => setFormData({ ...formData, hotStuffs: e.target.value })}
                  placeholder="可选：结合近期热点，例如：人工智能、环保议题..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] jp-serif text-sm bg-white"
                />
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowProMode(true)}
            className="w-full py-2 px-4 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors jp-serif flex items-center justify-center gap-2"
          >
            <span className="font-semibold">Pro</span>
            <span>展开结构化选项</span>
          </button>
        )}

        {/* 提交按钮 */}
        <Button
          onClick={handleSubmit}
          disabled={loading || !isFormValid}
          size="lg"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              创建故事板...
            </>
          ) : (
            "创建故事板"
          )}
        </Button>

        <p className="text-xs text-center text-slate-400 mt-4 jp-serif">
          你的内容将保持私密。我们不会存储剧本或用于AI训练。
        </p>
      </div>
    </div>
  );
}

