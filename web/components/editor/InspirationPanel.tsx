'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface Inspiration {
  id: string;
  content: string;
  createdAt: string;
}

interface Props {
  inspirations: Inspiration[];
  loading: boolean;
  onAdd: (content: string) => void;
  onDelete: (id: string) => void;
}

export function InspirationPanel({ inspirations, loading, onAdd, onDelete }: Props) {
  const [draft, setDraft] = useState('');

  if (loading) {
    return (
      <div role="status" className="space-y-2 p-4">
        {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          placeholder="添加灵感…"
        />
        <Button
          size="sm"
          onClick={() => { onAdd(draft); setDraft(''); }}
          disabled={!draft.trim()}
        >
          添加
        </Button>
      </div>
      <ul className="space-y-2">
        {inspirations.map((ins) => (
          <li key={ins.id} className="flex items-start justify-between p-2 bg-muted rounded-md">
            <span className="text-sm">{ins.content}</span>
            <Button variant="ghost" size="sm" onClick={() => onDelete(ins.id)}>×</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
