"use client";

import { useCallback, useState } from "react";
import type { ScreenplayDoc } from "@/lib/types/screenplay";
import {
  exportDocx,
  exportPdf,
  exportTxt,
  type ScriptExportKind,
} from "@/lib/utils/screenplay-export";

export function useScriptExport(doc: ScreenplayDoc | null | undefined) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportKind = useCallback(
    async (kind: ScriptExportKind) => {
      if (!doc) return;
      setBusy(true);
      setError(null);
      try {
        if (kind === "txt") exportTxt(doc);
        else if (kind === "pdf") await exportPdf(doc);
        else await exportDocx(doc);
      } catch (err) {
        setError(err instanceof Error ? err.message : "导出失败");
      } finally {
        setBusy(false);
      }
    },
    [doc]
  );

  return { busy, error, exportKind };
}
