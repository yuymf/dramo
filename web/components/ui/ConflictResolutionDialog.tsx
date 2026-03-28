/**
 * Conflict Resolution Dialog
 * 网络恢复后，本地与服务器数据冲突时的解决对话框
 */
"use client";

import { useState } from "react";
import { AlertTriangle, Download, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConflictResolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: (strategy: 'local' | 'remote') => Promise<void>;
  conflictType: 'characters' | 'locations' | 'script';
  localCount?: number;
  remoteCount?: number;
  localTimestamp?: string;
  remoteTimestamp?: string;
}

export function ConflictResolutionDialog({
  isOpen,
  onClose,
  onResolve,
  conflictType,
  localCount,
  remoteCount,
  localTimestamp,
  remoteTimestamp,
}: ConflictResolutionDialogProps) {
  const [resolving, setResolving] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<'local' | 'remote' | null>(null);

  if (!isOpen) return null;

  const conflictTypeText = {
    characters: '角色',
    locations: '地点',
    script: '剧本',
  }[conflictType];

  const handleResolve = async () => {
    if (!selectedStrategy) return;
    
    setResolving(true);
    try {
      await onResolve(selectedStrategy);
      onClose();
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-900">数据冲突</h2>
          </div>
          <button
            onClick={onClose}
            disabled={resolving}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            检测到本地{conflictTypeText}数据与服务器不一致。请选择以哪个版本为准：
          </p>

          {/* Option 1: Local */}
          <button
            onClick={() => setSelectedStrategy('local')}
            disabled={resolving}
            className={`w-full p-4 border-2 rounded-lg text-left transition-all disabled:opacity-50 ${
              selectedStrategy === 'local'
                ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 p-2 rounded-lg ${
                selectedStrategy === 'local' ? 'bg-[var(--brand-100)]' : 'bg-slate-100'
              }`}>
                <Upload className={`w-5 h-5 ${
                  selectedStrategy === 'local' ? 'text-[var(--brand-600)]' : 'text-slate-500'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">以本地为准</h3>
                <p className="text-sm text-slate-600">
                  将本地更改上传到服务器，覆盖服务器数据
                </p>
                {localCount !== undefined && (
                  <p className="text-xs text-slate-500 mt-2">
                    本地数据：{localCount} 项
                    {localTimestamp && ` · 最后更新 ${new Date(localTimestamp).toLocaleString('zh-CN')}`}
                  </p>
                )}
              </div>
            </div>
          </button>

          {/* Option 2: Remote */}
          <button
            onClick={() => setSelectedStrategy('remote')}
            disabled={resolving}
            className={`w-full p-4 border-2 rounded-lg text-left transition-all disabled:opacity-50 ${
              selectedStrategy === 'remote'
                ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 p-2 rounded-lg ${
                selectedStrategy === 'remote' ? 'bg-[var(--brand-100)]' : 'bg-slate-100'
              }`}>
                <Download className={`w-5 h-5 ${
                  selectedStrategy === 'remote' ? 'text-[var(--brand-600)]' : 'text-slate-500'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">以服务器为准</h3>
                <p className="text-sm text-slate-600">
                  从服务器下载最新数据，丢弃本地未同步的更改
                </p>
                {remoteCount !== undefined && (
                  <p className="text-xs text-slate-500 mt-2">
                    服务器数据：{remoteCount} 项
                    {remoteTimestamp && ` · 最后更新 ${new Date(remoteTimestamp).toLocaleString('zh-CN')}`}
                  </p>
                )}
              </div>
            </div>
          </button>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              此操作不可撤销。建议选择时间戳较新的版本。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={resolving}
          >
            取消
          </Button>
          <Button
            onClick={handleResolve}
            disabled={!selectedStrategy || resolving}
            className="min-w-[100px]"
          >
            {resolving ? '处理中...' : '确认'}
          </Button>
        </div>
      </div>
    </div>
  );
}

