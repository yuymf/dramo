"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createProject } from "@/lib/api/projects";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (projectId: string) => void;
}

export function NewProjectDialog({
  open,
  onClose,
  onSuccess,
}: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!name.trim()) {
      setError("请输入项目名称");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const project = await createProject(name.trim(), { type: "script" });
      onSuccess?.(project.id);
      onClose();
      router.replace(`/projects/${project.id}/screenplay`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建项目失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSpoken = async () => {
    if (!name.trim()) {
      setError("请输入项目名称");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const project = await createProject(name.trim(), { type: "spoken" });
      onSuccess?.(project.id);
      onClose();
      router.replace(`/projects/${project.id}/spoken`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建项目失败");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(26, 26, 24, 0.3)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-labelledby="new-project-title"
        aria-modal="true"
        className="relative w-full max-w-md mx-4 p-8 rounded-2xl ink-reveal"
        style={{
          background: "linear-gradient(180deg, #fdfaf4 0%, #f8f5ef 100%)",
          boxShadow: "0 24px 80px rgba(26, 26, 24, 0.15), 0 8px 24px rgba(26, 26, 24, 0.08)",
          border: "1px solid rgba(26, 26, 24, 0.06)",
        }}
      >
        {/* Header */}
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

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
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
              onKeyDown={handleKeyDown}
              placeholder="输入项目名称并按 Enter"
              className="ink-input ink-body"
              style={{ fontSize: "16px" }}
              disabled={loading}
            />
            {error && (
              <p
                className="mt-3 text-xs"
                style={{ color: "var(--persimmon)" }}
              >
                {error}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="ink-button-ghost ink-ui text-sm"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="ink-button ink-ui text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? "创建中..." : "创建剧本项目"}
            </button>
          </div>
        </form>

        <div
          className="mt-6 pt-4 text-center"
          style={{ borderTop: "1px solid rgba(26, 26, 24, 0.06)" }}
        >
          <button
            type="button"
            onClick={() => void handleCreateSpoken()}
            disabled={loading}
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
