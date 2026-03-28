/**
 * 输入生成页面 - 三种输入模式
 * base: 聊天框模式
 * pro: 结构化构建模式
 * drama: 剧本导入模式
 */
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import { BaseChatInput } from "@/components/input/BaseChatInput";
import { ProStructuredForm } from "@/components/input/ProStructuredForm";
import { DramaTextInput } from "@/components/input/DramaTextInput";
import { Loader2, Clock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Script, StructuredScriptInput, ScriptStyle } from "@/lib/models";
import { saveJSON, addRecentInput, getRecentInputs, type RecentInput } from "@/lib/storage/local";
import { useToast } from "@/components/ui/Toast";

type InputMode = "base" | "pro" | "drama";

const VALID_MODES: InputMode[] = ["base", "pro", "drama"];

function isValidMode(mode: string | null): mode is InputMode {
  return mode !== null && VALID_MODES.includes(mode as InputMode);
}

function InputPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;

  // 从 URL 查询参数读取模式，默认 base
  const urlMode = searchParams.get("mode");
  const [mode, setMode] = useState<InputMode>(
    isValidMode(urlMode) ? urlMode : "base"
  );
  const [recentInputs, setRecentInputs] = useState<RecentInput[]>([]);
  const { showToast } = useToast();

  // 加载最近输入
  useEffect(() => {
    if (projectId) {
      setRecentInputs(getRecentInputs(projectId));
    }
  }, [projectId]);

  // 监听 URL 变化同步状态
  useEffect(() => {
    const rawMode = searchParams.get("mode");
    const validMode = isValidMode(rawMode) ? rawMode : "base";
    if (validMode !== mode) {
      setMode(validMode);
    }
  }, [searchParams, mode]);

  // 切换模式时更新 URL
  const handleModeChange = (newMode: string) => {
    const validMode = newMode as InputMode;
    setMode(validMode);
    router.replace(`?mode=${validMode}`, { scroll: false });
  };

  // Pro 表单提交处理
  const handleProSubmit = useCallback(async (formData: {
    format: string;
    content: string;
    styles: string[];
    target: string;
    keyword: string;
    targetDirection: string;
    topic: string;
    situation: string;
    hotStuffs: string;
  }) => {
    // 映射前端表单字段到 API 结构
    const contentTypeMap: Record<string, string> = {
      live: 'live',
      movie: 'film',
      series: 'short_drama',
      short: 'short_video',
      vlog: 'vlog',
    };

    const formMap: Record<string, string> = {
      script: 'linear',
      dialogue: 'branching',
      storyboard: 'storyboard',
    };

    const requestBody: StructuredScriptInput = {
      source: 'structured',
      form: (formMap[formData.format] || 'linear') as 'linear' | 'branching' | 'storyboard',
      contentType: (contentTypeMap[formData.content] || 'live') as 'live' | 'film' | 'short_drama' | 'short_video' | 'vlog',
      styles: formData.styles as ScriptStyle[],
      goal: formData.target,
      keyword: formData.keyword,
      target: formData.targetDirection,
      topic: formData.topic,
      situation: formData.situation,
      hot_stuffs: formData.hotStuffs,
    };

    try {
      // 调用 API 生成台本
      const script = await api<Script>(`/api/projects/${projectId}/script`, {
        method: 'POST',
        body: requestBody,
      });

      // 保存草稿到本地
      saveJSON(`script_draft_${projectId}`, script);

      // 保存最近输入
      addRecentInput(projectId, {
        title: formData.topic || '未命名',
        keyword: formData.keyword,
        summary: formData.situation?.substring(0, 100) || '',
        format: formData.format,
        content: formData.content,
      });

      // 根据形式跳转
      const routeMap: Record<string, string> = {
        script: '/scripts',
        dialogue: '/scripts/dialogue',
        storyboard: '/scripts/hollywood',
      };
      const targetRoute = routeMap[formData.format] || '/scripts';
      router.push(`/projects/${projectId}${targetRoute}`);
    } catch (error) {
      console.error('[Input] Script generation failed:', error);
      showToast(
        error instanceof Error ? error.message : '台本生成失败，请稍后重试',
        'error'
      );
    }
  }, [projectId, router, showToast]);

  return (
    <div className="h-full flex flex-col p-4 md:p-8 bg-[var(--at-bg)]">
      <div className="w-full max-w-5xl mx-auto flex flex-col flex-1">
        {/* Header with Title and Tabs */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--at-text)] tracking-tight">
            新建故事
          </h1>
          <p className="text-sm text-[var(--at-text-secondary)] mt-1">
            选择创建方式，开始你的创作之旅
          </p>

          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--at-surface-sunken)] mt-5 max-w-md">
            <button
              onClick={() => handleModeChange("drama")}
              className={`flex-1 px-4 py-2 text-sm rounded-md transition-all duration-200 ${mode === "drama" ? "bg-[var(--at-surface)] text-[var(--at-text)] font-medium shadow-sm" : "text-[var(--at-text-secondary)] hover:text-[var(--at-text)]"}`}
            >
              导入剧本
            </button>
            <button
              onClick={() => handleModeChange("pro")}
              className={`flex-1 px-4 py-2 text-sm rounded-md transition-all duration-200 ${mode === "pro" ? "bg-[var(--at-surface)] text-[var(--at-text)] font-medium shadow-sm" : "text-[var(--at-text-secondary)] hover:text-[var(--at-text)]"}`}
            >
              剧本生成器
            </button>
            <button
              onClick={() => handleModeChange("base")}
              className={`flex-1 px-4 py-2 text-sm rounded-md transition-all duration-200 ${mode === "base" ? "bg-[var(--at-surface)] text-[var(--at-text)] font-medium shadow-sm" : "text-[var(--at-text-secondary)] hover:text-[var(--at-text)]"}`}
            >
              空白故事板
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {mode === "base" && (
            <BaseChatInput projectId={projectId} />
          )}

          {mode === "pro" && (
            <ProStructuredForm projectId={projectId} onSubmit={handleProSubmit} />
          )}

          {mode === "drama" && (
            <DramaTextInput projectId={projectId} />
          )}
        </div>

        {/* 最近输入 */}
        {mode === "pro" && recentInputs.length > 0 && (
          <div className="pt-6 mt-6 border-t border-[var(--at-border)]">
            <div className="flex items-baseline gap-2 mb-4">
              <h3 className="text-sm font-semibold text-[var(--at-text)]">最近项目</h3>
              <span className="text-xs font-medium text-[var(--at-accent)] bg-[var(--at-accent-light)] px-2 py-0.5 rounded-full">{recentInputs.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentInputs.slice(0, 6).map((input) => (
                <button
                  key={input.id}
                  onClick={() => router.push(`/projects/${projectId}/scripts/${input.format === 'dialogue' ? 'dialogue' : input.format === 'storyboard' ? 'hollywood' : 'script'}`)}
                  className="text-left p-4 rounded-xl bg-[var(--at-surface)] border border-[var(--at-border)] hover:border-[var(--at-accent)]/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <h4 className="text-sm font-semibold text-[var(--at-text)] mb-1 truncate">
                    {input.title}
                  </h4>
                  {input.keyword && (
                    <p className="text-xs mb-2 text-[var(--at-text-tertiary)]">关键词：{input.keyword}</p>
                  )}
                  {input.summary && (
                    <p className="text-xs line-clamp-2 mb-2 text-[var(--at-text-secondary)]">{input.summary}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-[var(--at-text-tertiary)]">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(input.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--at-surface-sunken)] text-[11px]">
                      {input.format === 'script' ? '台本式' : input.format === 'dialogue' ? '对话式' : '分镜式'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InputPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <InputPageContent />
    </Suspense>
  );
}

