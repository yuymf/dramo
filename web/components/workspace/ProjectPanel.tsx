"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { getProject, updateProject } from "@/lib/api/projects";
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
      </div>
    </aside>
  );
}
