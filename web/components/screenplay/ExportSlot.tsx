"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useScriptExport } from "@/lib/hooks/useScriptExport";
import type { ScreenplayDoc } from "@/lib/types/screenplay";
import { SCRIPT_EXPORT_KINDS } from "@/lib/utils/screenplay-export";

const LABELS: Record<(typeof SCRIPT_EXPORT_KINDS)[number], string> = {
  txt: "TXT",
  pdf: "PDF",
  docx: "DOCX",
};

export function ExportSlot({
  doc,
  disabled,
}: {
  doc?: ScreenplayDoc | null;
  disabled?: boolean;
}) {
  const { busy, error, exportKind } = useScriptExport(doc);
  const unavailable = disabled || !doc || busy;

  return (
    <div className="sp-export-slot">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={unavailable}
            aria-label="导出 TXT PDF DOCX"
            title={error ?? "导出剧本"}
          >
            <Download size={14} />
            {busy ? "导出中…" : "导出"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {SCRIPT_EXPORT_KINDS.map((kind) => (
            <DropdownMenuItem
              key={kind}
              disabled={unavailable}
              onClick={() => {
                void exportKind(kind);
              }}
            >
              {LABELS[kind]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
