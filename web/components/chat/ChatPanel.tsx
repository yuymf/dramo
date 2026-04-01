"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/Toast";
import { useAIChat } from "@/app/ai-chat-provider";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { runPipeline } from "@/lib/pipeline-controller";
import { TaskList } from "@/components/chat/TaskList";
import { MessageRenderer } from "@/components/chat/MessageRenderer";
import { StopButton } from "@/components/chat/StopButton";
import type { ExtendedChatMessage, StructuredRequirements } from "@/lib/types/chat";

interface ChatPanelProps {
  projectId: string;
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();
  const { currentPageType, currentJsonData } = useAIChat();
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const initTasks = usePipelineStore((s) => s.initTasks);
  const updateTaskStatus = usePipelineStore((s) => s.updateTaskStatus);
  const setRequirements = usePipelineStore((s) => s.setRequirements);

  // Load history
  useEffect(() => {
    async function loadHistory() {
      if (!projectId) return;

      try {
        const initialMessageKey = `project_${projectId}_initialMessage`;
        const initialMessage = sessionStorage.getItem(initialMessageKey);

        if (initialMessage) {
          sessionStorage.removeItem(initialMessageKey);
          initTasks();
          updateTaskStatus('clarification', 'in_progress');

          const userMsg: ExtendedChatMessage = {
            id: `msg_${Date.now()}_user`,
            role: "user",
            content: initialMessage,
            createdAt: new Date().toISOString(),
          };
          setMessages([userMsg]);
          setInitialLoading(false);

          try {
            const res = await api<{
              userMessage: ExtendedChatMessage;
              assistantMessage: ExtendedChatMessage;
            }>(`/api/chat/${projectId}/messages`, {
              method: "POST",
              body: { role: "user", content: initialMessage, mode: "clarification" },
            });
            setMessages([res.userMessage, res.assistantMessage]);
          } catch (err) {
            console.error("Failed to send initial message:", err);
          }
          return;
        }

        const res = await api<{ data: ExtendedChatMessage[] }>(
          `/api/chat/${projectId}/messages`
        );
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setInitialLoading(false);
      }
    }

    loadHistory();
  }, [projectId, initTasks, updateTaskStatus]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClarificationComplete = useCallback((requirements: StructuredRequirements) => {
    updateTaskStatus('clarification', 'completed');
    setRequirements(requirements);

    const controller = runPipeline(projectId, requirements, null, {
      onStepStart: (step) => {
        const labels: Record<string, string> = {
          script: '开始生成台本...',
          characters: '开始提取角色...',
          locations: '开始提取场景...',
          storyboard: '开始生成分镜...',
        };
        const progressMsg: ExtendedChatMessage = {
          id: `progress_${step}_${Date.now()}`,
          role: 'assistant',
          content: labels[step] || `正在处理 ${step}...`,
          messageType: 'progress',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, progressMsg]);
      },
      onStepComplete: (step) => {
        const labels: Record<string, string> = {
          script: '台本生成完成！',
          characters: '角色提取完成！',
          locations: '场景提取完成！',
          storyboard: '分镜生成完成！',
        };
        const completeMsg: ExtendedChatMessage = {
          id: `complete_${step}_${Date.now()}`,
          role: 'assistant',
          content: labels[step] || `${step} 完成`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, completeMsg]);
      },
      onChunk: () => {
        // Progressive rendering handled by left-side tab components
      },
      onTabSwitch: (tab) => {
        window.dispatchEvent(
          new CustomEvent('pipeline-tab-switch', { detail: { tab } })
        );
      },
      onError: (step, error) => {
        const errorMsg: ExtendedChatMessage = {
          id: `error_${step}_${Date.now()}`,
          role: 'assistant',
          content: `${step} 生成失败: ${error}。你可以稍后重试。`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      },
      onDone: () => {
        const doneMsg: ExtendedChatMessage = {
          id: `done_${Date.now()}`,
          role: 'assistant',
          content: '全部生成完毕！你可以在左侧各 tab 查看和编辑。有什么需要调整的随时告诉我。',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, doneMsg]);
      },
    });

    usePipelineStore.getState().setAbortController(controller);
  }, [projectId, updateTaskStatus, setRequirements]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    try {
      const requestBody: Record<string, unknown> = {
        role: "user",
        content: userMessage,
      };

      if (currentPageType && currentJsonData) {
        requestBody.context = { pageType: currentPageType, data: currentJsonData };
      }

      if (pipelineStatus === 'clarifying') {
        requestBody.mode = 'clarification';
      }

      const res = await api<{
        userMessage: ExtendedChatMessage;
        assistantMessage: ExtendedChatMessage;
      }>(`/api/chat/${projectId}/messages`, {
        method: "POST",
        body: requestBody,
      });

      setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);

      if (res.assistantMessage.clarificationComplete) {
        handleClarificationComplete(res.assistantMessage.clarificationComplete);
      }
    } catch (err) {
      showToast((err as Error).message, "error");
      setInput(userMessage);
    } finally {
      setLoading(false);
    }
  }, [input, loading, currentPageType, currentJsonData, pipelineStatus, projectId, showToast, handleClarificationComplete]);

  const handleOptionSelect = useCallback(async (messageId: string, selected: string[]) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, selectedOption: selected } : msg
      )
    );

    const msg = messages.find((m) => m.id === messageId);
    const selectedLabels = selected
      .map((id) => {
        if (id === '__skip__') return msg?.options?.skipAction?.label || '跳过';
        return msg?.options?.items.find((item) => item.id === id)?.label || id;
      })
      .join('、');

    setLoading(true);

    try {
      const res = await api<{
        userMessage: ExtendedChatMessage;
        assistantMessage: ExtendedChatMessage;
      }>(`/api/chat/${projectId}/messages`, {
        method: "POST",
        body: {
          role: "user",
          content: selectedLabels,
          mode: pipelineStatus === 'clarifying' ? 'clarification' : undefined,
          selectedOption: selected,
        },
      });

      setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);

      if (res.assistantMessage.clarificationComplete) {
        handleClarificationComplete(res.assistantMessage.clarificationComplete);
      }
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [messages, projectId, pipelineStatus, showToast, handleClarificationComplete]);

  const handleCustomInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleReset = async () => {
    if (!confirm("确定要清空对话历史吗？")) return;

    try {
      await api(`/api/chat/${projectId}/reset`, { method: "POST" });
      setMessages([]);
      usePipelineStore.getState().reset();
      showToast("对话历史已清空", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTaskClick = (step: string) => {
    const tabMap: Record<string, string> = {
      script: 'scripts',
      characters: 'characters',
      locations: 'locations',
      storyboard: 'storyboard',
    };
    const tab = tabMap[step];
    if (tab) {
      window.dispatchEvent(
        new CustomEvent('pipeline-tab-switch', { detail: { tab } })
      );
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--at-bg)]">
        <div className="text-center animate-fade-in">
          <div className="w-8 h-8 mx-auto mb-2 text-3xl opacity-40">🐱</div>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--at-text-tertiary)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--at-bg)]">
      <TaskList onTaskClick={handleTaskClick} />

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--at-border)]">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐱</span>
          <h2 className="text-sm font-semibold text-[var(--at-text)]">AI 助手</h2>
        </div>
        <div className="flex items-center gap-2">
          <StopButton />
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={messages.length === 0}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-[var(--at-text-tertiary)] text-sm mt-8 animate-fade-in">
              <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center text-4xl opacity-40">🐱</div>
              <p className="font-medium text-[var(--at-text-secondary)]">开始与AI助手对话</p>
              <p className="text-xs mt-1">描述你想创建的台本，我来帮你完善</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <MessageRenderer
              key={msg.id}
              message={msg}
              isLatest={idx === messages.length - 1}
              onOptionSelect={handleOptionSelect}
              onCustomInput={handleCustomInput}
            />
          ))}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-[var(--at-border)]">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter发送)"
            className="flex-1 px-3 py-2 resize-none text-sm rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] text-[var(--at-text)] placeholder:text-[var(--at-text-tertiary)] focus:outline-none focus:border-[var(--at-border-focus)] transition-colors"
            rows={2}
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="h-auto"
            variant="accent"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
