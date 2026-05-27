'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, MessageSquare, Trash2, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  listSessions,
  createSession,
  deleteSession,
  renameSession,
  migrateLegacyMessages,
  type ChatSession,
} from '@/lib/api/chat-sessions';

interface SessionSidebarProps {
  projectId: string;
  activeSessionId: string | null;
  onSessionChange: (sessionId: string | null) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/** Track which projects have already been migrated (survives re-mounts). */
const migratedProjects = new Set<string>();

export function SessionSidebar({
  projectId,
  activeSessionId,
  onSessionChange,
  collapsed = true,
  onToggleCollapse,
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Stable refs to avoid dependency cycles
  const onSessionChangeRef = useRef(onSessionChange);
  onSessionChangeRef.current = onSessionChange;
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  // Load sessions once per projectId (not on every activeSessionId change)
  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Migrate legacy messages only once per project per page session
        if (!migratedProjects.has(projectId)) {
          try {
            await migrateLegacyMessages(projectId);
            migratedProjects.add(projectId); // Only mark as done on success
          } catch {
            // Non-critical — will retry on next mount
          }
        }

        const data = await listSessions(projectId);
        if (cancelled) return;
        setSessions(data);

        // Auto-select first session if none is active
        if (!activeSessionIdRef.current && data.length > 0) {
          onSessionChangeRef.current(data[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load sessions:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [projectId]); // Only depends on projectId — no cycle

  const handleCreate = async () => {
    try {
      const session = await createSession(projectId);
      setSessions((prev) => [session, ...prev]);
      onSessionChange(session.id);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个对话吗？')) return;

    try {
      await deleteSession(projectId, sessionId);
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);
        if (activeSessionId === sessionId) {
          // Use setTimeout to avoid setState-during-render
          setTimeout(() => {
            onSessionChange(remaining.length > 0 ? remaining[0].id : null);
          }, 0);
        }
        return remaining;
      });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleStartRename = (sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(sessionId);
    setEditTitle(currentTitle);
  };

  const handleRename = async (sessionId: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const updated = await renameSession(projectId, sessionId, editTitle.trim());
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: updated.title } : s))
      );
    } catch (err) {
      console.error('Failed to rename session:', err);
    } finally {
      setEditingId(null);
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--at-surface)] transition-colors"
        title="展开对话列表"
      >
        <ChevronRight className="w-4 h-4 text-[var(--at-text-secondary)]" />
      </button>
    );
  }

  return (
    <div className="w-56 border-r border-[var(--at-border)] bg-[var(--at-bg)] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--at-border)]">
        <span className="text-xs font-medium text-[var(--at-text-secondary)]">对话列表</span>
        <div className="flex items-center gap-1">
          <Button
            onClick={handleCreate}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="新对话"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <button
            onClick={onToggleCollapse}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--at-surface)] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-[var(--at-text-secondary)]" />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && sessions.length === 0 && (
          <p className="text-xs text-center text-[var(--at-text-tertiary)] py-4">加载中...</p>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-[var(--at-text-tertiary)]">暂无对话</p>
            <Button
              onClick={handleCreate}
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              新对话
            </Button>
          </div>
        )}

        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSessionChange(session.id)}
            className={cn(
              'group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
              activeSessionId === session.id
                ? 'bg-[var(--at-surface)] border-r-2 border-[var(--at-accent)]'
                : 'hover:bg-[var(--at-surface-hover,rgba(0,0,0,0.03))]'
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[var(--at-text-tertiary)]" />

            {editingId === session.id ? (
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => handleRename(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(session.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="flex-1 text-xs bg-transparent border-b border-[var(--at-border)] outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="flex-1 text-xs truncate text-[var(--at-text)]">
                {session.title}
              </span>
            )}

            {/* Actions — visible on hover */}
            {editingId !== session.id && (
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button
                  onClick={(e) => handleStartRename(session.id, session.title, e)}
                  className="p-0.5 rounded hover:bg-[var(--at-surface)] transition-colors"
                >
                  <Pencil className="w-3 h-3 text-[var(--at-text-tertiary)]" />
                </button>
                <button
                  onClick={(e) => handleDelete(session.id, e)}
                  className="p-0.5 rounded hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
