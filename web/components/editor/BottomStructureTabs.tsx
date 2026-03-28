/**
 * Bottom sticky tabs for structural navigation
 * Allow quick jump to different scenes or insert new ones
 */
"use client";

interface Scene {
  id: string;
  title: string;
  order: number;
}

interface BottomStructureTabsProps {
  scenes: Scene[];
  activeSceneId?: string;
  onSceneClick: (sceneId: string) => void;
  onInsertScene: () => void;
}

export function BottomStructureTabs({
  scenes,
  activeSceneId,
  onSceneClick,
  onInsertScene,
}: BottomStructureTabsProps) {
  return (
    <nav
      aria-label="Scene navigation"
      className="hidden md:flex sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-[var(--border-line)] p-2 items-center gap-2 overflow-x-auto"
    >
      {scenes.map((scene) => (
        <button
          key={scene.id}
          onClick={() => onSceneClick(scene.id)}
          aria-label={`Navigate to scene ${scene.order}: ${scene.title}`}
          aria-pressed={activeSceneId === scene.id}
          className={`px-3 py-1.5 rounded text-sm transition-all duration-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] ${
            activeSceneId === scene.id
              ? "bg-[var(--brand-500)] text-white"
              : "bg-[var(--muted-bg)] hover:bg-slate-200 text-slate-700"
          }`}
        >
          {scene.order}. {scene.title}
        </button>
      ))}
      <button
        onClick={onInsertScene}
        aria-label="Insert new scene"
        className="px-3 py-1.5 rounded text-sm bg-[var(--brand-500)] text-white hover:bg-[var(--brand-600)] transition-all duration-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
      >
        + 插入场景
      </button>
    </nav>
  );
}

