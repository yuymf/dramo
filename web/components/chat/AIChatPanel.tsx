/**
 * AI Chat Panel - Project-scoped AI conversation with JSON context
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Trash2, Loader2, Check, X as XIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import type { ChatMessage } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/Toast";
import { useAIChat } from "@/app/ai-chat-provider";
import { applyJsonByPageType } from "@/lib/utils/json-applier";
import { cn } from "@/lib/utils";

interface AIChatPanelProps {
  projectId: string;
  onClose?: () => void;
}

export function AIChatPanel({ projectId, onClose }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [applyingChanges, setApplyingChanges] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const {
    currentPageType,
    currentJsonData,
    pendingChanges,
    setPendingChanges,
    clearPendingChanges
  } = useAIChat();

  // 加载历史消息
  useEffect(() => {
    async function loadHistory() {
      if (!projectId) return;

      try {
        // 先检查是否有从home页面传递的初始消息
        const initialMessageKey = `project_${projectId}_initialMessage`;
        const initialMessage = sessionStorage.getItem(initialMessageKey);

        if (initialMessage) {
          // 如果有初始消息，创建用户消息并添加到消息列表
          const userMessage: ChatMessage = {
            id: `msg_${Date.now()}_user`,
            role: "user",
            content: initialMessage,
            createdAt: new Date().toISOString(),
          };

          // 清除sessionStorage中的初始消息
          sessionStorage.removeItem(initialMessageKey);

          // 设置消息列表，包含用户消息
          setMessages([userMessage]);
          setInitialLoading(false);

          // 自动发送消息给AI获取回复
          try {
            const res = await api<{
              userMessage: ChatMessage;
              assistantMessage: ChatMessage;
            }>(`/api/chat/${projectId}/messages`, {
              method: "POST",
              body: {
                role: "user",
                content: initialMessage,
              },
            });

            setMessages([res.userMessage, res.assistantMessage]);
          } catch (err) {
            console.error("Failed to send initial message:", err);
          }

          return;
        }

        // 没有初始消息，正常加载历史消息
        const res = await api<{ data: ChatMessage[] }>(
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
  }, [projectId]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    try {
      // 构建请求体，包含当前页面的JSON上下文
      const requestBody: {
        role: string;
        content: string;
        context?: {
          pageType: string;
          data: object | null;
        };
      } = {
        role: "user",
        content: userMessage,
      };

      // 如果有当前页面的JSON数据，添加到上下文中
      if (currentPageType && currentJsonData) {
        requestBody.context = {
          pageType: currentPageType,
          data: currentJsonData,
        };
      }

      const res = await api<{
        userMessage: ChatMessage;
        assistantMessage: ChatMessage & {
          suggestedChanges?: {
            type: string;
            data: object;
          };
        };
      }>(`/api/chat/${projectId}/messages`, {
        method: "POST",
        body: requestBody,
      });

      setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);

      // 如果AI返回了修改建议，设置待处理的修改
      if (res.assistantMessage.suggestedChanges && currentPageType) {
        setPendingChanges({
          type: currentPageType,
          originalData: currentJsonData,
          suggestedData: res.assistantMessage.suggestedChanges.data,
        });
      }
    } catch (err) {
      showToast((err as Error).message, "error");
      setInput(userMessage); // 恢复输入
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("确定要清空对话历史吗？")) return;

    try {
      await api(`/api/chat/${projectId}/reset`, {
        method: "POST",
      });
      setMessages([]);
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

  // 处理Keep修改
  const handleKeepChanges = async () => {
    if (!pendingChanges || !pendingChanges.type || !pendingChanges.suggestedData) {
      return;
    }

    setApplyingChanges(true);
    try {
      await applyJsonByPageType(projectId, pendingChanges.type, pendingChanges.suggestedData);
      showToast("修改已应用", "success");
      clearPendingChanges();

      // 触发页面刷新（通过window.location或事件）
      window.dispatchEvent(new CustomEvent('ai-chat-data-updated', {
        detail: { pageType: pendingChanges.type }
      }));
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setApplyingChanges(false);
    }
  };

  // 处理Undo修改
  const handleUndoChanges = () => {
    clearPendingChanges();
    showToast("已取消修改", "info");
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--at-bg)]">
        <div className="text-center animate-fade-in">
          <div className="w-8 h-8 mx-auto mb-2 text-3xl opacity-40">🐱</div>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--at-text-tertiary)]" />
          <p className="text-sm mt-2 text-[var(--at-text-tertiary)]">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--at-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--at-border)] bg-[var(--at-bg)]">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐱</span>
          <h2 className="text-base font-semibold text-[var(--at-text)]">AI 助手</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={messages.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            清空
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="ghost" size="sm" className="text-xs">
              关闭
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-[var(--at-text-tertiary)] text-sm mt-8 animate-fade-in">
              <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center text-4xl opacity-40">🐱</div>
              <p className="font-medium text-[var(--at-text-secondary)]">开始与AI助手对话</p>
              <p className="text-xs mt-1 text-[var(--at-text-tertiary)]">可以询问剧本创作建议、内容优化等</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            // 检查这条消息是否有待处理的修改
            const hasPendingChanges =
              idx === messages.length - 1 &&
              msg.role === "assistant" &&
              pendingChanges !== null;

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-xl px-4 py-2.5",
                    msg.role === "user"
                      ? "bg-[var(--at-accent)] text-[var(--at-text-inverse)]"
                      : "bg-[var(--at-surface)] border border-[var(--at-border)] text-[var(--at-text)]",
                    hasPendingChanges && "ring-2 ring-[var(--at-accent)]",
                    "relative"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>
                    {msg.content}
                  </p>

                  {msg.blocks && msg.blocks.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--at-border-light)] space-y-1">
                      {msg.blocks.map((block, blockIdx) => (
                        <div key={blockIdx} className="text-xs opacity-70">
                          <span className="font-medium">{block.label}:</span>{" "}
                          <span>
                            {block.text.substring(0, 50)}...
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Keep/Undo buttons */}
                  {hasPendingChanges && (
                    <div className="mt-3 pt-3 border-t border-[var(--at-border-light)] flex gap-2">
                      <Button
                        onClick={handleKeepChanges}
                        disabled={applyingChanges}
                        size="sm"
                        variant="accent"
                        className="flex-1"
                      >
                        {applyingChanges ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            应用中...
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            保留修改
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleUndoChanges}
                        disabled={applyingChanges}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        <XIcon className="w-3 h-3 mr-1" />
                        撤销
                      </Button>
                    </div>
                  )}

                  <p className="text-xs opacity-50 mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-4 border-t border-[var(--at-border)] bg-[var(--at-bg)]">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter发送，Shift+Enter换行)"
            className="flex-1 px-3 py-2 resize-none text-sm rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] text-[var(--at-text)] placeholder:text-[var(--at-text-tertiary)] focus:outline-none focus:border-[var(--at-border-focus)] transition-colors"
            rows={3}
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
        <p className="text-xs mt-2 text-[var(--at-text-tertiary)]">
          {currentPageType
            ? `当前页面：${currentPageType === 'script' ? '台本' : currentPageType === 'characters' ? '角色' : currentPageType === 'locations' ? '地点' : '分镜'} · AI可以修改当前页面的数据`
            : '提示：可以向AI助手请教剧本创作建议、内容优化等'}
        </p>
      </div>
    </div>
  );
}
