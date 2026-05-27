'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  useScriptExport,
  EXPORT_FORMAT_LABELS,
  type ExportFormat,
} from '@/lib/hooks/useScriptExport';
import type { Script } from '@/lib/models';

const FORMATS = Object.entries(EXPORT_FORMAT_LABELS) as [ExportFormat, string][];

interface Props {
  script: Script;
}

/**
 * Dropdown menu that exposes all available script export formats.
 * Consistent with the MUJI-style UI (outline button, minimal visual weight).
 */
export function ExportMenu({ script }: Props) {
  const { exportScript } = useScriptExport(script);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          导出
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {FORMATS.map(([value, label]) => (
          <DropdownMenuItem
            key={value}
            onClick={() => void exportScript(value)}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
