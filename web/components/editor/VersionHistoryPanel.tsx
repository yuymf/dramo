'use client';

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Version {
  id: string;
  createdAt: string;
  snapshot: string;
}

interface Props {
  versions: Version[];
  loading: boolean;
  onRevert: (versionId: string) => void;
}

export function VersionHistoryPanel({ versions, loading, onRevert }: Props) {
  if (loading) {
    return (
      <div role="status" className="space-y-2 p-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">暂无版本记录</p>;
  }

  return (
    <ul className="divide-y">
      {versions.map((v) => (
        <li key={v.id} className="flex items-center justify-between p-3">
          <span className="text-sm">
            {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true, locale: zhCN })}
          </span>
          <Button variant="outline" size="sm" onClick={() => onRevert(v.id)}>
            回退
          </Button>
        </li>
      ))}
    </ul>
  );
}
