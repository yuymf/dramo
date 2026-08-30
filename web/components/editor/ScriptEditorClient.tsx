"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { type Editor } from "@tiptap/react";
import { nanoid } from "nanoid";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { api } from "@/lib/api/client";
import type { Script, Scene, Block, Act } from "@/lib/models";
import { AppHeader } from "@/components/layout/AppHeader";
import { SceneList } from "@/components/sidebar/SceneList";
import { SceneGeneratePanel } from "@/components/editor/SceneGeneratePanel";
import { EditorBlock } from "@/components/editor/EditorBlock";
import { PageLoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Plus, Bold, Italic, Strikethrough, List, ListOrdered, Heading2, Heading3, Undo2, Redo2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { useScriptAutosave } from "@/lib/hooks/useScriptAutosave";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useIsLargeScreen } from "@/lib/hooks/useIsLargeScreen";
import { readJSON, saveJSON, addFavorite, saveVersion, remove as removeLocal } from "@/lib/storage/local";
import { exportAsText, downloadTextFile, exportAsPDF, exportAsSRT, exportAsTeleprompter, exportAsMarkdown, exportAsDOCX, exportAsJSON } from "@/lib/utils/exporter";
import { useAIChat } from "@/app/ai-chat-provider";
import { extractScriptJson } from "@/lib/utils/json-context-extractor";
import { cn } from "@/lib/utils";

const TimelineBeats = dynamic(
  () => import("@/components/editor/TimelineBeats").then(mod => ({ default: mod.TimelineBeats })),
  { ssr: false }
);

const InspirationPanel = dynamic(
  () => import("@/components/inspiration-panel/InspirationPanel").then(mod => ({ default: mod.InspirationPanel })),
  { ssr: false }
);

const ScriptVersionHistory = dynamic(
  () => import("@/components/history/ScriptVersionHistory").then(mod => ({ default: mod.ScriptVersionHistory })),
  { ssr: false }
);

const BranchingCanvas = dynamic(
  () => import("@/components/editor/BranchingCanvas").then(mod => ({ default: mod.BranchingCanvas })),
  { ssr: false }
);

interface Candidate {
  id: string;
  text: string;
  rank: number;
}

const createDefaultBlocks = (timestamp: number): Block[] => [
  { id: `block_${timestamp}_1`, label: '开场暖场', text: '' },
  { id: `block_${timestamp}_2`, label: '主题陈述', text: '' },
  { id: `block_${timestamp}_3`, label: '核心环节', text: '' },
  { id: `block_${timestamp}_4`, label: '互动', text: '' },
  { id: `block_${timestamp}_5`, label: '收尾', text: '' },
];

function fillSceneBlocksIfEmpty(scene: Scene, seed: number): Scene {
  if (scene.content.length === 0) {
    return {
      ...scene,
      content: createDefaultBlocks(seed),
    };
  }
  return scene;
}

function deriveActsFromScenes(scenes: Scene[], timestamp: number): Act[] {
  const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);
  const totalScenes = sortedScenes.length;

  // 均分场景到3个幕（尽可能平均）
  const scenesPerAct = Math.ceil(totalScenes / 3);

  const act1Scenes = sortedScenes.slice(0, scenesPerAct).map(s => s.id);
  const act2Scenes = sortedScenes.slice(scenesPerAct, scenesPerAct * 2).map(s => s.id);
  const act3Scenes = sortedScenes.slice(scenesPerAct * 2).map(s => s.id);

  return [
    {
      id: `act_${timestamp}_1`,
      name: '幕一·开场画面',
      order: 1,
      sceneIds: act1Scenes,
    },
    {
      id: `act_${timestamp}_2`,
      name: '幕二·冲突升级',
      order: 2,
      sceneIds: act2Scenes,
    },
    {
      id: `act_${timestamp}_3`,
      name: '幕三·结局点题',
      order: 3,
      sceneIds: act3Scenes,
    },
  ];
}

// Convert a scene from AgentOS format (blocks: [{text, type, character, direction}])
// to the frontend format (content: Block[] where Block = {id, label, text:HTML})
function convertAgentOSScene(scene: Record<string, unknown>, timestamp: number, index: number): Scene {
  const rawBlocks = scene.blocks as Array<{text?: string; type?: string; character?: string; direction?: string}> | undefined;
  let content: Block[];
  if (rawBlocks && rawBlocks.length > 0) {
    content = rawBlocks.map((b, i) => {
      // Build a label from type + character
      let label = '正文';
      if (b.type === 'action') label = '动作';
      else if (b.type === 'dialogue' && b.character) label = b.character;
      else if (b.type === 'dialogue') label = '对话';

      // Build HTML text: combine text + direction hint
      let html = b.text ? `<p>${b.text}</p>` : '';
      if (b.direction) html += `<p><em>${b.direction}</em></p>`;

      return { id: `block_${timestamp + index}_${i}`, label, text: html };
    });
  } else {
    content = (scene.content as Block[] | undefined) || [];
  }

  return {
    id: (scene.id as string) || `scene_${timestamp + index}`,
    title: (scene.title as string) || '',
    description: scene.description as string | undefined,
    isEXT: scene.isEXT as boolean | undefined,
    isDay: scene.isDay as boolean | undefined,
    order: typeof scene.order === 'number' ? scene.order : index + 1,
    content,
  };
}

function ensureConsistency(raw: Script): Script {
  const timestamp = Date.now();

  // Normalise scenes: handle both AgentOS format (blocks) and legacy format (content)
  const rawScenes = (raw.scenes as unknown as Array<Record<string, unknown>>) || [];
  const normalisedScenes: Scene[] = rawScenes.map((scene, index) => {
    // If the scene already has content array with Block shape, migrate that
    if (Array.isArray(scene.content) && (scene.content as unknown[]).length > 0) {
      const legacyContent = (scene.content as Block[]).map((block) => ({
        id: block.id,
        label: block.label || '정文',
        text: block.text || '',
      }));
      return {
        id: (scene.id as string) || `scene_${timestamp + index}`,
        title: (scene.title as string) || '',
        description: scene.description as string | undefined,
        isEXT: scene.isEXT as boolean | undefined,
        isDay: scene.isDay as boolean | undefined,
        order: typeof scene.order === 'number' ? scene.order : index + 1,
        content: legacyContent,
      };
    }
    // AgentOS format or empty content — convert
    return convertAgentOSScene(scene, timestamp, index);
  });

  // Migration: ensure new fields exist
  const migrated: Script = {
    ...raw,
    projectId: raw.projectId || '',
    form: raw.form || 'linear',
    contentType: raw.contentType || 'short_video',
    styles: raw.styles || [],
    goal: raw.goal,
    scenes: normalisedScenes,
  };

  const filledScenes = migrated.scenes.map((scene, index) =>
    fillSceneBlocksIfEmpty(scene, timestamp + index)
  );

  let acts = migrated.acts;
  if (!acts || acts.length === 0) {
    acts = deriveActsFromScenes(filledScenes, timestamp);
  }

  const validSceneIds = new Set(filledScenes.map(s => s.id));
  acts = acts.map(act => ({
    ...act,
    sceneIds: act.sceneIds.filter(id => validSceneIds.has(id)),
  }));

  const assignedSceneIds = new Set(acts.flatMap(act => act.sceneIds));
  const unassignedScenes = filledScenes.filter(s => !assignedSceneIds.has(s.id));

  if (unassignedScenes.length > 0) {
    const sortedUnassigned = [...unassignedScenes].sort((a, b) => a.order - b.order);
    acts = acts.map((act) => {
      if (act.sceneIds.length === 0 && sortedUnassigned.length > 0) {
        const scene = sortedUnassigned.shift();
        return scene ? { ...act, sceneIds: [scene.id] } : act;
      }
      return act;
    });
  }

  // Recompute scene.order based on act ordering
  const sortedActs = [...acts].sort((a, b) => a.order - b.order);
  const orderedSceneIds: string[] = [];
  sortedActs.forEach(act => {
    orderedSceneIds.push(...act.sceneIds);
  });

  // Add unassigned scenes at the end
  const finalAssignedIds = new Set(orderedSceneIds);
  const remainingScenes = filledScenes
    .filter(s => !finalAssignedIds.has(s.id))
    .sort((a, b) => a.order - b.order);
  remainingScenes.forEach(s => orderedSceneIds.push(s.id));

  // Rebuild scenes with new order
  const sceneMap = new Map(filledScenes.map(s => [s.id, s]));
  const reorderedScenes = orderedSceneIds
    .map((id, idx) => {
      const scene = sceneMap.get(id);
      return scene ? { ...scene, order: idx + 1 } : null;
    })
    .filter((s): s is Scene => s !== null);

  return {
    ...migrated,
    scenes: reorderedScenes,
    acts,
  };
}

export function ScriptEditorClient() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const [script, setScript] = useState<Script | null>(null);
  const [acts, setActs] = useState<Act[]>([]);
  const [activeActId, setActiveActId] = useState<string | undefined>();
  const [activeSceneId, setActiveSceneId] = useState<string | undefined>();
  const [scrollToSceneId, setScrollToSceneId] = useState<string | undefined>();
  const [pendingFocus, setPendingFocus] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showCandidates, setShowCandidates] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [inspirationPanelCollapsed, setInspirationPanelCollapsed] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const { showToast } = useToast();

  // Editor state for global toolbar
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [editorState, setEditorState] = useState({
    canBold: false,
    canItalic: false,
    canStrike: false,
    canUndo: false,
    canRedo: false,
    isBold: false,
    isItalic: false,
    isStrike: false,
    isBulletList: false,
    isOrderedList: false,
    isHeading2: false,
    isHeading3: false,
  });

  const projectId = params?.id as string | undefined;
  const isLargeScreen = useIsLargeScreen();
  const isDialogueMode = pathname?.includes('/dialogue');
  const { updateJsonData } = useAIChat();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const dirtyRef = useRef(false);
  const hydratedRef = useRef(false);
  const { scheduleSave, saveNow } = useScriptAutosave({ projectId: projectId ?? '' });

  // Listen for pipeline completion to refresh script data.
  // Also handles tab-switch back to scripts: the pipeline dispatches
  // 'pipeline-step-complete' with step='script' while this component may be
  // unmounted (navigated away). Listening to 'pipeline-tab-switch' with
  // tab='scripts' ensures we reload when the user (or pipeline) returns here.
  useEffect(() => {
    const handlePipelineComplete = (e: Event) => {
      const { step } = (e as CustomEvent).detail;
      if (step === 'script') {
        // Clear local draft so we fetch fresh data from server
        removeLocal(`script_draft_${projectId}`);
        setRefreshTrigger((prev) => prev + 1);
      }
    };
    const handleTabSwitch = (e: Event) => {
      const { tab } = (e as CustomEvent).detail;
      if (tab === 'scripts') {
        // Pipeline navigated back to scripts tab — clear draft and reload
        removeLocal(`script_draft_${projectId}`);
        setRefreshTrigger((prev) => prev + 1);
      }
    };
    window.addEventListener('pipeline-step-complete', handlePipelineComplete);
    window.addEventListener('pipeline-tab-switch', handleTabSwitch);
    return () => {
      window.removeEventListener('pipeline-step-complete', handlePipelineComplete);
      window.removeEventListener('pipeline-tab-switch', handleTabSwitch);
    };
  }, [projectId]);

  // 初始化时读取折叠状态，默认为展开（false）
  useEffect(() => {
    const savedCollapsed = readJSON<boolean>('inspirationPanelCollapsed', false);
    setInspirationPanelCollapsed(savedCollapsed);
  }, []);

  // 折叠状态变化时保存到 localStorage
  useEffect(() => {
    saveJSON('inspirationPanelCollapsed', inspirationPanelCollapsed);
  }, [inspirationPanelCollapsed]);

  const handleToggleInspirationPanel = () => {
    setInspirationPanelCollapsed(prev => !prev);
    // 关闭其他面板
    setShowHistoryPanel(false);
  };

  const handleToggleHistoryPanel = () => {
    setShowHistoryPanel(prev => !prev);
    // 关闭其他面板
    setInspirationPanelCollapsed(true);
  };

  const handleHistoryRevert = () => {
    setShowHistoryPanel(false);
    if (projectId) {
      removeLocal(`script_draft_${projectId}`);
    }
    setRefreshTrigger((n) => n + 1);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!projectId) return;
        setLoading(true);

        const draft = readJSON<Script | null>(`script_draft_${projectId}`, null);
        if (draft && draft.scenes && draft.scenes.length > 0) {
          if (mounted) {
            const finalScript = ensureConsistency(draft);

            setScript(finalScript);
            setActs(finalScript.acts);

            const firstAct = finalScript.acts[0];
            setActiveActId(firstAct?.id);
            const firstSceneId = firstAct ? firstAct.sceneIds[0] : finalScript.scenes[0]?.id;
            setActiveSceneId(firstSceneId);

            setLoading(false);
          }
          // Draft exists. Only replace if the user has not edited this session
          // and the server copy is actually newer.
          const res = await api<Script>(`/api/projects/${projectId}/script`).catch(() => null);
          if (mounted && res && !dirtyRef.current) {
            const serverUpdatedAt = new Date(res.updatedAt).getTime();
            const draftUpdatedAt = draft.updatedAt ? new Date(draft.updatedAt).getTime() : 0;
            if (serverUpdatedAt > draftUpdatedAt) {
              const finalScript = ensureConsistency(res);
              setScript(finalScript);
              setActs(finalScript.acts);
              const firstAct = finalScript.acts[0];
              setActiveActId(firstAct?.id);
              const firstSceneId = firstAct ? firstAct.sceneIds[0] : finalScript.scenes[0]?.id;
              setActiveSceneId(firstSceneId);
              removeLocal(`script_draft_${projectId}`);
            }
          }
          return;
        }

        const res = await api<Script>(`/api/projects/${projectId}/script`).catch(() => null);
        if (mounted && res) {
          const finalScript = ensureConsistency(res);

          setScript(finalScript);
          setActs(finalScript.acts);

          const firstAct = finalScript.acts[0];
          setActiveActId(firstAct?.id);
          const firstSceneId = firstAct ? firstAct.sceneIds[0] : finalScript.scenes[0]?.id;
          setActiveSceneId(firstSceneId);
        } else if (mounted && !res) {
          showToast("未找到台本，请先通过对话生成", "info");
        }
      } catch (err) {
        if (mounted) showToast((err as Error).message, "error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [projectId, showToast, refreshTrigger]);

  useAutosave({
    data: script,
    key: `script_draft_${projectId}`,
    interval: 10000,
    onSave: (timestamp) => setLastSaved(timestamp),
  });

  useEffect(() => {
    hydratedRef.current = false;
    dirtyRef.current = false;
  }, [projectId, refreshTrigger]);

  useEffect(() => {
    if (!script || !projectId) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    dirtyRef.current = true;
    scheduleSave({ scenes: script.scenes, acts: script.acts });
  }, [script, projectId, scheduleSave]);

  // 注册到AI聊天上下文：当script变化时更新JSON数据
  useEffect(() => {
    if (script) {
      const jsonData = extractScriptJson(script);
      updateJsonData(jsonData);
    } else {
      updateJsonData(null);
    }
  }, [script, updateJsonData]);

  const handleSceneClick = useCallback((sceneId: string) => {
    setActiveSceneId(sceneId);
    setPendingFocus(true);
  }, []);

  const handleSceneReorder = useCallback((reorderedScenes: Scene[]) => {
    if (!activeActId) return;

    // 更新 Act 的 sceneIds 顺序
    const newSceneIds = reorderedScenes.map(s => s.id);

    setActs(prev => prev.map(act => {
      if (act.id === activeActId) {
        return {
          ...act,
          sceneIds: newSceneIds,
        };
      }
      return act;
    }));

    setScript((prev) => {
      if (!prev) return null;

      const updatedActs = prev.acts.map(act => {
        if (act.id === activeActId) {
          return {
            ...act,
            sceneIds: newSceneIds,
          };
        }
        return act;
      });

      // 更新场景的 order 属性（虽然在显示时会被 currentActScenes 覆盖，但保持数据一致性）
      const updatedScenes = prev.scenes.map(scene => {
        const newIndex = newSceneIds.indexOf(scene.id);
        if (newIndex !== -1) {
          return { ...scene, order: newIndex + 1 };
        }
        return scene;
      });

      return { ...prev, acts: updatedActs, scenes: updatedScenes };
    });
  }, [activeActId]);


  const handleRegenerateScene = useCallback(async () => {
    if (!projectId || !activeSceneId) return;
    setRegenerating(true);
    try {
      const res = await api<{ candidates: Candidate[] }>(
        `/api/projects/${projectId}/script/scenes/${activeSceneId}/regenerate`,
        {
          method: "POST",
          body: {
            sceneId: activeSceneId,
            script,
          },
        }
      );
      setCandidates(res.candidates);
      setShowCandidates(true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRegenerating(false);
    }
  }, [projectId, activeSceneId, script]);

  const handleInsertCandidate = useCallback(
    (candidateId: string, text: string) => {
      if (!activeSceneId) return;
      setScript((prev) => {
        if (!prev) return null;
        const sceneIndex = prev.scenes.findIndex((s) => s.id === activeSceneId);
        if (sceneIndex === -1) return prev;

        const newBlock: Block = {
          id: `block_${Date.now()}`,
          label: "正文",
          text,
        };

        const updatedScenes = [...prev.scenes];
        updatedScenes[sceneIndex] = {
          ...updatedScenes[sceneIndex],
          content: [...updatedScenes[sceneIndex].content, newBlock],
        };

        return { ...prev, scenes: updatedScenes };
      });
      setShowCandidates(false);
      setCandidates([]);
    },
    [activeSceneId]
  );

  const handleReplaceCandidate = useCallback(
    (candidateId: string, text: string) => {
      if (!activeSceneId) return;
      setScript((prev) => {
        if (!prev) return null;
        const sceneIndex = prev.scenes.findIndex((s) => s.id === activeSceneId);
        if (sceneIndex === -1) return prev;

        const newBlock: Block = {
          id: `block_${Date.now()}_replace`,
          label: "正文",
          text,
        };

        const updatedScenes = [...prev.scenes];
          updatedScenes[sceneIndex] = {
            ...updatedScenes[sceneIndex],
            content: [newBlock],
          };

        return { ...prev, scenes: updatedScenes };
      });
      setShowCandidates(false);
      setCandidates([]);
    },
    [activeSceneId]
  );

  const handleInsertInspiration = useCallback(
    (text: string) => {
      if (!activeSceneId) return;
      setScript((prev) => {
        if (!prev) return null;
        const sceneIndex = prev.scenes.findIndex((s) => s.id === activeSceneId);
        if (sceneIndex === -1) return prev;

        const newBlock: Block = {
          id: `block_${Date.now()}_inspire`,
          label: "正文",
          text,
        };

        const updatedScenes = [...prev.scenes];
        updatedScenes[sceneIndex] = {
          ...updatedScenes[sceneIndex],
          content: [...updatedScenes[sceneIndex].content, newBlock],
        };

        return { ...prev, scenes: updatedScenes };
      });
    },
    [activeSceneId]
  );

  const handleFavoriteInspiration = useCallback(
    async (inspirationId: string) => {
      try {
        await api<{ inspirationId: string; isFavorite: boolean }>(
          "/api/inspirations/favorite",
          {
            method: "POST",
            body: { inspirationId },
          }
        );
        addFavorite(inspirationId, "Favorited inspiration", "quotes");
        showToast("已添加到收藏！", "success");
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    },
    [showToast]
  );

  const formatLastSaved = () => {
    if (!lastSaved) return "";
    const now = Date.now();
    const diff = Math.floor((now - lastSaved) / 1000);
    if (diff < 60) return `Saved ${diff}s ago`;
    const mins = Math.floor(diff / 60);
    return `Saved ${mins}m ago`;
  };

  const handleManualSave = useCallback(async () => {
    if (!script || !projectId) return;
    await saveNow({ scenes: script.scenes, acts: script.acts });
    saveVersion(script.id, script, "Manual save via Ctrl+S");
    showToast("Script saved successfully!", "success");
  }, [script, projectId, saveNow, showToast]);

  const handleExportText = useCallback(() => {
    if (!script) return;
    const text = exportAsText(script);
    downloadTextFile(text, `${script.title}_script.txt`);
    showToast("Script exported as text!", "success");
  }, [script, showToast]);

  const handleExportPDF = useCallback(async () => {
    if (!script) return;
    try {
      await exportAsPDF(script);
      showToast("Script exported as PDF!", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }, [script, showToast]);

  const handleExportSRT = useCallback(() => {
    if (!script) return;
    const srt = exportAsSRT(script);
    downloadTextFile(srt, `${script.title}_subtitles.srt`);
    showToast("Subtitles exported as SRT!", "success");
  }, [script, showToast]);

  const handleExportTeleprompter = useCallback(() => {
    if (!script) return;
    const teleprompter = exportAsTeleprompter(script);
    downloadTextFile(teleprompter, `${script.title}_teleprompter.txt`);
    showToast("Teleprompter file exported!", "success");
  }, [script, showToast]);

  const handleExportMarkdown = useCallback(() => {
    if (!script) return;
    const markdown = exportAsMarkdown(script);
    downloadTextFile(markdown, `${script.title}_script.md`);
    showToast("Script exported as Markdown!", "success");
  }, [script, showToast]);

  const handleExportDocx = useCallback(async () => {
    if (!script) return;
    try {
      await exportAsDOCX(script);
      showToast("Script exported as Word document!", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }, [script, showToast]);

  const handleExportJSON = useCallback(() => {
    if (!script) return;
    const json = exportAsJSON(script);
    downloadTextFile(json, `${script.title}_script.json`);
    showToast("Script exported as JSON!", "success");
  }, [script, showToast]);

  const handlePreviousScene = useCallback(() => {
    if (!script?.scenes || !activeSceneId) return;
    const currentIndex = script.scenes.findIndex((s) => s.id === activeSceneId);
    if (currentIndex > 0) {
      setActiveSceneId(script.scenes[currentIndex - 1].id);
    }
  }, [script, activeSceneId]);

  const handleNextScene = useCallback(() => {
    if (!script?.scenes || !activeSceneId) return;
    const currentIndex = script.scenes.findIndex((s) => s.id === activeSceneId);
    if (currentIndex < script.scenes.length - 1) {
      setActiveSceneId(script.scenes[currentIndex + 1].id);
    }
  }, [script, activeSceneId]);

  const handleEditorReady = useCallback((editor: Editor) => {
    setActiveEditor(editor);

    const updateState = () => {
      setEditorState({
        canBold: editor.can().chain().focus().toggleBold().run(),
        canItalic: editor.can().chain().focus().toggleItalic().run(),
        canStrike: editor.can().chain().focus().toggleStrike().run(),
        canUndo: editor.can().chain().focus().undo().run(),
        canRedo: editor.can().chain().focus().redo().run(),
        isBold: editor.isActive("bold"),
        isItalic: editor.isActive("italic"),
        isStrike: editor.isActive("strike"),
        isBulletList: editor.isActive("bulletList"),
        isOrderedList: editor.isActive("orderedList"),
        isHeading2: editor.isActive("heading", { level: 2 }),
        isHeading3: editor.isActive("heading", { level: 3 }),
      });
    };

    // 绑定状态更新到当前获得焦点的编辑器
    editor.on("selectionUpdate", updateState);
    editor.on("update", updateState);
    updateState();

    // 清理之前的监听器（如果有）
    return () => {
      editor.off("selectionUpdate", updateState);
      editor.off("update", updateState);
    };
  }, []);

  const handleToolbarBold = useCallback(() => {
    activeEditor?.chain().focus().toggleBold().run();
  }, [activeEditor]);

  const handleToolbarItalic = useCallback(() => {
    activeEditor?.chain().focus().toggleItalic().run();
  }, [activeEditor]);

  const handleToolbarStrike = useCallback(() => {
    activeEditor?.chain().focus().toggleStrike().run();
  }, [activeEditor]);

  const handleToolbarBulletList = useCallback(() => {
    activeEditor?.chain().focus().toggleBulletList().run();
  }, [activeEditor]);

  const handleToolbarOrderedList = useCallback(() => {
    activeEditor?.chain().focus().toggleOrderedList().run();
  }, [activeEditor]);

  const handleToolbarHeading2 = useCallback(() => {
    activeEditor?.chain().focus().toggleHeading({ level: 2 }).run();
  }, [activeEditor]);

  const handleToolbarHeading3 = useCallback(() => {
    activeEditor?.chain().focus().toggleHeading({ level: 3 }).run();
  }, [activeEditor]);

  const handleToolbarUndo = useCallback(() => {
    activeEditor?.chain().focus().undo().run();
  }, [activeEditor]);

  const handleToolbarRedo = useCallback(() => {
    activeEditor?.chain().focus().redo().run();
  }, [activeEditor]);

  // Block 操作处理函数
  const handleAddBlock = useCallback(() => {
    if (!activeSceneId) return;

    const newBlock: Block = {
      id: nanoid(),
      label: '正文',
      text: '',
    };

    setScript((prev) => {
      if (!prev) return null;
      const sceneIndex = prev.scenes.findIndex((s) => s.id === activeSceneId);
      if (sceneIndex === -1) return prev;

      const updatedScenes = [...prev.scenes];
      updatedScenes[sceneIndex] = {
        ...updatedScenes[sceneIndex],
        content: [...updatedScenes[sceneIndex].content, newBlock],
      };

      return { ...prev, scenes: updatedScenes };
    });

    // 滚动到新 block
    setTimeout(() => {
      const element = document.getElementById(`block-${newBlock.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [activeSceneId]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    if (!activeSceneId) return;

    setScript((prev) => {
      if (!prev) return null;
      const sceneIndex = prev.scenes.findIndex((s) => s.id === activeSceneId);
      if (sceneIndex === -1) return prev;

      const updatedScenes = [...prev.scenes];
      updatedScenes[sceneIndex] = {
        ...updatedScenes[sceneIndex],
        content: updatedScenes[sceneIndex].content.filter((b) => b.id !== blockId),
      };

      return { ...prev, scenes: updatedScenes };
    });

    showToast("区块已删除", "success");
  }, [activeSceneId, showToast]);

  const handleEditBlockLabel = useCallback((blockId: string, newLabel: string) => {
    if (!activeSceneId) return;

    setScript((prev) => {
      if (!prev) return null;
      const sceneIndex = prev.scenes.findIndex((s) => s.id === activeSceneId);
      if (sceneIndex === -1) return prev;

      const updatedScenes = [...prev.scenes];
      updatedScenes[sceneIndex] = {
        ...updatedScenes[sceneIndex],
        content: updatedScenes[sceneIndex].content.map((b) =>
          b.id === blockId ? { ...b, label: newLabel } : b
        ),
      };

      return { ...prev, scenes: updatedScenes };
    });
  }, [activeSceneId]);

  const handleReorderBlocks = useCallback((reorderedBlocks: Block[]) => {
    if (!activeSceneId) return;

    setScript((prev) => {
      if (!prev) return null;
      const sceneIndex = prev.scenes.findIndex((s) => s.id === activeSceneId);
      if (sceneIndex === -1) return prev;

      const updatedScenes = [...prev.scenes];
      updatedScenes[sceneIndex] = {
        ...updatedScenes[sceneIndex],
        content: reorderedBlocks,
      };

      return { ...prev, scenes: updatedScenes };
    });
  }, [activeSceneId]);

  const handlePolishBlock = useCallback(async (block: Block, operation: import('@/lib/models').PolishOperation) => {
    if (!block.text) {
      showToast("没有可润色的内容", "error");
      return;
    }

    try {
      const res = await api<import('@/lib/models').PolishResponse>('/api/polish', {
        method: 'POST',
        body: {
          text: block.text,
          operation,
        },
      });

      // 更新 block 内容
      setScript((prev) => {
        if (!prev) return null;
        const sceneIndex = prev.scenes.findIndex((s) => s.id === activeSceneId);
        if (sceneIndex === -1) return prev;

        const updatedScenes = [...prev.scenes];
        const updatedContent = updatedScenes[sceneIndex].content.map(b =>
          b.id === block.id ? { ...b, text: res.polished } : b
        );
        updatedScenes[sceneIndex] = {
          ...updatedScenes[sceneIndex],
          content: updatedContent,
        };

        return { ...prev, scenes: updatedScenes };
      });

      const operationNames: Record<string, string> = {
        adjust_style: '风格调整',
        simplify: '简化',
        expand: '扩写',
        rewrite: '重写',
      };
      showToast(`${operationNames[operation] || '润色'}完成！`, "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }, [activeSceneId, showToast]);

  const handleGenerateBlock = useCallback((block: Block) => {
    // 生成接口占位
    showToast(`生成功能即将上线：${block.label}`, "info");
    console.log("Generate block:", block);
  }, [showToast]);

  const handleActClick = useCallback((actId: string) => {
    setActiveActId(actId);
    const act = acts.find(a => a.id === actId);
    if (act && script) {
      const actScenes = script.scenes.filter(s => act.sceneIds.includes(s.id));
      if (actScenes[0]) {
        setActiveSceneId(actScenes[0].id);
        setScrollToSceneId(actScenes[0].id);
        setPendingFocus(true);
      }
    }
  }, [acts, script]);

  const handleEditSceneTitle = useCallback((sceneId: string, newTitle: string) => {
    setScript(prev => {
      if (!prev) return null;
      const updatedScenes = prev.scenes.map(scene =>
        scene.id === sceneId ? { ...scene, title: newTitle } : scene
      );
      return { ...prev, scenes: updatedScenes };
    });
  }, []);

  const handleAddAct = useCallback(() => {
    const actNumber = acts.length + 1;
    const timestamp = Date.now();

    const defaultScene: Scene = {
      id: `scene_${timestamp}`,
      title: '直播间',
      order: 1,
      content: createDefaultBlocks(timestamp)
    };

    const newAct: Act = {
      id: `act_${timestamp}`,
      name: `幕${actNumber}`,
      order: actNumber,
      sceneIds: [defaultScene.id]
    };

    const newActs = [...acts, newAct];
    setActs(newActs);
    setActiveActId(newAct.id);
    setActiveSceneId(defaultScene.id);

    setScript(prev => prev ? {
      ...prev,
      acts: newActs,
      scenes: [...prev.scenes, defaultScene]
    } : null);
  }, [acts]);

  const handleEditActName = useCallback((actId: string, newName: string) => {
    const newActs = acts.map(act =>
      act.id === actId ? {...act, name: newName} : act
    );
    setActs(newActs);

    setScript(prev => prev ? { ...prev, acts: newActs } : null);
  }, [acts]);

  const handleReorderActs = useCallback((reorderedActs: Act[]) => {
    setActs(reorderedActs);

    setScript(prev => prev ? { ...prev, acts: reorderedActs } : null);
  }, []);

  const handleAddScene = useCallback(() => {
    if (!activeActId || !script) return;

    const currentAct = acts.find(a => a.id === activeActId);
    if (!currentAct) return;

    const actScenes = script.scenes.filter(s => currentAct.sceneIds.includes(s.id));
    const newOrder = actScenes.length + 1;
    const timestamp = Date.now();

    const newScene: Scene = {
      id: `scene_${timestamp}`,
      title: `场景${newOrder}`,
      order: newOrder,
      content: createDefaultBlocks(timestamp)
    };

    const updatedActs = acts.map(act =>
      act.id === activeActId
        ? { ...act, sceneIds: [...act.sceneIds, newScene.id] }
        : act
    );
    setActs(updatedActs);

    setScript(prev => prev ? {
      ...prev,
      acts: updatedActs,
      scenes: [...prev.scenes, newScene]
    } : null);

    setActiveSceneId(newScene.id);
  }, [activeActId, acts, script]);

  const handleDeleteScene = useCallback((sceneId: string) => {
    if (!activeActId || !script) return;

    const updatedActs = acts.map(act =>
      act.id === activeActId
        ? { ...act, sceneIds: act.sceneIds.filter(id => id !== sceneId) }
        : act
    );
    setActs(updatedActs);

    const updatedScenes = script.scenes.filter(s => s.id !== sceneId);
    setScript(prev => prev ? {
      ...prev,
      acts: updatedActs,
      scenes: updatedScenes
    } : null);

    if (sceneId === activeSceneId) {
      const currentAct = updatedActs.find(a => a.id === activeActId);
      if (currentAct && currentAct.sceneIds.length > 0) {
        const firstScene = updatedScenes.find(s => s.id === currentAct.sceneIds[0]);
        setActiveSceneId(firstScene?.id);
      }
    }
  }, [activeActId, acts, script, activeSceneId]);

  const currentActScenes = useMemo(() => {
    if (!script || !activeActId) return [];
    const currentAct = acts.find(a => a.id === activeActId);
    if (!currentAct) return [];

    // 按照 sceneIds 的顺序返回场景，并更新 order 为实际位置
    return currentAct.sceneIds
      .map((sceneId, index) => {
        const scene = script.scenes.find(s => s.id === sceneId);
        return scene ? { ...scene, order: index + 1 } : null;
      })
      .filter((s): s is Scene => s !== null);
  }, [script, activeActId, acts]);

  const activeScene = useMemo(() => {
    return script?.scenes.find(s => s.id === activeSceneId);
  }, [script, activeSceneId]);

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Block 拖拽排序处理
  const handleBlockDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !activeScene || active.id === over.id) return;

    const oldIndex = activeScene.content.findIndex((b) => b.id === active.id);
    const newIndex = activeScene.content.findIndex((b) => b.id === over.id);

    const reordered = arrayMove(activeScene.content, oldIndex, newIndex);
    handleReorderBlocks(reordered);
  }, [activeScene, handleReorderBlocks]);

  const keyboardShortcuts = useMemo(() => [
    { key: "s", ctrl: true, action: handleManualSave, description: "Save script" },
    { key: "r", ctrl: true, action: handleRegenerateScene, description: "Regenerate scene" },
    { key: "e", ctrl: true, action: handleExportText, description: "Export script as text" },
    { key: "p", ctrl: true, shift: true, action: handleExportPDF, description: "Export script as PDF" },
    { key: "ArrowUp", ctrl: true, action: handlePreviousScene, description: "Previous scene" },
    { key: "ArrowDown", ctrl: true, action: handleNextScene, description: "Next scene" },
  ], [handleManualSave, handleRegenerateScene, handleExportText, handleExportPDF, handlePreviousScene, handleNextScene]);

  useEffect(() => {
    if (pendingFocus && activeSceneId) {
      const editorId = `editor-${activeSceneId}-0`;
      const element = document.getElementById(editorId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setPendingFocus(false);
      setScrollToSceneId(undefined);
    }
  }, [activeSceneId, pendingFocus]);

  useKeyboardShortcuts(keyboardShortcuts);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  return (
    <>
      <div className="flex flex-col min-h-screen bg-[var(--at-bg)]">
          <AppHeader
            projectName={script?.title}
            onToggleInspirationPanel={handleToggleInspirationPanel}
            onToggleHistoryPanel={handleToggleHistoryPanel}
          />

          <div className={cn(
            "grid grid-cols-1 md:grid-cols-[300px_1fr] h-[calc(100vh-135px)]",
            isLargeScreen && !inspirationPanelCollapsed && "lg:grid-cols-[300px_1fr_320px]",
            isLargeScreen && showHistoryPanel && "lg:grid-cols-[300px_1fr_400px]"
          )}>
            <aside aria-label="Scene list" className="hidden md:block border-r border-[var(--at-border)] overflow-hidden sticky top-0 z-10 p-2 md:p-4 pb-0 bg-[var(--at-surface)]">
              <div className="flex items-baseline gap-2 pb-3 border-b border-[var(--at-border-light)] mb-3">
                <h1 className="text-sm font-semibold text-[var(--at-text)]">场景列表</h1>
                <span className="text-xs font-medium text-[var(--at-accent)] bg-[var(--at-accent-light)] px-2 py-0.5 rounded-full">{currentActScenes.length}</span>
              </div>
              {currentActScenes.length > 0 && (
                <SceneList
                  key={activeActId}
                  scenes={currentActScenes}
                  activeSceneId={activeSceneId}
                  scrollToSceneId={scrollToSceneId}
                  onSceneClick={handleSceneClick}
                  onReorder={handleSceneReorder}
                  onAddScene={handleAddScene}
                  onDeleteScene={handleDeleteScene}
                  onEditSceneTitle={handleEditSceneTitle}
                />
              )}
            </aside>
          <main aria-label="Script editor" className="border-r border-[var(--at-border)] overflow-y-auto relative bg-[var(--at-surface)]">
        {isDialogueMode ? (
          // 对话式画布模式
          <div className="h-full flex flex-col">
            <div className="p-3 md:p-4 pb-2 border-b border-[var(--at-border)]">
              <div className="flex items-center justify-between">
                <h1 className="text-sm font-semibold text-[var(--at-text)]">对话分支画布</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <DropdownMenu open={showExportMenu} onOpenChange={setShowExportMenu}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-1.5 text-xs h-7 px-3 rounded-lg text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] hover:text-[var(--at-text)] transition-colors"
                        aria-label="Export options"
                      >
                        <Download size={14} />
                        导出
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          handleExportText();
                          setShowExportMenu(false);
                        }}
                      >
                        📄 文本格式
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          handleExportPDF();
                          setShowExportMenu(false);
                        }}
                      >
                        📑 PDF 格式
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          handleExportJSON();
                          setShowExportMenu(false);
                        }}
                      >
                        🗂 JSON 完整数据
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {lastSaved && (
                    <span className="text-[10px] hidden sm:inline text-[var(--at-text-tertiary)]">{formatLastSaved()}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 relative">
              {script && projectId && (
                <BranchingCanvas
                  script={script}
                  projectId={projectId}
                  onOpenBlock={(blockId) => {
                    console.log('Open block for editing:', blockId);
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          // 原线性编辑模式
          <>
            {/* 固定的标题栏和工具栏 - 液态玻璃效果 */}
            <div className="sticky top-0 z-10 bg-[var(--at-surface)] border-b border-[var(--at-border-light)]">
              <div className="p-3 md:p-4 pb-0">
                <div className="flex items-center justify-between">
                  <h1 className="text-sm font-semibold text-[var(--at-text)]">剧本区</h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeSceneId && (
                      <>
                        <button
                          onClick={handleAddBlock}
                          className="flex items-center gap-1.5 text-xs h-7 px-3 rounded-lg text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] hover:text-[var(--at-text)] transition-colors"
                          aria-label="添加区块"
                        >
                          <Plus size={14} />
                          添加区
                        </button>
                        <button
                          onClick={handleRegenerateScene}
                          disabled={regenerating}
                          aria-label="Regenerate current scene with AI"
                          aria-busy={regenerating}
                          className="flex items-center gap-1.5 text-xs h-7 px-3 rounded-lg text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] hover:text-[var(--at-text)] transition-colors disabled:opacity-40"
                        >
                          <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} />
                          {regenerating ? "生成中..." : "重新生成"}
                        </button>
                      </>
                    )}
                    <DropdownMenu open={showExportMenu} onOpenChange={setShowExportMenu}>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center gap-1.5 text-xs h-7 px-3 rounded-lg text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] hover:text-[var(--at-text)] transition-colors"
                          aria-label="Export options"
                        >
                          <Download size={14} />
                          导出
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            handleExportText();
                            setShowExportMenu(false);
                          }}
                        >
                          📄 文本格式
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleExportPDF();
                            setShowExportMenu(false);
                          }}
                        >
                          📑 PDF 格式
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleExportSRT();
                            setShowExportMenu(false);
                          }}
                        >
                          📝 SRT 字幕
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleExportTeleprompter();
                            setShowExportMenu(false);
                          }}
                        >
                          📺 提词器
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleExportMarkdown();
                            setShowExportMenu(false);
                          }}
                        >
                          📋 Markdown 格式
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleExportDocx();
                            setShowExportMenu(false);
                          }}
                        >
                          📘 Word 文档
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleExportJSON();
                            setShowExportMenu(false);
                          }}
                        >
                          🗂 JSON 完整数据
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {lastSaved && (
                      <span className="text-[10px] hidden sm:inline text-[var(--at-text-tertiary)]">{formatLastSaved()}</span>
                    )}
                  </div>
                </div>

                <div className="border-t border-[var(--at-border-light)] py-2 mb-3 flex items-center gap-0 overflow-x-auto">
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={handleToolbarBold}
                      disabled={!editorState.canBold}
                      className={cn("p-1.5 rounded-md transition-colors text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] disabled:opacity-40", editorState.isBold && "bg-[var(--at-surface-active)] text-[var(--at-accent)]")}
                      aria-label="粗体"
                    >
                      <Bold size={15} />
                    </button>
                    <button
                      onClick={handleToolbarItalic}
                      disabled={!editorState.canItalic}
                      className={cn("p-1.5 rounded-md transition-colors text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] disabled:opacity-40", editorState.isItalic && "bg-[var(--at-surface-active)] text-[var(--at-accent)]")}
                      aria-label="斜体"
                    >
                      <Italic size={15} />
                    </button>
                    <button
                      onClick={handleToolbarStrike}
                      disabled={!editorState.canStrike}
                      className={cn("p-1.5 rounded-md transition-colors text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] disabled:opacity-40", editorState.isStrike && "bg-[var(--at-surface-active)] text-[var(--at-accent)]")}
                      aria-label="删除线"
                    >
                      <Strikethrough size={15} />
                    </button>
                  </div>
                  <div className="w-px h-4 bg-[var(--at-border-light)] mx-1" />
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={handleToolbarBulletList}
                      className={cn("p-1.5 rounded-md transition-colors text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)]", editorState.isBulletList && "bg-[var(--at-surface-active)] text-[var(--at-accent)]")}
                      aria-label="无序列表"
                    >
                      <List size={15} />
                    </button>
                    <button
                      onClick={handleToolbarOrderedList}
                      className={cn("p-1.5 rounded-md transition-colors text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)]", editorState.isOrderedList && "bg-[var(--at-surface-active)] text-[var(--at-accent)]")}
                      aria-label="有序列表"
                    >
                      <ListOrdered size={15} />
                    </button>
                  </div>
                  <div className="w-px h-4 bg-[var(--at-border-light)] mx-1" />
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={handleToolbarHeading2}
                      className={cn("p-1.5 rounded-md transition-colors text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)]", editorState.isHeading2 && "bg-[var(--at-surface-active)] text-[var(--at-accent)]")}
                      aria-label="标题2"
                    >
                      <Heading2 size={15} />
                    </button>
                    <button
                      onClick={handleToolbarHeading3}
                      className={cn("p-1.5 rounded-md transition-colors text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)]", editorState.isHeading3 && "bg-[var(--at-surface-active)] text-[var(--at-accent)]")}
                      aria-label="标题3"
                    >
                      <Heading3 size={15} />
                    </button>
                  </div>
                  <div className="w-px h-4 bg-[var(--at-border-light)] mx-1" />
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={handleToolbarUndo}
                      disabled={!editorState.canUndo}
                      className="p-1.5 rounded-md transition-colors text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] disabled:opacity-40"
                      aria-label="撤销"
                    >
                      <Undo2 size={15} />
                    </button>
                    <button
                      onClick={handleToolbarRedo}
                      disabled={!editorState.canRedo}
                      className="p-1.5 rounded-md transition-colors text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] disabled:opacity-40"
                      aria-label="重做"
                    >
                      <Redo2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 可滚动的内容区域 */}
            <div className="p-3 md:p-4 pt-0">
              {activeScene && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleBlockDragEnd}
                >
                  <SortableContext
                    items={activeScene.content.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4" key={activeSceneId}>
                      {activeScene.content.map((block, index) => (
                        <div key={block.id} id={`block-${block.id}`}>
                          <EditorBlock
                            block={block}
                            onChange={(newContent) => {
                              setScript((prev) => {
                                if (!prev) return null;
                                const sceneIndex = prev.scenes.findIndex(
                                  (s) => s.id === activeSceneId
                                );
                                if (sceneIndex === -1) return prev;

                                const updatedScenes = [...prev.scenes];
                                const updatedContent = updatedScenes[sceneIndex].content.map(b =>
                                  b.id === block.id ? { ...b, text: newContent } : b
                                );
                                updatedScenes[sceneIndex] = {
                                  ...updatedScenes[sceneIndex],
                                  content: updatedContent,
                                };

                                return { ...prev, scenes: updatedScenes };
                              });
                            }}
                            onLabelChange={(newLabel) => handleEditBlockLabel(block.id, newLabel)}
                            onDelete={() => handleDeleteBlock(block.id)}
                            onPolish={(operation) => handlePolishBlock(block, operation)}
                            onGenerate={() => handleGenerateBlock(block)}
                            onEditorReady={handleEditorReady}
                            editorId={index === 0 ? `editor-${activeSceneId}-0` : undefined}
                            autoFocus={index === 0 && pendingFocus}
                          />
                        </div>
                      ))}
                      {activeScene.content.length === 0 && (
                        <p className="text-sm italic text-[var(--at-text-tertiary)]">
                          暂无内容。点击 &ldquo;添加区&rdquo; 或 &ldquo;重新生成&rdquo; 来添加内容。
                        </p>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </>
        )}
      </main>
            {/* 灵感面板 */}
            {isLargeScreen && !inspirationPanelCollapsed && projectId && (
              <aside aria-label="Inspiration suggestions" className="bg-[var(--at-surface)] border-l border-[var(--at-border)] overflow-hidden p-4">
                <InspirationPanel
                  projectId={projectId}
                  sceneId={activeSceneId}
                  onInsert={handleInsertInspiration}
                  onFavorite={handleFavoriteInspiration}
                  onCollapse={handleToggleInspirationPanel}
                />
              </aside>
            )}

            {/* 历史版本面板 */}
            {isLargeScreen && showHistoryPanel && projectId && (
              <aside aria-label="Version History" className="bg-[var(--at-surface)] border-l border-[var(--at-border)] overflow-hidden p-4">
                <ScriptVersionHistory
                  projectId={projectId}
                  onRevert={handleHistoryRevert}
                />
                <div className="mt-4">
                  <Button
                    onClick={handleToggleHistoryPanel}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    关闭
                  </Button>
                </div>
              </aside>
            )}
          </div>

          <TimelineBeats
            acts={acts}
            activeActId={activeActId}
            onActClick={handleActClick}
            onAddAct={handleAddAct}
            onEditActName={handleEditActName}
            onReorderActs={handleReorderActs}
          />
      </div>

      {showCandidates && (
        <SceneGeneratePanel
          candidates={candidates}
          onInsert={handleInsertCandidate}
          onReplace={handleReplaceCandidate}
          onClose={() => {
            setShowCandidates(false);
            setCandidates([]);
          }}
        />
      )}

    </>
  );
}
