"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import {
  createReel,
  generateFilm,
  generateReelImages,
  generateStoryboard,
  listReels,
  patchReel,
} from "@/lib/api/cinema";
import { firstEpisodeId } from "@/lib/api/planning";
import { STAGE_LABEL, type ReelDoc, type ReelStage } from "@/lib/types/cinema";

const STAGES: ReelStage[] = ["scene", "performance", "text_storyboard", "storyboard_images", "film"];

export default function ReelsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { showToast } = useToast();
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [reels, setReels] = useState<ReelDoc[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const current = reels.find((row) => row.id === currentId) ?? reels[0] ?? null;
  const currentRef = useRef(current);
  currentRef.current = current;

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const eid = await firstEpisodeId(projectId);
      const doc = await listReels(projectId, eid);
      setEpisodeId(eid);
      setReels(doc.reels);
      setCurrentId((prev) => prev ?? doc.reels[0]?.id ?? null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "加载 Reel 失败", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!current) return;
    window.dispatchEvent(
      new CustomEvent("cinema-reel-scope", { detail: { reelId: current.id, target: "performance" } })
    );
  }, [current]);

  useEffect(() => {
    const onRevised = (event: Event) => {
      const reel = (event as CustomEvent<ReelDoc>).detail;
      if (!reel?.id) return;
      setReels((prev) => prev.map((row) => (row.id === reel.id ? reel : row)));
    };
    window.addEventListener("cinema-revised", onRevised);
    return () => window.removeEventListener("cinema-revised", onRevised);
  }, []);

  const replace = (next: ReelDoc) => {
    setReels((prev) => prev.map((row) => (row.id === next.id ? next : row)));
  };

  const saveScene = async () => {
    const reel = currentRef.current;
    if (!reel) return;
    setBusy("scene");
    try {
      replace(await patchReel(projectId, reel.id, { sceneText: reel.sceneText }));
      showToast("场景已保存", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setBusy(null);
    }
  };

  const savePerformance = async () => {
    const reel = currentRef.current;
    if (!reel) return;
    setBusy("performance");
    try {
      replace(await patchReel(projectId, reel.id, { performance: reel.performance }));
      showToast("表演已保存", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setBusy(null);
    }
  };

  const run = async (key: string, fn: () => Promise<ReelDoc>) => {
    setBusy(key);
    try {
      replace(await fn());
    } catch (err) {
      showToast(err instanceof Error ? err.message : "操作失败", "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-sm text-[var(--at-text-secondary)]">
        <Loader2 className="w-4 h-4 animate-spin" />
        加载中…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)] text-[var(--at-text)]">
      <header className="flex items-center justify-between gap-3 shrink-0 px-5 py-3 border-b border-[var(--at-border)] bg-[var(--at-surface)]">
        <div>
          <h1 className="m-0 text-[15px] font-semibold tracking-wide">Reels</h1>
          <p className="text-xs text-[var(--at-text-tertiary)]">
            场景 → 表演 → 文字分镜 → 分镜图 → 15 秒成片。前置不满足会拒绝。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            if (!episodeId) return;
            const created = await createReel(projectId, episodeId, {
              previousReelId: current?.id,
            });
            setReels((prev) => [...prev, created]);
            setCurrentId(created.id);
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          新建 Reel
        </Button>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-44 shrink-0 border-r border-[var(--at-border)] p-3 overflow-auto">
          <ul className="space-y-1">
            {reels.map((reel) => (
              <li key={reel.id}>
                <button
                  type="button"
                  onClick={() => setCurrentId(reel.id)}
                  className="w-full text-left rounded-lg px-2 py-2 text-sm"
                  style={{
                    background: reel.id === current?.id ? "rgba(194, 65, 12, 0.08)" : "transparent",
                    color: reel.id === current?.id ? "#c2410c" : "#44403c",
                  }}
                >
                  <span className="block truncate font-medium">{reel.name}</span>
                  <span className="block text-[10px]">{STAGE_LABEL[reel.stage]}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex-1 min-w-0 overflow-auto px-5 py-5">
          {!current ? (
            <p className="text-sm text-[var(--at-text-secondary)]">还没有 Reel。</p>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              <ol className="flex flex-wrap gap-2 text-[11px]" aria-label="五阶段">
                {STAGES.map((stage) => {
                  const reached = STAGES.indexOf(current.stage) >= STAGES.indexOf(stage);
                  return (
                    <li
                      key={stage}
                      className="rounded-full px-2.5 py-1"
                      style={{
                        background: reached ? "rgba(194, 65, 12, 0.08)" : "#f5f5f4",
                        color: reached ? "#c2410c" : "#a8a29e",
                      }}
                    >
                      {STAGE_LABEL[stage]}
                    </li>
                  );
                })}
              </ol>

              <section>
                <h2 className="text-sm font-semibold mb-2">1. 场景</h2>
                <textarea
                  aria-label="场景"
                  value={current.sceneText}
                  onChange={(e) =>
                    setReels((prev) =>
                      prev.map((row) => (row.id === current.id ? { ...row, sceneText: e.target.value } : row))
                    )
                  }
                  className="w-full min-h-24 rounded-lg border border-[var(--at-border)] bg-[var(--at-surface)] px-3 py-2 text-sm"
                  placeholder="这一 Reel 发生在哪里、谁在场"
                />
                <Button className="mt-2" size="sm" disabled={busy === "scene"} onClick={() => void saveScene()}>
                  保存场景
                </Button>
              </section>

              <section>
                <h2 className="text-sm font-semibold mb-2">2. 表演</h2>
                <p className="text-xs text-[var(--at-text-tertiary)] mb-2">
                  用 @角色 #道具 「对白」写出表演。保存后角色和道具会出现在轨上。
                </p>
                <textarea
                  aria-label="表演"
                  value={current.performance}
                  onChange={(e) =>
                    setReels((prev) =>
                      prev.map((row) => (row.id === current.id ? { ...row, performance: e.target.value } : row))
                    )
                  }
                  className="w-full min-h-28 rounded-lg border border-[var(--at-border)] bg-[var(--at-surface)] px-3 py-2 text-sm"
                  placeholder={'@林晚 摸出 #旧怀表 「末班车要到了。」'}
                />
                <Button
                  className="mt-2"
                  size="sm"
                  disabled={busy === "performance"}
                  onClick={() => void savePerformance()}
                >
                  保存表演
                </Button>
              </section>

              <section>
                <h2 className="text-sm font-semibold mb-2">3. 文字分镜</h2>
                <Button
                  size="sm"
                  disabled={busy === "storyboard"}
                  onClick={() =>
                    void run("storyboard", () => generateStoryboard(projectId, current.id))
                  }
                >
                  生成文字分镜
                </Button>
                {current.shots.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {current.shots.map((shot, index) => (
                      <li key={shot.id ?? index} className="rounded-lg border border-[var(--at-border)] px-3 py-2 text-sm">
                        <span className="text-xs text-[var(--at-text-tertiary)]">{shot.camera || "镜头"}</span>
                        <p className="m-0">{shot.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-sm font-semibold mb-2">4. 分镜图</h2>
                <Button
                  size="sm"
                  disabled={busy === "images" || current.shots.length === 0}
                  onClick={() => void run("images", () => generateReelImages(projectId, current.id))}
                >
                  生成分镜图
                </Button>
                {current.images.length > 0 && (
                  <ul className="mt-3 grid grid-cols-3 gap-2">
                    {current.images.map((image) => (
                      <li key={`${image.shotId}-${image.url}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt="分镜图" className="h-24 w-full object-cover rounded-lg" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-sm font-semibold mb-2">5. 15 秒成片</h2>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={busy === "film" || current.images.length === 0}
                    onClick={() => void run("film", () => generateFilm(projectId, current.id))}
                  >
                    生成 15 秒成片
                  </Button>
                  {current.previousReelId && (
                    <span className="text-xs text-[var(--at-text-tertiary)]">已锚定上一 Reel 末帧</span>
                  )}
                </div>
                {current.films.length > 0 && (
                  <ul className="mt-3 space-y-3">
                    {current.films.map((film, index) => (
                      <li key={film.id}>
                        <p className="text-xs mb-1">版本 {current.films.length - index}</p>
                        <video
                          src={film.url}
                          controls
                          className="w-full max-w-lg rounded-lg bg-black"
                          aria-label={`成片版本 ${current.films.length - index}`}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
