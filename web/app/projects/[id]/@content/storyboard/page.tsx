"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import {
  firstEpisodeId,
  listScenes,
  listShots,
  putShots,
  type SceneRecord,
  type ShotRecord,
} from "@/lib/api/preproduction";

type ViewId = "panel" | "table" | "canvas";

function emptyShot(heading: string): ShotRecord {
  return { sceneHeading: heading, description: "", camera: "", design: "" };
}

export default function StoryboardPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { showToast } = useToast();
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<SceneRecord[]>([]);
  const [shots, setShots] = useState<ShotRecord[]>([]);
  const [view, setView] = useState<ViewId>("panel");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const eid = await firstEpisodeId(projectId);
      const [sceneDoc, shotDoc] = await Promise.all([listScenes(projectId, eid), listShots(projectId, eid)]);
      setEpisodeId(eid);
      setScenes(sceneDoc.scenes);
      setShots(shotDoc.shots);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "加载分镜失败", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async () => {
    if (!episodeId || saving) return;
    setSaving(true);
    try {
      const saved = await putShots(projectId, episodeId, shots);
      setShots(saved.shots);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存镜头失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const defaultHeading = scenes[0]?.heading ?? "";

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div>
          <h1 className="m-0 text-[15px] font-semibold tracking-wide">分镜</h1>
          <p className="text-xs text-[var(--at-text-tertiary)]">镜头挂在场次上，设计和出图分开。默认不超过 6 个。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 rounded-lg" style={{ background: "#f5f5f4" }} role="group" aria-label="分镜视图">
            {(
              [
                ["panel", "面板"],
                ["table", "表格"],
                ["canvas", "画布"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className="px-2.5 py-1 text-xs rounded-md"
                style={{
                  color: view === id ? "#c2410c" : "#78716c",
                  background: view === id ? "#fff" : "transparent",
                  fontWeight: view === id ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || !defaultHeading}
            onClick={() => setShots((prev) => [...prev, emptyShot(defaultHeading)])}
          >
            <Plus className="w-3.5 h-3.5" />
            添加镜头
          </Button>
          <Button type="button" size="sm" variant="accent" disabled={loading || saving} onClick={() => void persist()}>
            {saving ? "保存中…" : "保存镜头"}
          </Button>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : scenes.length === 0 ? (
          <p className="text-sm text-center text-[var(--at-text-secondary)] py-20">
            先去剧本页写下场次标题，镜头才能挂上去。
          </p>
        ) : shots.length === 0 ? (
          <p className="text-sm text-center text-[var(--at-text-secondary)] py-20">还没有镜头。先加 1–3 个决定性镜头。</p>
        ) : view === "table" ? (
          <table className="w-full max-w-5xl mx-auto text-sm">
            <thead>
              <tr className="text-left text-[var(--at-text-tertiary)]">
                <th className="py-2">场次</th>
                <th>描述</th>
                <th>机位</th>
                <th>设计</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shots.map((shot, index) => (
                <ShotRow
                  key={shot.id ?? `new-${index}`}
                  shot={shot}
                  index={index}
                  scenes={scenes}
                  onChange={(next) => setShots((prev) => prev.map((row, i) => (i === index ? next : row)))}
                  onRemove={() => setShots((prev) => prev.filter((_, i) => i !== index))}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <ul
            className={
              view === "canvas"
                ? "max-w-5xl mx-auto grid grid-cols-2 gap-3"
                : "max-w-3xl mx-auto space-y-3"
            }
          >
            {shots.map((shot, index) => (
              <li key={shot.id ?? `new-${index}`} className="rounded-xl border border-[var(--at-border)] bg-[var(--at-surface)] p-4">
                {shot.stale ? <p className="text-[11px] text-[#9a3412] mb-2">场次已改，镜头过期</p> : null}
                <ShotFields
                  shot={shot}
                  index={index}
                  scenes={scenes}
                  onChange={(next) => setShots((prev) => prev.map((row, i) => (i === index ? next : row)))}
                  onRemove={() => setShots((prev) => prev.filter((_, i) => i !== index))}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ShotFields({
  shot,
  index,
  scenes,
  onChange,
  onRemove,
}: {
  shot: ShotRecord;
  index: number;
  scenes: SceneRecord[];
  onChange: (shot: ShotRecord) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--at-text-secondary)]">镜头 {index + 1}</p>
        <button type="button" aria-label={`删除镜头 ${index + 1}`} onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5 text-[var(--at-text-tertiary)]" />
        </button>
      </div>
      <label className="block text-xs">
        场次
        <select
          aria-label={`镜头 ${index + 1} 场次`}
          value={shot.sceneHeading}
          onChange={(e) => onChange({ ...shot, sceneHeading: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-2 py-1.5 text-sm"
        >
          {scenes.map((scene) => (
            <option key={scene.id} value={scene.heading}>
              {scene.heading}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        描述
        <input
          aria-label={`镜头 ${index + 1} 描述`}
          value={shot.description}
          onChange={(e) => onChange({ ...shot, description: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs">
        机位
        <input
          aria-label={`镜头 ${index + 1} 机位`}
          value={shot.camera}
          onChange={(e) => onChange({ ...shot, camera: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs">
        设计
        <input
          aria-label={`镜头 ${index + 1} 设计`}
          value={shot.design}
          onChange={(e) => onChange({ ...shot, design: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-2 py-1.5 text-sm"
        />
      </label>
    </div>
  );
}

function ShotRow(props: {
  shot: ShotRecord;
  index: number;
  scenes: SceneRecord[];
  onChange: (shot: ShotRecord) => void;
  onRemove: () => void;
}) {
  return (
    <tr className="align-top border-t border-[var(--at-border)]">
      <td className="py-2 pr-2">
        <select
          aria-label={`镜头 ${props.index + 1} 场次`}
          value={props.shot.sceneHeading}
          onChange={(e) => props.onChange({ ...props.shot, sceneHeading: e.target.value })}
          className="w-full rounded border border-[var(--at-border)] bg-transparent px-2 py-1 text-sm"
        >
          {props.scenes.map((scene) => (
            <option key={scene.id} value={scene.heading}>
              {scene.heading}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-2">
        <input
          aria-label={`镜头 ${props.index + 1} 描述`}
          value={props.shot.description}
          onChange={(e) => props.onChange({ ...props.shot, description: e.target.value })}
          className="w-full rounded border border-[var(--at-border)] bg-transparent px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2 pr-2">
        <input
          aria-label={`镜头 ${props.index + 1} 机位`}
          value={props.shot.camera}
          onChange={(e) => props.onChange({ ...props.shot, camera: e.target.value })}
          className="w-full rounded border border-[var(--at-border)] bg-transparent px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2 pr-2">
        <input
          aria-label={`镜头 ${props.index + 1} 设计`}
          value={props.shot.design}
          onChange={(e) => props.onChange({ ...props.shot, design: e.target.value })}
          className="w-full rounded border border-[var(--at-border)] bg-transparent px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2">
        <button type="button" aria-label={`删除镜头 ${props.index + 1}`} onClick={props.onRemove}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
