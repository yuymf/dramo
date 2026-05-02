'use client';

import { Button } from '@/components/ui/button';
import { useAIDirector } from '@/lib/hooks/useAIDirector';

const severityClasses: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-[var(--at-surface-sunken)] text-[var(--at-text-secondary)]',
  medium: 'bg-[var(--at-accent)]/10 text-[var(--at-accent)]',
  high: 'bg-[var(--at-error)]/10 text-[var(--at-error)]',
};

const typeLabels: Record<string, string> = {
  pacing: '节奏',
  character: '角色',
  conflict: '冲突',
};

interface Props {
  projectId: string;
  scriptId: string;
  scriptContext: unknown;
}

export function AIDirectorPanel({ projectId, scriptId, scriptContext }: Props) {
  const { suggestions, isStreaming, error, analyze } = useAIDirector(projectId, scriptId);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">AI 导演分析</h3>
        <Button
          size="sm"
          onClick={() => { void analyze(scriptContext); }}
          disabled={isStreaming}
        >
          {isStreaming ? '分析中…' : '开始分析'}
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--at-error)]">{error}</p>}

      {suggestions.length === 0 && !isStreaming && (
        <p className="text-sm text-[var(--at-text-secondary)]">
          点击「开始分析」获取剧本结构建议
        </p>
      )}

      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="p-3 rounded-md bg-[var(--at-surface-sunken)] text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${severityClasses[s.severity] ?? severityClasses.low}`}
              >
                {typeLabels[s.type] ?? s.type}
              </span>
              <span className="text-xs text-[var(--at-text-secondary)]">
                场景 {s.sceneIndex + 1}
              </span>
            </div>
            <p>{s.suggestion}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
