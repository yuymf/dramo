"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
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
}

export function ProjectPanel({ projectId }: ProjectPanelProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [editing, setEditing] = useState(false);
  const [format, setFormat] = useState<ScreenplayFormat>("hollywood");
  const [type, setType] = useState<ProjectType>("script");
  const [episodeName, setEpisodeName] = useState("第 1 集");
  const [cinemaSettings, setCinemaSettings] = useState<CinemaSettings>(DEFAULT_CINEMA_SETTINGS);
  const [loading, setLoading] = useState(true);

  const onScreenplay =
    !!pathname &&
    (pathname.includes("/screenplay") ||
      pathname.includes("/cover") ||
      pathname.includes("/scripts"));
  const onCover = !!pathname && pathname.includes("/cover");

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
        setEpisodeName(first?.name || "第 1 集");
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
      className="h-full w-[232px] shrink-0 flex flex-col border-r"
      style={{
        background: "#ffffff",
        borderColor: "#e7e5e4",
      }}
    >
      <div className="px-3 py-3 border-b" style={{ borderColor: "#e7e5e4" }}>
        <Link
          href="/projects"
          className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg"
          style={{ color: "#78716c" }}
        >
          <FolderOpen size={14} strokeWidth={1.5} />
          全部项目
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 mb-2 text-[10px]" style={{ color: "#a8a29e" }}>
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
              color: "#1c1917",
              borderBottom: "1.5px solid #c2410c",
            }}
          />
        ) : (
          <h1
            className="px-2 py-1.5 text-sm font-semibold rounded-lg cursor-text"
            style={{ color: "#1c1917" }}
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
          <p className="mb-2 text-[10px]" style={{ color: "#a8a29e" }}>
            格式
          </p>
          <div
            className="flex p-0.5 rounded-lg"
            style={{ background: "#f5f5f4" }}
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
                  onClick={() => void changeFormat(opt.id)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs",
                    active ? "font-semibold" : "font-medium"
                  )}
                  style={{
                    color: active ? "#c2410c" : "#78716c",
                    background: active ? "#ffffff" : "transparent",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        )}

        <div className="mt-5 px-2">
          <p className="mb-2 text-[10px]" style={{ color: "#a8a29e" }}>
            集
          </p>
          <div
            className="rounded-lg px-2.5 py-2 text-sm"
            style={{
              color: "#1c1917",
              background: "rgba(194, 65, 12, 0.06)",
            }}
          >
            {episodeName}
          </div>
        </div>

        {onScreenplay && (
          <div className="mt-5 px-2">
            <p className="mb-2 text-[10px]" style={{ color: "#a8a29e" }}>
              视图
            </p>
            <div
              className="flex p-0.5 rounded-lg"
              style={{ background: "#f5f5f4" }}
              role="group"
              aria-label="剧本视图"
            >
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/screenplay`)}
                className={cn("flex-1 rounded-md py-1.5 text-xs", !onCover ? "font-semibold" : "font-medium")}
                style={{
                  color: !onCover ? "#c2410c" : "#78716c",
                  background: !onCover ? "#ffffff" : "transparent",
                }}
              >
                正文
              </button>
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/cover`)}
                className={cn("flex-1 rounded-md py-1.5 text-xs", onCover ? "font-semibold" : "font-medium")}
                style={{
                  color: onCover ? "#c2410c" : "#78716c",
                  background: onCover ? "#ffffff" : "transparent",
                }}
              >
                封面
              </button>
            </div>
          </div>
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
        <p className="mb-2 text-[10px]" style={{ color: "#a8a29e" }}>
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
          style={{ background: "#f5f5f4" }}
        >
          <option value="invite">仅邀请</option>
          <option value="anyone_view">任何人可看</option>
          <option value="anyone_edit">任何人可编</option>
        </select>
        {sharePath && (
          <button
            type="button"
            className="mt-2 text-[11px] underline"
            style={{ color: "#c2410c" }}
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
          className="mt-2 block text-[11px]"
          style={{ color: "#78716c" }}
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
        <p className="mb-2 text-[10px]" style={{ color: "#a8a29e" }}>
          版本
        </p>
        <input
          aria-label="版本名称"
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
          placeholder="命名快照"
          className="w-full rounded-md px-2 py-1.5 text-xs mb-2"
          style={{ background: "#f5f5f4" }}
        />
        <button
          type="button"
          className="text-[11px] font-medium"
          style={{ color: "#c2410c" }}
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
