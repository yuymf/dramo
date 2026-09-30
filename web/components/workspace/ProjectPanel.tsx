"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { listDerivedEntities, type DerivedEntity, type DerivedEntityKind } from "@/lib/api/entities";
import { derivedEntitiesChangedEvent, entityRevisedEvent, entityScopeEvent } from "@/components/entities/scope";
import { getProject, updateProject } from "@/lib/api/projects";
import {
  createVersion,
  getShare,
  listVersions,
  publishProject,
  restoreVersion,
  updateShare,
  type ShareMode,
} from "@/lib/api/collab";
import {
  CINEMA_ASPECT_RATIOS,
  DEFAULT_CINEMA_SETTINGS,
  type CinemaSettings,
} from "@/lib/types/cinema";
import type { ProjectType, ScreenplayFormat } from "@/lib/types/screenplay";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<ProjectType, string> = {
  script: "剧本",
  cinema: "制片",
  spoken: "口播",
};

interface ProjectPanelProps {
  projectId: string;
  visible: boolean;
  exportTargetRef: (element: HTMLDivElement | null) => void;
}

export function ProjectPanel({ projectId, visible, exportTargetRef }: ProjectPanelProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [editing, setEditing] = useState(false);
  const [format, setFormat] = useState<ScreenplayFormat>("hollywood");
  const [type, setType] = useState<ProjectType>("script");
  const [episodeName, setEpisodeName] = useState<string | null>(null);
  const [cinemaSettings, setCinemaSettings] = useState<CinemaSettings>(DEFAULT_CINEMA_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<Record<DerivedEntityKind, DerivedEntity[]>>({ character: [], location: [] });
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [entitiesError, setEntitiesError] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{ kind: DerivedEntityKind; id: string } | null>(null);

  const onScreenplay =
    !!pathname && (pathname.includes("/screenplay") || pathname.includes("/cover"));
  const onCover = !!pathname && pathname.includes("/cover");
  const currentDocument = pathname?.includes("/outline")
    ? "当前大纲"
    : pathname?.includes("/beats")
      ? "当前 Beats"
      : onScreenplay
        ? onCover ? "当前封面" : "当前稿"
        : null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const project = await getProject(projectId);
        if (cancelled) return;
        const nextName = project.name || "未命名项目";
        setName(nextName);
        setDraftName(nextName);
        if (project.format === "asian" || project.format === "hollywood") {
          setFormat(project.format);
        }
        if (project.type === "script" || project.type === "cinema" || project.type === "spoken") {
          setType(project.type);
        }
        if (project.cinemaSettings) {
          setCinemaSettings({ ...DEFAULT_CINEMA_SETTINGS, ...project.cinemaSettings });
        }
        const first = [...(project.episodes ?? [])].sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        )[0];
        setEpisodeName(first?.name ?? null);
      } catch (err) {
        console.error("Failed to load project panel:", err);
        if (!cancelled) {
          setName("未命名项目");
          setDraftName("未命名项目");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    const loadEntities = async () => {
      try {
        const [characters, locations] = await Promise.all([
          listDerivedEntities("character", projectId),
          listDerivedEntities("location", projectId),
        ]);
        if (!active) return;
        setEntities({ character: characters, location: locations });
        setEntitiesError(false);
      } catch {
        if (active) setEntitiesError(true);
      } finally {
        if (active) setEntitiesLoading(false);
      }
    };
    setEntities({ character: [], location: [] });
    setEntitiesLoading(true);
    void loadEntities();
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadEntities();
    };
    const onDerived = (event: Event) => {
      if ((event as CustomEvent<{ projectId?: string }>).detail?.projectId === projectId) void loadEntities();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(derivedEntitiesChangedEvent, onDerived);
    window.addEventListener(entityRevisedEvent("character"), loadEntities);
    window.addEventListener(entityRevisedEvent("location"), loadEntities);
    return () => {
      active = false;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(derivedEntitiesChangedEvent, onDerived);
      window.removeEventListener(entityRevisedEvent("character"), loadEntities);
      window.removeEventListener(entityRevisedEvent("location"), loadEntities);
    };
  }, [projectId]);

  useEffect(() => {
    const onScope = (kind: DerivedEntityKind) => (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      setSelectedEntity((current) => typeof id === "string" && id
        ? { kind, id }
        : current?.kind === kind ? null : current);
    };
    const onCharacter = onScope("character");
    const onLocation = onScope("location");
    window.addEventListener(entityScopeEvent("character"), onCharacter);
    window.addEventListener(entityScopeEvent("location"), onLocation);
    return () => {
      window.removeEventListener(entityScopeEvent("character"), onCharacter);
      window.removeEventListener(entityScopeEvent("location"), onLocation);
    };
  }, []);

  const commitName = async () => {
    setEditing(false);
    const next = draftName.trim();
    if (!next || next === name) {
      setDraftName(name);
      return;
    }
    const prev = name;
    setName(next);
    try {
      await updateProject(projectId, { name: next });
      showToast("项目名称已更新", "success");
    } catch (err) {
      console.error("Failed to rename project:", err);
      setName(prev);
      setDraftName(prev);
      showToast("更新项目名称失败", "error");
    }
  };

  const changeFormat = async (next: ScreenplayFormat) => {
    if (next === format) return;
    const prev = format;
    setFormat(next);
    try {
      await updateProject(projectId, { format: next });
    } catch (err) {
      console.error("Failed to update format:", err);
      setFormat(prev);
      showToast("切换格式失败", "error");
    }
  };

  return (
    <aside
      className={cn("h-full w-[232px] shrink-0 flex-col border-r", visible ? "flex" : "hidden")}
      aria-label="项目面板"
      style={{
        background: "var(--ws-surface, #ffffff)",
        borderColor: "var(--ws-border, #e7e5e4)",
      }}
    >
      <div className="px-3 py-3 border-b" style={{ borderColor: "var(--ws-border, #e7e5e4)" }}>
        <Link
          href="/projects"
          className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg"
          style={{ color: "var(--ws-secondary, #78716c)" }}
        >
          <FolderOpen size={14} strokeWidth={1.5} />
          全部项目
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 mb-2 text-[10px]" style={{ color: "var(--ws-muted, #a8a29e)" }}>
          {loading ? "项目" : TYPE_LABEL[type]}
        </p>

        {editing ? (
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => void commitName()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitName();
              if (e.key === "Escape") {
                setEditing(false);
                setDraftName(name);
              }
            }}
            autoFocus
            aria-label="项目名称"
            className="w-full px-2 py-1.5 text-sm font-semibold bg-transparent focus:outline-none"
            style={{
              color: "var(--ws-text, #1c1917)",
              borderBottom: "1.5px solid var(--ws-accent, #c2410c)",
            }}
          />
        ) : (
          <h1
            className="px-2 py-1.5 text-sm font-semibold rounded-lg cursor-text"
            style={{ color: "var(--ws-text, #1c1917)" }}
            title="双击重命名"
            onDoubleClick={() => {
              setEditing(true);
              setDraftName(name);
            }}
          >
            <span className="block truncate">{loading ? "加载中…" : name}</span>
          </h1>
        )}

        {type === "cinema" ? (
        <div className="mt-5 px-2">
          <p className="mb-2 text-[10px]" style={{ color: "#a8a29e" }}>
            画幅 / 美术
          </p>
          <select
            aria-label="画幅"
            value={cinemaSettings.aspectRatio}
            onChange={(e) => {
              const next = {
                ...cinemaSettings,
                aspectRatio: e.target.value as CinemaSettings["aspectRatio"],
              };
              setCinemaSettings(next);
              void updateProject(projectId, { cinemaSettings: next }).catch(() => {
                showToast("更新画幅失败", "error");
              });
            }}
            className="w-full rounded-md px-2 py-1.5 text-xs"
            style={{ background: "#f5f5f4", color: "#1c1917" }}
          >
            {CINEMA_ASPECT_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] leading-5" style={{ color: "#78716c" }}>
            {cinemaSettings.productionKind || "短片"}
            {cinemaSettings.artStyle ? ` · ${cinemaSettings.artStyle}` : ""}
            {cinemaSettings.cameraStyle ? ` · ${cinemaSettings.cameraStyle}` : ""}
          </p>
        </div>
        ) : (
        <div className="mt-5 px-2">
          <p className="mb-2 text-[10px]" style={{ color: "var(--ws-muted, #a8a29e)" }}>
            格式
          </p>
          <div
            className="flex p-0.5 rounded-lg"
            style={{ background: "var(--ws-hover, #f5f5f4)" }}
            role="group"
            aria-label="剧本格式"
          >
            {(
              [
                { id: "hollywood", label: "好莱坞" },
                { id: "asian", label: "亚洲" },
              ] as const
            ).map((opt) => {
              const active = format === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => void changeFormat(opt.id)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs",
                    active ? "font-semibold" : "font-medium"
                  )}
                  style={{
                    color: active ? "var(--ws-action-text, #c2410c)" : "var(--ws-secondary, #78716c)",
                    background: active ? "var(--ws-surface, #ffffff)" : "transparent",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {episodeName && <div className="mt-5 px-2">
          <p className="mb-2 text-[10px]" style={{ color: "var(--ws-muted, #a8a29e)" }}>
            {currentDocument ?? "当前集"}
          </p>
          <div
            className="rounded-lg px-2.5 py-2 text-sm"
            style={{
              color: "var(--ws-text, #1c1917)",
              background: "var(--ws-selected, rgba(194, 65, 12, 0.06))",
            }}
          >
            {episodeName}
          </div>
        </div>}

        <section className="mt-6 px-2" aria-label="项目实体">
          {(["character", "location"] as const).map((kind) => (
            <div key={kind} className="mb-4">
              <h2 className="mb-2 text-[11px] font-semibold" style={{ color: "var(--ws-secondary, #78716c)" }}>
                {kind === "character" ? "角色" : "地点"}
              </h2>
              {entitiesLoading ? (
                <p className="text-xs" style={{ color: "var(--ws-muted, #a8a29e)" }}>加载中…</p>
              ) : entitiesError ? (
                <p className="text-xs" style={{ color: "var(--ws-muted, #a8a29e)" }}>列表加载失败</p>
              ) : entities[kind].length === 0 ? (
                <p className="text-xs" style={{ color: "var(--ws-muted, #a8a29e)" }}>暂无{kind === "character" ? "角色" : "地点"}</p>
              ) : (
                <ul className="space-y-0.5">
                  {entities[kind].map((entity) => {
                    const selected = selectedEntity?.kind === kind && selectedEntity.id === entity.id;
                    return (
                      <li key={entity.id}>
                        <button
                          type="button"
                          aria-label={`浏览${kind === "character" ? "角色" : "地点"} ${entity.name}`}
                          aria-current={selected ? "true" : undefined}
                          onClick={() => router.push(`/projects/${projectId}/${kind === "character" ? "characters" : "locations"}?entity=${encodeURIComponent(entity.id)}`)}
                          className="w-full truncate rounded-lg px-2 py-1.5 text-left text-xs"
                          style={{
                            color: selected ? "var(--ws-action-text, #c2410c)" : "var(--ws-text, #1c1917)",
                            background: selected ? "var(--ws-selected, rgba(194, 65, 12, 0.06))" : "transparent",
                          }}
                        >
                          {entity.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </section>

        {onScreenplay && (
          <div className="mt-5 px-2">
            <p className="mb-2 text-[10px]" style={{ color: "var(--ws-muted, #a8a29e)" }}>
              视图
            </p>
            <div
              className="flex p-0.5 rounded-lg"
              style={{ background: "var(--ws-hover, #f5f5f4)" }}
              role="group"
              aria-label="剧本视图"
            >
              <button
                type="button"
                aria-pressed={!onCover}
                onClick={() => router.push(`/projects/${projectId}/screenplay`)}
                className={cn("flex-1 rounded-md py-1.5 text-xs", !onCover ? "font-semibold" : "font-medium")}
                style={{
                  color: !onCover ? "var(--ws-action-text, #c2410c)" : "var(--ws-secondary, #78716c)",
                  background: !onCover ? "var(--ws-surface, #ffffff)" : "transparent",
                }}
              >
                正文
              </button>
              <button
                type="button"
                aria-pressed={onCover}
                onClick={() => router.push(`/projects/${projectId}/cover`)}
                className={cn("flex-1 rounded-md py-1.5 text-xs", onCover ? "font-semibold" : "font-medium")}
                style={{
                  color: onCover ? "var(--ws-action-text, #c2410c)" : "var(--ws-secondary, #78716c)",
                  background: onCover ? "var(--ws-surface, #ffffff)" : "transparent",
                }}
              >
                封面
              </button>
            </div>
          </div>
        )}

        {type === "script" && onScreenplay && (
        <section className="mt-6 px-2" aria-label="项目操作">
          <h2 className="text-base font-semibold mb-2">项目操作</h2>
          <div ref={exportTargetRef} />
        </section>
        )}
        <ShareAndVersions projectId={projectId} />
      </div>
    </aside>
  );
}

function ShareAndVersions({ projectId }: { projectId: string }) {
  const { showToast } = useToast();
  const [shareMode, setShareMode] = useState<ShareMode>("invite");
  const [sharePath, setSharePath] = useState("");
  const [published, setPublished] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; name: string | null; automatic: boolean }>>([]);
  const [versionName, setVersionName] = useState("");

  useEffect(() => {
    void Promise.all([getShare(projectId), listVersions(projectId)])
      .then(([share, vers]) => {
        setShareMode(share.shareMode);
        setSharePath(share.sharePath);
        setPublished(share.published);
        setVersions(vers.versions);
      })
      .catch(() => undefined);
  }, [projectId]);

  return (
    <div className="mt-6 px-2 space-y-4">
      <div>
        <p className="mb-2 text-[10px]" style={{ color: "var(--ws-muted, #a8a29e)" }}>
          分享
        </p>
        <select
          aria-label="分享模式"
          value={shareMode}
          onChange={(e) => {
            const next = e.target.value as ShareMode;
            setShareMode(next);
            void updateShare(projectId, next).catch(() => showToast("更新分享失败", "error"));
          }}
          className="w-full rounded-md px-2 py-1.5 text-xs"
          style={{ background: "var(--ws-hover, #f5f5f4)" }}
        >
          <option value="invite">仅邀请</option>
          <option value="anyone_view">任何人可看</option>
          <option value="anyone_edit">任何人可编</option>
        </select>
        {sharePath && (
          <button
            type="button"
            className="mt-2 text-[11px] underline"
            style={{ color: "var(--ws-action-text, #c2410c)" }}
            onClick={() => {
              void navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
              showToast("分享链接已复制", "success");
            }}
          >
            复制分享链接
          </button>
        )}
        <button
          type="button"
          disabled={published}
          className="mt-2 block text-[11px]"
          style={{ color: "var(--ws-secondary, #78716c)" }}
          onClick={() => {
            void (published ? Promise.resolve() : publishProject(projectId)).then(() => {
              setPublished(true);
              showToast("已发布到公开库", "success");
            });
          }}
        >
          {published ? "已在公开库" : "发布到公开库"}
        </button>
      </div>
      <div>
        <p className="mb-2 text-[10px]" style={{ color: "var(--ws-muted, #a8a29e)" }}>
          版本
        </p>
        <input
          aria-label="版本名称"
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
          placeholder="命名快照"
          className="w-full rounded-md px-2 py-1.5 text-xs mb-2"
          style={{ background: "var(--ws-hover, #f5f5f4)" }}
        />
        <button
          type="button"
          className="text-[11px] font-medium"
          style={{ color: "var(--ws-action-text, #c2410c)" }}
          onClick={() => {
            void createVersion(projectId, versionName.trim() || undefined).then(async () => {
              setVersionName("");
              setVersions((await listVersions(projectId)).versions);
              showToast("版本已保存", "success");
            });
          }}
        >
          保存版本
        </button>
        <ul className="mt-2 space-y-1">
          {versions.slice(0, 6).map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-1 text-[11px]">
              <span className="truncate">{row.name || (row.automatic ? "自动点" : "未命名")}</span>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("恢复会整档回滚，确定？")) return;
                  void restoreVersion(projectId, row.id).then(() => {
                    showToast("已恢复版本", "success");
                    window.location.reload();
                  });
                }}
              >
                恢复
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
