import { useCallback } from 'react';
import {
  exportAsDOCX,
  exportAsPDF,
  exportAsMarkdown,
  exportAsJSON,
  downloadTextFile,
} from '@/lib/utils/exporter';
import { scriptToFountain, scriptToCsv } from '@/lib/utils/script-export-formats';
import type { Script } from '@/lib/models';

export type ExportFormat = 'docx' | 'pdf' | 'md' | 'json' | 'fountain' | 'csv';

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  docx: 'Word (.docx)',
  pdf: 'PDF (.pdf)',
  md: 'Markdown (.md)',
  json: 'JSON (.json)',
  fountain: 'Fountain (.fountain)',
  csv: '台词表 (.csv)',
};

/**
 * Hook that provides a unified `exportScript` function for all supported
 * export formats. Accepts a full `Script` object so that DOCX/PDF exporters
 * (which need `acts`, `scenes`, `createdAt`, etc.) receive the correct shape.
 */
export function useScriptExport(script: Script) {
  const exportScript = useCallback(
    async (format: ExportFormat): Promise<void> => {
      switch (format) {
        case 'docx':
          await exportAsDOCX(script);
          break;

        case 'pdf':
          await exportAsPDF(script);
          break;

        case 'json': {
          const json = exportAsJSON(script);
          downloadTextFile(json, `${script.title}.json`);
          break;
        }

        case 'md': {
          const md = exportAsMarkdown(script);
          downloadTextFile(md, `${script.title}.md`);
          break;
        }

        case 'fountain': {
          const fountain = scriptToFountain(script);
          downloadTextFile(fountain, `${script.title}.fountain`);
          break;
        }

        case 'csv': {
          const csv = scriptToCsv(script);
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${script.title}-dialogue.csv`;
          a.click();
          URL.revokeObjectURL(url);
          break;
        }
      }
    },
    [script]
  );

  return { exportScript };
}
