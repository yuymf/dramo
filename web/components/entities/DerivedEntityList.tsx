"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import {
  buildEntityPrompt,
  createEntityImage,
  getGenerationTask,
  imageUrls,
  isTerminalStatus,
  listDerivedEntities,
  patchEntityDescription,
  taskJobId,
  type DerivedEntity,
  type DerivedEntityKind,
  type ImageGenerationKind,
} from "@/lib/api/entities";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 90_000;

const COPY: Record<
  DerivedEntityKind,
  {
    title: string;
    hint: string;
    generateLabel: string;
    imageKind: ImageGenerationKind;
  }
> = {
  character: {
    title: "角色",
    hint: "从剧本角色行推导，可补描述并生成肖像",
    generateLabel: "生成肖像",
    imageKind: "portrait",
  },
  location: {
    title: "地点",
    hint: "从场次标题推导，可补描述并生成场景图",
    generateLabel: "生成场景图",
    imageKind: "location",
  },
};

export interface DerivedEntityListProps {
  projectId: string;
  kind: DerivedEntityKind;
}

export function DerivedEntityList({ projectId, kind }: DerivedEntityListProps) {
  const copy = COPY[kind];
  const { showToast } = useToast();
  const [entities, setEntities] = useState<DerivedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    try {
      const rows = await listDerivedEntities(kind, projectId);
      setEntities(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [kind, projectId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  const handlePatched = useCallback((next: DerivedEntity) => {
    setEntities((prev) => prev.map((row) => (row.id === next.id ? next : row)));
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="m-0 text-[15px] font-semibold tracking-wide">{copy.title}</h1>
          <span className="text-xs text-[var(--at-text-tertiary)]">{copy.hint}</span>
        </div>
        <span className="text-xs font-medium text-[var(--at-accent)] bg-[var(--at-accent-light)] px-2 py-0.5 rounded-full shrink-0">
          {entities.length}
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm text-[var(--at-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : error ? (
          <div className="max-w-xl mx-auto text-center py-16">
            <p className="text-sm text-[var(--at-error)]">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
              重试
            </Button>
          </div>
        ) : entities.length === 0 ? (
          <EmptyState projectId={projectId} />
        ) : (
          <ul className="max-w-3xl mx-auto space-y-4">
            {entities.map((entity) => (
              <li key={entity.id}>
                <EntityCard
                  entity={entity}
                  kind={kind}
                  projectId={projectId}
                  generateLabel={copy.generateLabel}
                  imageKind={copy.imageKind}
                  onPatched={handlePatched}
                  onImagesMayChange={() => void load()}
                  showToast={showToast}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-20">
      <p className="text-sm text-[var(--at-text-secondary)] leading-relaxed">
        去
        <Link
          href={`/projects/${projectId}/screenplay`}
          className="text-[var(--at-accent)] underline-offset-4 hover:underline mx-0.5"
        >
          剧本页
        </Link>
        写下场次标题和角色名后回到这里
      </p>
    </div>
  );
}

interface EntityCardProps {
  entity: DerivedEntity;
  kind: DerivedEntityKind;
  projectId: string;
  generateLabel: string;
  imageKind: ImageGenerationKind;
  onPatched: (entity: DerivedEntity) => void;
  onImagesMayChange: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

function EntityCard({
  entity,
  kind,
  projectId,
  generateLabel,
  imageKind,
  onPatched,
  onImagesMayChange,
  showToast,
}: EntityCardProps) {
  const [draft, setDraft] = useState(entity.description ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!dirty) setDraft(entity.description ?? "");
  }, [entity.description, dirty]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const persist = useCallback(async () => {
    if (saving) return;
    const next = draft;
    const current = entity.description ?? "";
    if (next === current) {
      setDirty(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await patchEntityDescription(kind, projectId, entity.id, next);
      onPatched(updated);
      setDirty(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存描述失败", "error");
    } finally {
      setSaving(false);
    }
  }, [draft, entity.description, entity.id, kind, onPatched, projectId, saving, showToast]);

  const handleGenerate = async () => {
    if (generating) return;
    if (dirty) await persist();
    const prompt = buildEntityPrompt(entity.name, dirty ? draft : entity.description);
    if (!prompt) {
      showToast("名称不能为空", "error");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGenerating(true);
    setJobStatus("queued");
    try {
      const task = await createEntityImage({
        projectId,
        kind: imageKind,
        entityId: entity.id,
        prompt,
      });
      showToast("已加入队列", "info");

      const jobId = taskJobId(task);
      const started = Date.now();
      let latest = task;
      while (!controller.signal.aborted && Date.now() - started < POLL_MAX_MS) {
        if (isTerminalStatus(latest.status)) break;
        await sleep(POLL_INTERVAL_MS);
        if (controller.signal.aborted) return;
        latest = await getGenerationTask(jobId);
        setJobStatus(latest.status);
      }

      if (latest.status === "completed") {
        showToast("生成完成", "success");
        onImagesMayChange();
      } else if (latest.status === "failed") {
        showToast(taskErrorMessage(latest.error) || "生成失败", "error");
      } else if (latest.status === "canceled") {
        showToast("任务已取消", "info");
      } else if (!controller.signal.aborted) {
        showToast("已加入队列", "info");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      showToast(err instanceof Error ? err.message : "创建出图任务失败", "error");
    } finally {
      setGenerating(false);
      setJobStatus(null);
    }
  };

  const urls = imageUrls(entity.images);

  return (
    <article className="rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold truncate">{entity.name}</h2>
          <p className="mt-1 text-[11px] text-[var(--at-text-tertiary)] font-mono truncate" title={entity.id}>
            {entity.id}
          </p>
        </div>
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={generating}
          onClick={() => void handleGenerate()}
        >
          {generating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {jobStatusLabel(jobStatus)}
            </>
          ) : (
            generateLabel
          )}
        </Button>
      </div>

      <label className="block mt-4">
        <span className="text-xs text-[var(--at-text-secondary)]">描述</span>
        <textarea
          value={draft}
          rows={3}
          onChange={(e) => {
            setDraft(e.target.value);
            setDirty(true);
          }}
          onBlur={() => void persist()}
          placeholder="补充外貌、气质或场景细节，会写入出图提示"
          className="mt-1.5 w-full resize-y rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-2 text-sm text-[var(--at-text)] placeholder:text-[var(--at-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--at-accent)]"
        />
        <span className="mt-1 block text-[11px] text-[var(--at-text-tertiary)]">
          {saving ? "保存中…" : dirty ? "离开输入框后保存" : "失焦自动保存"}
        </span>
      </label>

      <div className="mt-4">
        <p className="text-xs text-[var(--at-text-secondary)] mb-2">图片</p>
        {urls.length === 0 ? (
          <div className="flex items-center gap-2 h-24 rounded-lg border border-dashed border-[var(--at-border)] px-3 text-xs text-[var(--at-text-tertiary)]">
            <ImageIcon className="w-4 h-4 shrink-0" />
            还没有图
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {urls.map((url) => (
              <li key={url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={entity.name}
                  className="h-24 w-24 object-cover rounded-lg border border-[var(--at-border)] bg-[var(--at-surface-sunken)]"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function jobStatusLabel(status: string | null): string {
  if (status === "running") return "生成中…";
  if (status === "completed") return "完成";
  if (status === "failed") return "失败";
  return "已加入队列";
}

function taskErrorMessage(error: { message?: string } | string | null | undefined): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.message ?? "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
