"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, Trash2, MessageSquarePlus, Sparkles } from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";
import { useAIChat } from "@/app/ai-chat-provider";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { runPipeline } from "@/lib/pipeline-controller";
import { sanitizeMessage } from "@/lib/utils/sanitize-message";
import { TaskList } from "@/components/chat/TaskList";
import { MessageRenderer } from "@/components/chat/MessageRenderer";
import { StopButton } from "@/components/chat/StopButton";
import { SessionSidebar } from "@/components/chat/SessionSidebar";
import { useStreamingChat } from "@/lib/hooks/useStreamingChat";
import { createSession, renameSession } from "@/lib/api/chat-sessions";
import type { ExtendedChatMessage, StructuredRequirements } from "@/lib/types/chat";

const STREAMING_MESSAGE_ID = '__streaming__';
const AUTO_TITLE_MAX_LENGTH = 20;
const SUGGESTION_PROMPTS = [
  '帮我写一个美食探店直播台本',
  '我想做一期产品测评',
  '策划一场带货直播',
] as const;

interface ChatPanelProps {
  projectId: string;
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionTitledRef = useRef<Set<string>>(new Set());
  // Holds the resolve/reject pair for the script-confirm Promise
  const confirmResolveRef = useRef<(() => void) | null>(null);
  const confirmRejectRef = useRef<(() => void) | null>(null);
  const { showToast } = useToast();
  const { currentPageType, currentJsonData } = useAIChat();
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const initTasks = usePipelineStore((s) => s.initTasks);
  const updateTaskStatus = usePipelineStore((s) => s.updateTaskStatus);
  const setRequirements = usePipelineStore((s) => s.setRequirements);

  // Active session management
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const abortStreamRef = useRef<() => void>(() => {});

  // Stable callback for session changes — doesn't cause re-renders in SessionSidebar
  const handleSessionChange = useCallback((id: string | null) => {
    abortStreamRef.current();
    setLoading(false);
    setActiveSessionId(id);
    setMessages([]);
  }, []);

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
      onConfirmRequired: (_step) => {
        return new Promise<void>((resolve, reject) => {
          confirmResolveRef.current = resolve;
          confirmRejectRef.current = reject;

          // Inject a special confirm-script message into the chat
          const confirmMsg: ExtendedChatMessage = {
            id: `confirm_script_${Date.now()}`,
            role: 'assistant',
            content: '台本已生成！请在左侧查看并确认内容，然后点击「确认台本，继续生成」来提取角色、场景并生成分镜。',
            messageType: 'confirm_script',
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, confirmMsg]);
        });
      },
    });

    usePipelineStore.getState().setAbortController(controller);
  }, [projectId, updateTaskStatus, setRequirements]);

  const handleStreamDone = useCallback((payload: {
    content: string;
    options?: ExtendedChatMessage['options'];
    clarificationComplete?: StructuredRequirements;
  }) => {
    const safe = sanitizeMessage(payload);

    const finalMessage: ExtendedChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: safe.content,
      options: safe.options,
      clarificationComplete: safe.clarificationComplete,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => {
      const filtered = prev.filter((m) => m.id !== STREAMING_MESSAGE_ID);
      return [...filtered, finalMessage];
    });
    setLoading(false);

    if (safe.clarificationComplete) {
      handleClarificationComplete(safe.clarificationComplete);
    }
  }, [handleClarificationComplete]);

  const handleStreamError = useCallback((error: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== STREAMING_MESSAGE_ID));
    setLoading(false);
    showToast(error, 'error');
  }, [showToast]);

  const {
    sendStreamingMessage,
    streamingContent,
    isStreaming,
    streamingError,
    abort: abortStream,
  } = useStreamingChat({
    projectId,
    sessionId: activeSessionId,
    onStreamDone: handleStreamDone,
    onError: handleStreamError,
  });

  abortStreamRef.current = abortStream;
  const sendStreamingMessageRef = useRef(sendStreamingMessage);
  sendStreamingMessageRef.current = sendStreamingMessage;

  // Update streaming message in-place
  useEffect(() => {
    if (!isStreaming || !streamingContent) return;

    setMessages((prev) => {
      const existingIdx = prev.findIndex((m) => m.id === STREAMING_MESSAGE_ID);
      const streamingMsg: ExtendedChatMessage = {
        id: STREAMING_MESSAGE_ID,
        role: 'assistant',
        content: streamingContent,
        createdAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        return prev.map((m, i) => (i === existingIdx ? streamingMsg : m));
      }
      return [...prev, streamingMsg];
    });
  }, [isStreaming, streamingContent]);

  // Load history
  useEffect(() => {
    let cancelled = false;

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
          if (!cancelled) {
            setMessages([userMsg]);
            setInitialLoading(false);
          }

          try {
            const session = activeSessionId ?? (await createSession(projectId)).id;
            if (!cancelled && !activeSessionId) setActiveSessionId(session);
            if (!cancelled) {
              await sendStreamingMessageRef.current({
                role: "user",
                content: initialMessage,
                mode: "clarification",
                sessionId: session,
              });
            }
          } catch (err) {
            console.error("Failed to send initial message:", err);
          }
          return;
        }

        if (!activeSessionId) {
          if (!cancelled) setMessages([]);
          return;
        }
        const res = await api<{ data: ExtendedChatMessage[] }>(
          `/api/chat/${projectId}/messages?sessionId=${activeSessionId}`
        ).catch(() => ({ data: [] as ExtendedChatMessage[] }));
        if (!cancelled) {
          setMessages(res.data || []);
        }
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        if (status === 404) {
          console.warn(`[ChatPanel] Project ${projectId} not found — may be a stale link`);
        } else if (status === 401) {
          console.warn('[ChatPanel] Not authenticated — redirecting to login');
        } else {
          console.error('[ChatPanel] Failed to load chat history:', err);
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [projectId, activeSessionId, initTasks, updateTaskStatus]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-title session with first user message
  const autoTitleSession = useCallback(async (sessionId: string, message: string) => {
    if (sessionTitledRef.current.has(sessionId)) return;
    sessionTitledRef.current.add(sessionId);
    const title = message.slice(0, AUTO_TITLE_MAX_LENGTH) + (message.length > AUTO_TITLE_MAX_LENGTH ? '...' : '');
    try {
      await renameSession(projectId, sessionId, title);
    } catch (err) {
      console.warn('[ChatPanel] Auto-title failed:', err);
    }
  }, [projectId]);

  const ensureSession = useCallback(async () => {
    if (activeSessionId) return activeSessionId;
    const session = await createSession(projectId);
    setActiveSessionId(session.id);
    return session.id;
  }, [activeSessionId, projectId]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    const optimisticUserMsg: ExtendedChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);

    let sessionId = activeSessionId;
    try {
      sessionId = await ensureSession();
    } catch (err) {
      showToast((err as Error).message, "error");
      setInput(userMessage);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      setLoading(false);
      return;
    }

    if (sessionId && messages.length === 0) {
      autoTitleSession(sessionId, userMessage);
    }

    const requestBody: Record<string, unknown> = {
      role: "user",
      content: userMessage,
      sessionId,
    };

    if (currentPageType && currentJsonData) {
      requestBody.context = { pageType: currentPageType, data: currentJsonData };
    }

    if (pipelineStatus === 'clarifying') {
      requestBody.mode = 'clarification';
    }

    try {
      await sendStreamingMessage(requestBody);
    } catch (err) {
      showToast((err as Error).message, "error");
      setInput(userMessage);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
    } finally {
      setLoading(false);
    }
  }, [input, loading, currentPageType, currentJsonData, pipelineStatus, showToast, sendStreamingMessage, activeSessionId, messages.length, autoTitleSession, ensureSession]);

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

    let sessionId = activeSessionId;
    try {
      sessionId = await ensureSession();
    } catch (err) {
      showToast((err as Error).message, "error");
      setLoading(false);
      return;
    }

    const requestBody: Record<string, unknown> = {
      role: "user",
      content: selectedLabels,
      mode: pipelineStatus === 'clarifying' ? 'clarification' : undefined,
      selectedOption: selected,
      sessionId,
    };

    const optimisticUserMsg: ExtendedChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: selectedLabels,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);

    try {
      await sendStreamingMessage(requestBody);
    } catch (err) {
      showToast((err as Error).message, "error");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
    } finally {
      setLoading(false);
    }
  }, [messages, pipelineStatus, showToast, sendStreamingMessage, activeSessionId, ensureSession]);

  const handleCustomInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  /** Resolve the confirm-script gate so the pipeline can proceed. */
  const handleConfirmScript = useCallback(() => {
    confirmResolveRef.current?.();
    confirmResolveRef.current = null;
    confirmRejectRef.current = null;
    // Replace the confirm message with a plain "confirmed" note
    setMessages((prev) =>
      prev.map((m) =>
        m.messageType === 'confirm_script'
          ? { ...m, messageType: 'progress' as const, content: '已确认台本，开始提取角色与场景…' }
          : m
      )
    );
  }, []);

  const handleReset = useCallback(async () => {
    if (!confirm("确定要清空对话历史吗？")) return;

    if (!activeSessionId) {
      setMessages([]);
      usePipelineStore.getState().reset();
      return;
    }

    try {
      await api(`/api/chat/${projectId}/reset`, {
        method: "POST",
        body: { sessionId: activeSessionId },
      });
      setMessages([]);
      usePipelineStore.getState().reset();
      showToast("对话历史已清空", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }, [projectId, activeSessionId, showToast]);

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

  return (
    <div className="flex h-full overflow-hidden">
      {/* Session sidebar */}
      <SessionSidebar
        projectId={projectId}
        activeSessionId={activeSessionId}
        onSessionChange={handleSessionChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* Main chat column — fixed height, no overflow */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden" style={{ background: 'var(--chat-panel-bg, var(--at-bg))' }}>

        {initialLoading ? (
          /* Loading state */
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <div className="text-3xl mb-3 opacity-30 animate-pulse">🐱</div>
              <Loader2 className="w-4 h-4 animate-spin mx-auto text-[var(--at-text-tertiary)]" />
            </div>
          </div>
        ) : (
          <>
            {/* ── Header ─────────────────────────────────── */}
            <div className="chat-panel-header flex items-center justify-between px-4 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="chat-cat-avatar">
                  <span className="text-base leading-none">🐱</span>
                </div>
                <div>
                  <h2 className="text-xs font-semibold tracking-wider text-[var(--at-text)] uppercase" style={{ letterSpacing: '0.08em' }}>
                    AI 助手
                  </h2>
                  {(isStreaming || loading) && (
                    <p className="text-[10px] text-[var(--at-accent)] flex items-center gap-1 mt-0.5">
                      <span className="inline-block w-1 h-1 rounded-full bg-[var(--at-accent)] animate-pulse" />
                      正在输入…
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={async () => {
                    try {
                      const session = await createSession(projectId);
                      handleSessionChange(session.id);
                    } catch (err) { console.warn('[ChatPanel] Create session failed:', err); }
                  }}
                  className="chat-icon-btn"
                  title="新对话"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                </button>

                <StopButton />

                {isStreaming && (
                  <button
                    onClick={abortStream}
                    className="chat-icon-btn text-red-400 hover:text-red-600 hover:bg-red-50"
                    title="停止生成"
                  >
                    <span className="text-[10px] font-medium">停止</span>
                  </button>
                )}

                <button
                  onClick={handleReset}
                  disabled={messages.length === 0}
                  className="chat-icon-btn disabled:opacity-30 disabled:cursor-not-allowed"
                  title="清空对话"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Pipeline task list ─────────────────────── */}
            <TaskList onTaskClick={handleTaskClick} />

            {/* ── Messages area — scrollable, height-bounded ─ */}
            <div
              ref={messagesContainerRef}
              className="chat-messages-area flex-1 overflow-y-auto min-h-0"
            >
              <div className="px-4 py-5 space-y-3">

                {/* Empty state */}
                {messages.length === 0 && (
                  <div className="chat-empty-state text-center py-8">
                    <div className="chat-empty-cat">🐱</div>
                    <p className="text-sm font-medium text-[var(--at-text-secondary)] mt-3 mb-1">
                      开始与 AI 助手对话
                    </p>
                    <p className="text-xs text-[var(--at-text-tertiary)] mb-5">
                      描述你想创建的台本，我来帮你完善
                    </p>

                    {/* Suggestion chips */}
                    <div className="flex flex-col gap-2 items-stretch">
                      {SUGGESTION_PROMPTS.map((suggestion, i) => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setInput(suggestion);
                            inputRef.current?.focus();
                          }}
                          className="chat-suggestion-chip"
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          <Sparkles className="w-3 h-3 shrink-0 text-[var(--at-accent)] opacity-70" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Streaming error */}
                {streamingError && (
                  <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-red-50 border border-red-100">
                    <span className="text-xs text-red-500 flex-1">{streamingError}</span>
                    <button
                      onClick={() => {
                        const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
                        if (lastUserMsg) setInput(lastUserMsg.content);
                      }}
                      className="text-xs text-[var(--at-accent)] hover:underline shrink-0"
                    >
                      重试
                    </button>
                  </div>
                )}

                {/* Messages */}
                {messages.map((msg, idx) => (
                  <MessageRenderer
                    key={msg.id}
                    message={msg}
                    isLatest={idx === messages.length - 1}
                    isStreaming={isStreaming && msg.id === STREAMING_MESSAGE_ID}
                    onOptionSelect={handleOptionSelect}
                    onCustomInput={handleCustomInput}
                    onConfirmScript={handleConfirmScript}
                  />
                ))}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* ── Input area ─────────────────────────────── */}
            <div className="chat-input-area shrink-0 border-t border-[var(--at-border)] bg-[var(--at-surface)] px-3 py-3">
              <div className="chat-input-wrapper">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息… (Enter 发送)"
                  className="chat-textarea"
                  rows={2}
                  disabled={loading || isStreaming}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading || isStreaming}
                  className="chat-send-btn"
                  aria-label="发送"
                >
                  {loading || isStreaming ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-[var(--at-text-tertiary)] mt-1.5 px-1">
                Enter 发送 · Shift+Enter 换行
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
