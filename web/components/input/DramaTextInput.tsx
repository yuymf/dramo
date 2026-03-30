/**
 * Drama Text Input - 成段剧本输入模式
 * 支持文本粘贴或文件上传，限制 20,000 字
 * 使用异步 Task 模式：提交 → 获取 taskId → 轮询进度 → 完成跳转
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { Loader2, Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { saveJSON } from "@/lib/storage/local";
import { useTaskPolling } from "@/lib/hooks/useTaskPolling";

interface DramaTextInputProps {
  projectId: string;
  onSubmit?: (data: { text: string; fileName?: string }) => Promise<void>;
}

const MAX_CHARS = 20000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".txt", ".md", ".docx", ".pdf", ".csv"];

export function DramaTextInput({ projectId, onSubmit }: DramaTextInputProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;

  // Async task polling
  const { status, progress, result, error, isPolling } = useTaskPolling(taskId, {
    intervalMs: 3000,
  });

  // Handle task completion/failure
  useEffect(() => {
    if (status === "completed" && result) {
      // Cache storyboard data to localStorage
      saveJSON(`storyboard_${projectId}`, result);
      showToast("分镜生成成功！", "success");
      setLoading(false);
      setTaskId(null);
      router.push(`/projects/${projectId}/storyboard`);
    } else if (status === "failed" && error) {
      const message = error.message || "生成失败";
      if (message.includes("TIMEOUT") || message.includes("timeout")) {
        showToast("处理时间过长，请尝试缩短文本或稍后重试", "error");
      } else {
        showToast(message, "error");
      }
      setLoading(false);
      setTaskId(null);
    }
  }, [status, result, error, projectId, router, showToast]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (fileName) {
      setFileName(null); // 手动编辑后清除文件名
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      showToast(`文件大小不能超过 10MB`, "error");
      e.target.value = "";
      return;
    }

    // 检查文件扩展名
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      showToast(
        `不支持的文件格式，请上传 ${ALLOWED_EXTENSIONS.join(", ")} 文件`,
        "error"
      );
      e.target.value = "";
      return;
    }

    // 保存文件
    setUploadedFile(file);
    setFileName(file.name);

    // 仅对 .txt 和 .md 文件进行本地预览
    if (ext === ".txt" || ext === ".md") {
      try {
        const content = await file.text();
        if (content.length > MAX_CHARS) {
          showToast(`文件内容超过 ${MAX_CHARS} 字限制`, "error");
          e.target.value = "";
          setUploadedFile(null);
          setFileName(null);
          return;
        }
        setText(content);
        showToast(`已加载文件：${file.name}`, "success");
      } catch (err) {
        showToast("文件读取失败", "error");
        console.error(err);
        setUploadedFile(null);
        setFileName(null);
      }
    } else {
      // .docx、.pdf、.csv 显示占位提示
      setText(`[文件已选择：${file.name}]\n\n该文件将由后端解析并生成分镜。`);
      showToast(`已选择文件：${file.name}`, "success");
    }

    e.target.value = "";
  };

  const handleClearFile = () => {
    setText("");
    setFileName(null);
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() && !uploadedFile) {
      showToast("请输入或上传剧本内容", "error");
      return;
    }

    if (text.trim() && isOverLimit) {
      showToast(`内容超过 ${MAX_CHARS} 字限制`, "error");
      return;
    }

    setLoading(true);

    try {
      if (onSubmit) {
        await onSubmit({ text, fileName: fileName || undefined });
        setLoading(false);
        return;
      }

      // Submit to backend — returns 202 + taskId
      const response = await api<{ taskId: string }>(
        `/api/projects/${projectId}/storyboard/import`,
        {
          method: "POST",
          body: { text },
          timeoutMs: 30000, // 30s — backend returns immediately
        }
      );

      setTaskId(response.taskId);
      showToast("已提交分镜生成任务，请等待处理完成...", "info");
    } catch (err) {
      const errorMessage = (err as Error).message || "提交失败";

      if (errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT")) {
        showToast("提交请求超时，请稍后重试", "error");
      } else if (errorMessage.includes("500")) {
        showToast("服务器处理失败，请检查文本内容或稍后重试", "error");
      } else {
        showToast(errorMessage, "error");
      }

      console.error("Storyboard submit error:", err);
      setLoading(false);
    }
  };

  const isFormValid = (text.trim() || uploadedFile) && !isOverLimit;

  // Derive progress display from polling
  const displayProgress = isPolling ? progress : 0;
  const progressPhase = isPolling
    ? status === "queued"
      ? "排队中..."
      : status === "processing"
        ? progress < 20
          ? "正在准备资源..."
          : progress < 50
            ? "正在分析剧本结构..."
            : progress < 80
              ? "正在生成分镜面板..."
              : "正在合并最终结果..."
        : ""
    : "";

  return (
    <div className="p-6 md:p-8">
      <div className="space-y-6">
        <div className="text-center mb-4">
          <p className="text-slate-600 text-sm jp-serif">
            将完成的剧本转换为多帧故事板
          </p>
        </div>

        {/* 文本输入 + 上传按钮 */}
        <div className="space-y-4">
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="在此粘贴或输入完整剧本内容..."
            rows={12}
            disabled={loading}
            className={cn(
              "w-full px-4 py-3 border rounded-lg resize-none focus:outline-none focus:ring-2 jp-serif text-sm bg-[#f5f6f4]",
              isOverLimit
                ? "border-red-300 focus:ring-red-500"
                : "border-slate-200 focus:ring-[var(--brand-500)]",
              loading && "opacity-60 cursor-not-allowed"
            )}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_EXTENSIONS.join(",")}
                onChange={handleFileSelect}
                className="hidden"
                id="drama-file-input"
              />
              <label htmlFor="drama-file-input">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-slate-800 transition-colors jp-serif disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  上传大纲
                </button>
              </label>

              {fileName && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs jp-serif">
                  <FileText className="w-3 h-3 text-slate-600" />
                  <span className="text-slate-700">{fileName}</span>
                  <button onClick={handleClearFile} className="text-slate-500 hover:text-slate-700" disabled={loading}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <span className="text-xs text-slate-400 jp-serif">
                PDF、TXT 或 CSV (最大 10mb)
              </span>
            </div>

            <span className={cn(
              "text-xs jp-serif",
              isOverLimit ? "text-red-500 font-semibold" : "text-slate-500"
            )}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
        </div>


        {/* Progress indicator */}
        {loading && displayProgress > 0 && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>{progressPhase || "正在处理..."}</span>
              <span>{displayProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-[var(--brand-500)] h-2 rounded-full transition-all duration-300"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* 提交按钮 */}
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid || loading}
          size="lg"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {progressPhase || "AI 正在生成分镜，请稍候..."}
            </>
          ) : (
            "导入剧本"
          )}
        </Button>

        <p className="text-xs text-center text-slate-400 mt-4 jp-serif">
          你的内容将保持私密。我们不会存储剧本或用于AI训练。
        </p>
      </div>
    </div>
  );
}
