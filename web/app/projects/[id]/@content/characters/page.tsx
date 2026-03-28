/**
 * Character Management Page - Character library + Relation graph (side by side)
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { CharacterImageGenerator } from "@/components/characters/CharacterImageGenerator";
import { CharacterAssetsList } from "@/components/characters/CharacterAssetsList";
import { CharacterRelationPanel } from "@/components/characters/CharacterRelationPanel";
import { api } from "@/lib/api/client";
import type { Script, CharacterImageAsset } from "@/lib/models";
import {
  getProjectCharacterAssets,
  addProjectCharacterAsset,
  updateProjectCharacterAsset,
  type CharacterImageAssetLocal,
} from "@/lib/storage/local";
import { listRelations, createRelation, deleteRelation } from "@/lib/api/relations";
import { getProjectAssets } from "@/lib/utils/exporter";
import { useToast } from "@/components/ui/Toast";
import { ChevronLeft, ChevronRight, Loader2, Network, Users } from "lucide-react";
import { useAIChat } from "@/app/ai-chat-provider";
import { extractCharactersJson } from "@/lib/utils/json-context-extractor";

interface Node {
  id: string;
  characterId: string;
  characterName: string;
  description?: string;
  alias?: string;
  imageUrl?: string;
  x: number;
  y: number;
}

interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  type?: "family" | "friend" | "colleague" | "rival" | "lover" | "other";
}

export default function CharactersPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { showToast } = useToast();
  const { updateJsonData } = useAIChat();
  
  const [script, setScript] = useState<Script | undefined>();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [totalCharacterCount, setTotalCharacterCount] = useState(0);
  const [highlightedCharacterId, setHighlightedCharacterId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<CharacterImageAsset[]>([]);

  // Load script, character assets, and relations from backend
  useEffect(() => {
    async function loadData() {
      if (!projectId) return;

      setLoading(true);
      try {
        // Load script (optional - characters page works without it)
        try {
          const scriptRes = await api<Script>(`/api/projects/${projectId}/script`);
          setScript(scriptRes);
        } catch (scriptError) {
          console.warn("Script not found, continuing without it:", scriptError);
          setScript(undefined);
        }

        // Load character assets and relations in parallel
        const [assetsResult, relationsResult] = await Promise.all([
          getProjectAssets(projectId, { type: 'character' }),
          listRelations(projectId),
        ]);

        // 保存角色数据用于AI上下文（转换 name → characterName）
        setCharacters(assetsResult.characters.map(c => ({
          id: c.id,
          characterName: c.name,
          description: c.description,
          alias: c.alias,
          images: c.images,
          createdAt: new Date().toISOString(),
        })));

        // Transform assets to nodes (with random positions for new nodes)
        const existingNodePositions = new Map<string, { x: number; y: number }>();
        
        // Load existing positions from localStorage for migration
        const localGraph = localStorage.getItem(`graph_nodes_${projectId}`);
        if (localGraph) {
          try {
            const parsed = JSON.parse(localGraph);
            if (Array.isArray(parsed)) {
            parsed.forEach((n: { characterId?: string; x?: number; y?: number }) => {
              if (n.characterId && n.x !== undefined && n.y !== undefined) {
                existingNodePositions.set(n.characterId, { x: n.x, y: n.y });
              }
            });
            }
          } catch (e) {
            console.warn('Failed to parse local graph positions:', e);
          }
        }

        const remoteNodes: Node[] = assetsResult.characters.map((char, idx) => {
          const existingPos = existingNodePositions.get(char.id);
          return {
            id: char.id,
            characterId: char.id,
            characterName: char.name,
            description: char.description,
            alias: (char as { alias?: string }).alias,
            imageUrl: char.images && char.images.length > 0 ? char.images[0].url : undefined,
            x: existingPos?.x ?? 100 + (idx % 5) * 250,
            y: existingPos?.y ?? 100 + Math.floor(idx / 5) * 200,
          };
        });

        // Transform relations to edges
        const remoteEdges: Edge[] = relationsResult.data.map((rel) => ({
          id: rel.id,
          sourceId: rel.nodeAId,
          targetId: rel.nodeBId,
          label: rel.type,
          type: rel.type as Edge['type'],
        }));

        setNodes(remoteNodes);
        setEdges(remoteEdges);

        console.log(`Loaded ${remoteNodes.length} nodes and ${remoteEdges.length} edges from backend`);
      } catch (err) {
        console.error("Failed to load data:", err);
        showToast("加载关系图失败", "error");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [projectId, showToast]);

  // Handle new character generation - auto-add to relation panel
  const handleGenerated = (asset: CharacterImageAsset) => {
    // Check if character already exists in nodes and add if not
    setNodes((prevNodes) => {
      if (prevNodes.some((n) => n.characterId === asset.id)) {
        return prevNodes;
      }
      const newNode: Node = {
        id: asset.id, // Use characterId as node ID
        characterId: asset.id,
        characterName: asset.characterName,
        description: asset.description,
        alias: asset.alias,
        imageUrl: asset.images && asset.images.length > 0 ? asset.images[0].url : undefined,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      };
      console.log('Adding generated character to graph:', newNode);
      showToast(`角色 "${asset.characterName}" 已添加到关系图`, "success");
      return [...prevNodes, newNode];
    });
    setRefreshTrigger((prev) => prev + 1);
  };

  // Handle new character upload - auto-add to relation panel
  const handleUploaded = (asset: CharacterImageAsset) => {
    setRefreshTrigger((prev) => prev + 1);
    
    // Add to relation panel - use functional update to avoid stale closure
    setNodes((prevNodes) => {
      if (prevNodes.some((n) => n.characterId === asset.id)) {
        return prevNodes;
      }
      const newNode: Node = {
        id: asset.id, // Use characterId as node ID
        characterId: asset.id,
        characterName: asset.characterName,
        description: asset.description,
        alias: asset.alias,
        imageUrl: asset.images && asset.images.length > 0 ? asset.images[0].url : undefined,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      };
      console.log('Adding uploaded character to graph:', newNode);
      showToast(`角色 "${asset.characterName}" 已添加到关系图`, "success");
      return [...prevNodes, newNode];
    });
  };

  // Handle save relation graph - Now saves node positions to localStorage only
  // Relations are already saved to backend when created/deleted
  const handleSaveRelations = async () => {
    try {
      // Save node positions to localStorage for next load
      const nodePositions = nodes.map((n) => ({
        characterId: n.characterId,
        x: n.x,
        y: n.y,
      }));
      
      localStorage.setItem(`graph_nodes_${projectId}`, JSON.stringify(nodePositions));
      showToast("节点位置已保存", "success");
    } catch (error) {
      console.error("Failed to save node positions:", error);
      showToast("保存节点位置失败", "error");
    }
  };

  // Handle add new character from relation panel
  const handleAddCharacter = async (pos?: { x: number; y: number }) => {
    const characterName = prompt("请输入角色名称：");
    if (!characterName?.trim()) return;

    let assetId = `char_manual_${Date.now()}`;
    
    // Try to create on backend first
    try {
      const result = await api<{ id: string; name: string; description?: string; images: unknown[] }>(`/api/projects/${projectId}/characters/assets`, {
        method: "POST",
        body: {
          name: characterName.trim(),
          description: "手动创建",
          images: [],
        },
      });
      
      // Use backend ID if successful
      if (result.id) {
        assetId = result.id;
      }
    } catch (err) {
      console.error("Failed to create character asset on backend:", err);
      // Continue with local ID
    }

    // Create local asset with the correct ID
    const newAsset: CharacterImageAssetLocal = {
      id: assetId,
      characterName: characterName.trim(),
      description: "手动创建",
      images: [],
      createdAt: new Date().toISOString(),
    };

    // Save to local storage
    addProjectCharacterAsset(projectId, newAsset);

    // Add to relation panel - use functional update to avoid stale closure
    const newNode: Node = {
      id: newAsset.id, // Use characterId as node ID
      characterId: newAsset.id,
      characterName: newAsset.characterName,
      description: newAsset.description,
      alias: newAsset.alias,
      imageUrl: newAsset.images && newAsset.images.length > 0 ? newAsset.images[0].url : undefined,
      x: pos?.x ?? 100 + Math.random() * 200,
      y: pos?.y ?? 100 + Math.random() * 200,
    };
    setNodes((prevNodes) => {
      // Check if node already exists
      if (prevNodes.some(n => n.characterId === newAsset.id)) {
        return prevNodes;
      }
      const updatedNodes = [...prevNodes, newNode];
      console.log('Adding new node:', newNode, 'Total nodes:', updatedNodes.length);
      return updatedNodes;
    });
    setRefreshTrigger((prev) => prev + 1);
    showToast(`角色 "${characterName}" 已创建并添加到关系图`, "success");
  };

  // Handle delete character from library - deletes from backend (cascades to relations)
  const handleDeleteCharacterFromList = useCallback(async (characterId: string) => {
    try {
      // Delete character asset from backend (relations will be cascade deleted)
      await api(`/api/projects/${projectId}/characters/assets/${characterId}`, {
        method: 'DELETE',
      });

      // Remove from local state
      const updatedNodes = nodes.filter((n) => n.characterId !== characterId);
      const updatedEdges = edges.filter(
        (e) => e.sourceId !== characterId && e.targetId !== characterId
      );
      
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      
      showToast("角色已删除", "success");
    } catch (error) {
      console.error("Failed to delete character:", error);
      showToast("删除角色失败", "error");
    }
  }, [projectId, nodes, edges, showToast]);

  // Handle delete node from graph - deletes character asset (cascades to relations)
  const handleDeleteNodeFromGraph = useCallback(async (characterId: string) => {
    try {
      // Delete character asset from backend (relations will be cascade deleted)
      await api(`/api/projects/${projectId}/characters/assets/${characterId}`, {
        method: 'DELETE',
      });

      // Remove from local state
      const updatedNodes = nodes.filter((n) => n.characterId !== characterId);
      const updatedEdges = edges.filter(
        (e) => e.sourceId !== characterId && e.targetId !== characterId
      );
      
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      
      showToast("角色已删除", "success");
    } catch (error) {
      console.error("Failed to delete character:", error);
      showToast("删除角色失败", "error");
    }
  }, [projectId, nodes, edges, showToast]);

  // Handle rename character - sync between library and graph
  const handleRenameCharacter = useCallback(async (characterId: string, newName: string) => {
    // Update nodes
    const updatedNodes = nodes.map((n) =>
      n.characterId === characterId ? { ...n, characterName: newName } : n
    );
    setNodes(updatedNodes);
    
    // Update local asset
    const assets = getProjectCharacterAssets(projectId);
    const asset = assets.find((a) => a.id === characterId);
    if (asset) {
      const updatedAsset = {
        ...asset,
        characterName: newName,
      };
      updateProjectCharacterAsset(projectId, updatedAsset);
      
      // Update backend
      try {
        await api(`/api/projects/${projectId}/characters/assets/${characterId}`, {
          method: "PUT",
          body: {
            name: newName,
            description: asset.description,
            alias: asset.alias,
            images: asset.images,
          },
        });
      } catch (err) {
        console.error("Failed to update backend:", err);
      }
    }
    
    // Trigger refresh to update library
    setRefreshTrigger((prev) => prev + 1);
  }, [projectId, nodes]);

  // Sync node metadata from assets whenever refreshTrigger changes
  useEffect(() => {
    if (nodes.length === 0) return;
    
    const assets = getProjectCharacterAssets(projectId);
    const updatedNodes = nodes.map((node) => {
      const asset = assets.find((a) => a.id === node.characterId);
      if (asset) {
        return {
          ...node,
          characterName: asset.characterName,
          description: asset.description,
          alias: asset.alias,
          imageUrl: asset.images && asset.images.length > 0 ? asset.images[0].url : undefined,
        };
      }
      return node;
    });
    
    // Only update if there are actual changes
    if (JSON.stringify(updatedNodes) !== JSON.stringify(nodes)) {
      setNodes(updatedNodes);
    }
  }, [refreshTrigger, projectId, nodes]);

  // 注册到AI聊天上下文：当characters变化时更新JSON数据
  useEffect(() => {
    if (characters && characters.length > 0) {
      const jsonData = extractCharactersJson(characters);
      updateJsonData(jsonData);
    } else {
      updateJsonData(null);
    }
  }, [characters, updateJsonData]);

  // 监听AI修改数据事件，刷新characters
  useEffect(() => {
    const handleDataUpdated = async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.pageType === 'characters' && projectId) {
        try {
          // 重新加载角色数据
          const assetsResult = await getProjectAssets(projectId, { type: 'character' });
          setCharacters(assetsResult.characters.map(c => ({
            id: c.id,
            characterName: c.name,
            description: c.description,
            alias: c.alias,
            images: c.images,
            createdAt: new Date().toISOString(),
          })));
          setRefreshTrigger((prev) => prev + 1);
          showToast("数据已更新", "success");
        } catch (err) {
          console.error("Failed to reload characters after AI update:", err);
        }
      }
    };

    window.addEventListener('ai-chat-data-updated', handleDataUpdated);
    return () => {
      window.removeEventListener('ai-chat-data-updated', handleDataUpdated);
    };
  }, [projectId, showToast]);

  // Handle edges change - create/delete relations via backend API
  const handleEdgesChange = useCallback(async (newEdges: Edge[]) => {
    // Find new edges (created)
    const newEdgeIds = new Set(newEdges.map((e) => e.id));
    const oldEdgeIds = new Set(edges.map((e) => e.id));
    
    // Find created edges
    const createdEdges = newEdges.filter((e) => !oldEdgeIds.has(e.id));
    
    // Find deleted edges
    const deletedEdges = edges.filter((e) => !newEdgeIds.has(e.id));
    
    // Update local state immediately (optimistic)
    setEdges(newEdges);
    
    // Handle created edges
    for (const edge of createdEdges) {
      try {
        // Skip temp IDs that start with 'edge_' - will be replaced after backend creation
        if (edge.id.startsWith('edge_')) {
          // Map node IDs to characterIds
          const sourceNode = nodes.find((n) => n.id === edge.sourceId);
          const targetNode = nodes.find((n) => n.id === edge.targetId);
          
          if (!sourceNode || !targetNode) {
            console.error('Node not found for edge:', edge);
            setEdges((prevEdges) => prevEdges.filter((e) => e.id !== edge.id));
            showToast('找不到节点', 'error');
            continue;
          }
          
          const result = await createRelation(projectId, {
            sourceId: sourceNode.characterId,
            targetId: targetNode.characterId,
            type: edge.label || edge.type,
          });
          
          // Update the edge with real ID from backend
          setEdges((prevEdges) =>
            prevEdges.map((e) =>
              e.id === edge.id ? { ...e, id: result.data.id } : e
            )
          );
          
          console.log('Created relation:', result.data.id);
          showToast('关系已创建', 'success');
        }
      } catch (error) {
        console.error('Failed to create relation:', error);
        // Rollback: remove the failed edge
        setEdges((prevEdges) => prevEdges.filter((e) => e.id !== edge.id));
        showToast('创建关系失败', 'error');
      }
    }
    
    // Handle deleted edges
    for (const edge of deletedEdges) {
      try {
        // Skip temp IDs
        if (!edge.id.startsWith('edge_')) {
          await deleteRelation(projectId, edge.id);
          console.log('Deleted relation:', edge.id);
          showToast('关系已删除', 'success');
        }
      } catch (error) {
        console.error('Failed to delete relation:', error);
        // Rollback: re-add the edge
        setEdges((prevEdges) => [...prevEdges, edge]);
        showToast('删除关系失败', 'error');
      }
    }
  }, [projectId, edges, nodes, showToast]);

  // Handle select character - sync selection state
  const handleSelectCharacter = useCallback((characterId: string) => {
    setHighlightedCharacterId(characterId);
    setSelectedCharacterId(characterId);
  }, []);

  // Get character IDs that are in the relation panel
  const characterIdsInPanel = new Set(nodes.map((n) => n.characterId));

  return (
    <div className="h-full flex flex-col bg-[var(--at-bg)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--at-border)] flex-shrink-0 bg-[var(--at-bg)]">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-[var(--at-text)] tracking-tight">角色管理</h1>
          <span className="text-xs font-medium text-[var(--at-accent)] bg-[var(--at-accent-light)] px-2 py-0.5 rounded-full">{totalCharacterCount}</span>
        </div>
        <p className="text-sm text-[var(--at-text-tertiary)] mt-1">
          角色库与关系图 · 拖拽构建角色关系网络
        </p>
      </div>

      {/* Main Content: Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Character Library */}
        <div
          className={`border-r border-[var(--at-border)] transition-all duration-200 flex flex-col bg-[var(--at-bg)] ${
            leftPanelCollapsed ? "w-0" : "w-72"
          }`}
        >
          {!leftPanelCollapsed && (
            <>
              <div className="px-4 py-3 border-b border-[var(--at-border)] flex items-center justify-between flex-shrink-0">
                <div>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-sm font-semibold text-[var(--at-text)]">角色库</h2>
                    <span className="text-xs font-medium text-[var(--at-accent)] bg-[var(--at-accent-light)] px-2 py-0.5 rounded-full">{totalCharacterCount}</span>
                  </div>
                </div>
                <button
                  onClick={() => setLeftPanelCollapsed(true)}
                  className="p-1 transition-colors text-[var(--at-text-tertiary)]"
                  title="收起"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden p-4">
                <CharacterAssetsList
                  projectId={projectId}
                  refreshTrigger={refreshTrigger}
                  filterCharacterIds={Array.from(characterIdsInPanel)}
                  onCountChange={setTotalCharacterCount}
                  highlightId={highlightedCharacterId}
                  onDeleteCharacter={handleDeleteCharacterFromList}
                  onRenameCharacter={handleRenameCharacter}
                  onSelectCharacter={handleSelectCharacter}
                />
              </div>
            </>
          )}
        </div>

        {/* Collapse/Expand Button for Left Panel */}
        {leftPanelCollapsed && (
          <button
            onClick={() => setLeftPanelCollapsed(false)}
            className="w-8 border-r border-[var(--at-border)] flex items-center justify-center transition-colors flex-shrink-0 bg-[var(--at-bg)] text-[var(--at-text-tertiary)]"
            title="展开角色库"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Middle Column: Relation Graph */}
        <div className="flex-1 overflow-hidden p-4 relative bg-[var(--at-surface-sunken)]">
          {loading ? (
            <div className="flex items-center justify-center h-full bg-[var(--at-surface)] border border-[var(--at-border)] rounded-xl animate-fade-in">
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="w-8 h-8 text-[var(--at-text-tertiary)] animate-spin" />
                <p className="text-sm font-medium text-[var(--at-text-secondary)]">加载关系图...</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-[var(--at-surface)] border border-[var(--at-border)] rounded-xl animate-fade-in">
              <div className="flex flex-col items-center gap-3 text-center">
                <Network className="w-8 h-8 text-[var(--at-text-tertiary)]" />
                <p className="text-sm font-medium text-[var(--at-text-secondary)]">暂无角色数据</p>
                <p className="text-xs text-[var(--at-text-tertiary)]">请先创建或上传角色</p>
              </div>
            </div>
          ) : (
            <CharacterRelationPanel
              nodes={nodes}
              edges={edges}
              onNodesChange={setNodes}
              onEdgesChange={handleEdgesChange}
              onSave={handleSaveRelations}
              onAddCharacter={handleAddCharacter}
              onNodeSelected={(id) => {
                setHighlightedCharacterId(id);
                setSelectedCharacterId(id);
              }}
              onNodeDelete={handleDeleteNodeFromGraph}
              onRenameCharacter={handleRenameCharacter}
              selectedCharacterId={selectedCharacterId}
            />
          )}
        </div>

        {/* Right Column: Character Generator */}
        <div className="w-96 border-l border-[var(--at-border)] flex flex-col overflow-hidden bg-[var(--at-bg)]">
          <div className="px-4 py-3 border-b border-[var(--at-border)] flex-shrink-0">
            <h2 className="text-sm font-semibold text-[var(--at-text)]">生成角色图片</h2>
            <p className="text-xs mt-0.5 text-[var(--at-text-tertiary)]">
              AI 生成或上传图片
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <CharacterImageGenerator
              projectId={projectId}
              script={script}
              onGenerated={handleGenerated}
              onUploaded={handleUploaded}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
