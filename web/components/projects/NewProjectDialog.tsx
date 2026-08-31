"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, FileText, X } from "lucide-react";
import { createProject } from "@/lib/api/projects";
import { importFdx } from "@/lib/api/preproduction";
import {
  CINEMA_ASPECT_RATIOS,
  DEFAULT_CINEMA_SETTINGS,
  type CinemaSettings,
} from "@/lib/types/cinema";
import { cn } from "@/lib/utils";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (projectId: string) => void;
}

type CardId = "script" | "cinema";

export function NewProjectDialog({
  open,
  onClose,
  onSuccess,
}: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [card, setCard] = useState<CardId>("script");
  const [cinema, setCinema] = useState<CinemaSettings>(DEFAULT_CINEMA_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const create = async (type: "script" | "cinema" | "spoken") => {
    if (!name.trim()) {
      setError("请输入项目名称");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const project = await createProject(name.trim(), {
        type,
        cinemaSettings: type === "cinema" ? cinema : undefined,
      });
      onSuccess?.(project.id);
      onClose();
      router.replace(
        type === "cinema"
          ? `/projects/${project.id}/reels`
          : type === "spoken"
            ? `/projects/${project.id}/spoken`
            : `/projects/${project.id}/screenplay`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建项目失败");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(26, 26, 24, 0.3)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-labelledby="new-project-title"
        aria-modal="true"
        className="relative w-full max-w-lg mx-4 p-8 rounded-2xl ink-reveal"
        style={{
          background: "linear-gradient(180deg, #fdfaf4 0%, #f8f5ef 100%)",
          boxShadow: "0 24px 80px rgba(26, 26, 24, 0.15), 0 8px 24px rgba(26, 26, 24, 0.08)",
          border: "1px solid rgba(26, 26, 24, 0.06)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            id="new-project-title"
            className="text-xl ink-display"
            style={{ color: "var(--ink-black)" }}
          >
            新建项目
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--rice-warm)]"
            style={{ color: "var(--ink-light)" }}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mb-5">
          <label
            htmlFor="project-name"
            className="block text-xs mb-3 ink-ui tracking-wider uppercase"
            style={{ color: "var(--ink-light)" }}
          >
            项目名称
          </label>
          <input
            ref={inputRef}
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入项目名称"
            className="ink-input ink-body"
            style={{ fontSize: "16px" }}
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5" role="group" aria-label="项目类型">
          {(
            [
              { id: "script" as const, title: "剧本项目", hint: "场次、对白、导出", icon: FileText },
              { id: "cinema" as const, title: "制片项目（Cinema）", hint: "Reel 五阶段成片", icon: Clapperboard },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = card === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCard(item.id)}
                className={cn("text-left rounded-xl border px-3 py-3", active ? "font-semibold" : "font-medium")}
                style={{
                  borderColor: active ? "#c2410c" : "rgba(26, 26, 24, 0.08)",
                  background: active ? "rgba(194, 65, 12, 0.06)" : "#fff",
                  color: "#1c1917",
                }}
              >
                <Icon size={16} strokeWidth={1.5} className="mb-2" />
                <span className="block text-sm">{item.title}</span>
                <span className="block text-[11px] mt-1" style={{ color: "#a8a29e" }}>
                  {item.hint}
                </span>
              </button>
            );
          })}
        </div>

        {card === "cinema" && (
          <div className="mb-5 space-y-3">
            <label className="block">
              <span className="text-xs" style={{ color: "#78716c" }}>
                画幅
              </span>
              <select
                aria-label="画幅"
                value={cinema.aspectRatio}
                onChange={(e) =>
                  setCinema((prev) => ({
                    ...prev,
                    aspectRatio: e.target.value as CinemaSettings["aspectRatio"],
                  }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "#e7e5e4", background: "#fff" }}
              >
                {CINEMA_ASPECT_RATIOS.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: "#78716c" }}>
                制片类型
              </span>
              <input
                aria-label="制片类型"
                value={cinema.productionKind}
                onChange={(e) => setCinema((prev) => ({ ...prev, productionKind: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "#e7e5e4" }}
              />
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: "#78716c" }}>
                摄影风格
              </span>
              <input
                aria-label="摄影风格"
                value={cinema.cameraStyle}
                onChange={(e) => setCinema((prev) => ({ ...prev, cameraStyle: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "#e7e5e4" }}
              />
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: "#78716c" }}>
                美术风格
              </span>
              <input
                aria-label="美术风格"
                value={cinema.artStyle}
                onChange={(e) => setCinema((prev) => ({ ...prev, artStyle: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "#e7e5e4" }}
              />
            </label>
          </div>
        )}

        {error && (
          <p className="mb-4 text-xs" style={{ color: "var(--persimmon)" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="ink-button-ghost ink-ui text-sm">
            取消
          </button>
          <button
            type="button"
            disabled={loading || !name.trim()}
            onClick={() => void create(card)}
            className="ink-button ink-ui text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? "创建中..." : card === "cinema" ? "创建制片项目" : "创建剧本项目"}
          </button>
        </div>

        <div
          className="mt-6 pt-4 text-center space-y-2"
          style={{ borderTop: "1px solid rgba(26, 26, 24, 0.06)" }}
        >
          {card === "script" && (
            <label className="block text-xs cursor-pointer" style={{ color: "#78716c" }}>
              从 FDX 导入（新建项目）
              <input
                aria-label="导入 FDX"
                type="file"
                accept=".fdx,application/xml,text/xml"
                className="sr-only"
                disabled={loading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLoading(true);
                  setError(null);
                  try {
                    const xml = await file.text();
                    const project = await importFdx(xml, name.trim() || file.name.replace(/\.fdx$/i, ""));
                    onSuccess?.(project.id);
                    onClose();
                    router.replace(`/projects/${project.id}/screenplay`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "导入 FDX 失败");
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => void create("spoken")}
            disabled={loading || !name.trim()}
            className="text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: "#a8a29e" }}
          >
            创建口播项目
          </button>
        </div>
      </div>
    </div>
  );
}
