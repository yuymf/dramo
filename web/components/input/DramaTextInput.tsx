/**
 * Drama Text Input - 成段剧本输入模式
 * 支持文本粘贴或文件上传，限制 20,000 字
 */
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { Loader2, Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { saveJSON } from "@/lib/storage/local";

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
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;

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
    setProgress(0);
    setProgressPhase('');
    
    // 根据文本长度估算处理时间并给出提示
    const estimatedTime = Math.ceil(charCount / 1000) * 30; // 每1000字约30秒（更新为现实值）
    if (estimatedTime > 10) {
      showToast(`正在处理文本，预计需要 ${Math.ceil(estimatedTime / 60)} 分钟，请耐心等待...`, "info");
    }
    
    try {
      if (onSubmit) {
        await onSubmit({ text, fileName: fileName || undefined });
      } else {
        let storyboardData;
        
        if (uploadedFile) {
          // 文件上传模式：不支持SSE流式更新
          const formData = new FormData();
          formData.append('file', uploadedFile);
          
          storyboardData = await api(`/api/projects/${projectId}/storyboard/import`, {
            method: 'POST',
            body: formData,
          });
        } else {
          // 纯文本模式：使用POST流式进度
          // const shouldStream = charCount > 2000; // 2000字以上使用流式
          const shouldStream = false; // TODO
          
          if (shouldStream) {
            storyboardData = await new Promise((resolve, reject) => {
              const abortController = new AbortController();
              
              // 10分钟超时
              const timeoutId = setTimeout(() => {
                abortController.abort();
                reject(new Error('处理超时'));
              }, 600000);
              
              fetch(`/api/projects/${projectId}/storyboard/import/stream`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text }),
                signal: abortController.signal,
              })
                .then(async (response) => {
                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                  }
                  
                  if (!response.body) {
                    throw new Error('No response body');
                  }
                  
                  const reader = response.body.getReader();
                  const decoder = new TextDecoder();
                  let buffer = '';
                  
                  while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                      break;
                    }
                    
                    buffer += decoder.decode(value, { stream: true });
                    
                    // 处理 SSE 格式的数据
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || '';
                    
                    for (const line of lines) {
                      if (line.startsWith('data: ')) {
                        try {
                          const data = JSON.parse(line.substring(6));
                          
                          if (data.type === 'progress') {
                            setProgress(data.progress || 0);
                            
                            // 更新进度阶段提示
                            if (data.phase === 'chunks_ready') {
                              setProgressPhase(`正在将文本分成 ${data.total_chunks} 个片段...`);
                            } else if (data.phase === 'chunk_done') {
                              setProgressPhase(`正在处理第 ${data.chunk_index + 1}/${data.total_chunks} 个片段...`);
                            } else if (data.phase === 'merge_start') {
                              setProgressPhase('正在合并所有场景...');
                            }
                          } else if (data.type === 'complete') {
                            clearTimeout(timeoutId);
                            resolve(data.data);
                            return;
                          } else if (data.type === 'error') {
                            clearTimeout(timeoutId);
                            reject(new Error(data.message || '生成失败'));
                            return;
                          }
                        } catch (err) {
                          console.error('SSE parse error:', err);
                        }
                      }
                    }
                  }
                  
                  clearTimeout(timeoutId);
                  reject(new Error('连接意外结束'));
                })
                .catch((err) => {
                  clearTimeout(timeoutId);
                  if (err.name === 'AbortError') {
                    reject(new Error('处理超时'));
                  } else {
                    reject(err);
                  }
                });
            });
          } else {
            // 短文本：直接调用后端 API（绕过 Next.js 超时限制）
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:12321';
            const token = localStorage.getItem('token');
            
            const response = await fetch(`${backendUrl}/api/projects/${projectId}/storyboard/import`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
              },
              body: JSON.stringify({ text }),
              signal: AbortSignal.timeout(600000), // 10分钟超时
            });
            
            if (!response.ok) {
              const errorText = await response.text().catch(() => '');
              throw new Error(`导入失败: ${response.status} ${errorText}`);
            }
            
            storyboardData = await response.json();
          }
        }
        
        // 缓存分镜数据到 localStorage
        saveJSON(`storyboard_${projectId}`, storyboardData);
        
        showToast("分镜生成成功！", "success");
        
        // 跳转到分镜页面
        router.push(`/projects/${projectId}/storyboard`);
      }
    } catch (err) {
      const errorMessage = (err as Error).message || "提交失败";
      
      // 提供更友好的错误提示
      if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT') || errorMessage.includes('处理超时')) {
        showToast("处理时间过长，请尝试缩短文本或稍后重试", "error");
      } else if (errorMessage.includes('500')) {
        showToast("服务器处理失败，请检查文本内容或稍后重试", "error");
      } else if (errorMessage.includes('连接中断')) {
        showToast("连接中断，请检查网络或稍后重试", "error");
      } else {
        showToast(errorMessage, "error");
      }
      
      console.error('Storyboard generation error:', err);
    } finally {
      setLoading(false);
      setProgress(0);
      setProgressPhase('');
    }
  };

  const isFormValid = (text.trim() || uploadedFile) && !isOverLimit;

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
            className={cn(
              "w-full px-4 py-3 border rounded-lg resize-none focus:outline-none focus:ring-2 jp-serif text-sm bg-[#f5f6f4]",
              isOverLimit
                ? "border-red-300 focus:ring-red-500"
                : "border-slate-200 focus:ring-[var(--brand-500)]"
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-slate-800 transition-colors jp-serif"
                >
                  <Upload className="w-4 h-4" />
                  上传大纲
                </button>
              </label>
              
              {fileName && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs jp-serif">
                  <FileText className="w-3 h-3 text-slate-600" />
                  <span className="text-slate-700">{fileName}</span>
                  <button onClick={handleClearFile} className="text-slate-500 hover:text-slate-700">
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


        {/* 提交按钮 */}
        {/* Progress indicator */}
        {loading && progress > 0 && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>{progressPhase || '正在处理...'}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-[var(--brand-500)] h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!isFormValid || loading}
          size="lg"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {progressPhase || 'AI 正在生成分镜，请稍候...'}
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

