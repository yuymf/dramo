'use client';

import { useEffect } from 'react';
import type { Script } from '@/lib/models';

type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

interface ScriptEditorShellProps {
  script: Pick<Script, 'id' | 'title' | 'form'>;
  children: React.ReactNode;
  onSave: () => void;
  saveStatus: SaveStatus;
}

export function ScriptEditorShell({
  script,
  children,
  onSave,
  saveStatus,
}: ScriptEditorShellProps) {
  // Register Cmd+S / Ctrl+S keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  const statusLabel: Record<SaveStatus, string> = {
    saved: '已保存',
    saving: '保存中…',
    error: '保存失败',
    unsaved: '未保存',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h1 className="text-sm font-medium truncate">{script.title}</h1>
        <span className="text-xs text-muted-foreground">{statusLabel[saveStatus]}</span>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
