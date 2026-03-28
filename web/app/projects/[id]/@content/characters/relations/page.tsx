/**
 * Character Relations Board - Draggable relationship graph
 */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Save, Plus, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";
import type { CharacterRelationGraph } from "@/lib/models";
import { getRelationGraph, setRelationGraph } from "@/lib/storage/local";
import { getProjectCharacterAssets } from "@/lib/storage/local";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface Node {
  id: string;
  characterId: string;
  characterName: string;
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

const EDGE_TYPES = [
  { value: "family", label: "家人", color: "#dc2626" },
  { value: "friend", label: "朋友", color: "#16a34a" },
  { value: "colleague", label: "同事", color: "#2563eb" },
  { value: "rival", label: "对手", color: "#ea580c" },
  { value: "lover", label: "恋人", color: "#db2777" },
  { value: "other", label: "其他", color: "#64748b" },
] as const;

export default function CharacterRelationsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<string | null>(null);
  const [availableCharacters, setAvailableCharacters] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    async function loadData() {
      if (!projectId) return;

      try {
        // Load characters
        const chars = getProjectCharacterAssets(projectId);
        setAvailableCharacters(
          chars.map((c) => ({ id: c.id, name: c.characterName }))
        );

        // Load relation graph
        const localGraph = getRelationGraph(projectId);
        if (localGraph) {
          const transformedNodes = localGraph.nodes.map((n) => {
            const char = chars.find((c) => c.id === n.characterId);
            return {
              id: n.id,
              characterId: n.characterId,
              characterName: char?.characterName || "未知角色",
              x: n.x,
              y: n.y,
            };
          });
          setNodes(transformedNodes);
          setEdges(localGraph.edges);
        }
      } catch (err) {
        console.error("Failed to load relations:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [projectId]);

  const handleSave = async () => {
    const graph: CharacterRelationGraph = {
      id: `graph_${projectId}`,
      projectId,
      nodes: nodes.map((n) => ({
        id: n.id,
        characterId: n.characterId,
        x: n.x,
        y: n.y,
      })),
      edges,
      updatedAt: new Date().toISOString(),
    };

    // Save locally
    setRelationGraph(projectId, graph);

    // Save to API (mock)
    try {
      await api(`/api/projects/${projectId}/characters/relations`, {
        method: "POST",
        body: graph,
      });
      showToast("关系图已保存", "success");
    } catch (err) {
      console.error("Failed to save relation graph:", err);
      showToast("保存失败（但本地已保存）", "error");
    }
  };

  const handleAddNode = (characterId: string) => {
    const character = availableCharacters.find((c) => c.id === characterId);
    if (!character) return;

    // Check if already exists
    if (nodes.some((n) => n.characterId === characterId)) {
      showToast("该角色已存在", "error");
      return;
    }

    const newNode: Node = {
      id: `node_${Date.now()}`,
      characterId,
      characterName: character.name,
      x: 50 + Math.random() * 200,
      y: 50 + Math.random() * 200,
    };
    setNodes([...nodes, newNode]);
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (connecting) return;
    setDragging(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setDragOffset({
        x: e.clientX - node.x,
        y: e.clientY - node.y,
      });
    }
    setSelectedNode(nodeId);
    setSelectedEdge(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragging
            ? { ...n, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
            : n
        )
      );
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const handleStartConnection = (nodeId: string) => {
    setConnecting(nodeId);
  };

  const handleEndConnection = (targetId: string) => {
    if (connecting && connecting !== targetId) {
      const newEdge: Edge = {
        id: `edge_${Date.now()}`,
        sourceId: connecting,
        targetId,
        type: "friend",
      };
      setEdges([...edges, newEdge]);
    }
    setConnecting(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) =>
      prev.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId)
    );
    setSelectedNode(null);
  };

  const handleDeleteEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    setSelectedEdge(null);
  };

  const updateEdge = (edgeId: string, updates: Partial<Edge>) => {
    setEdges((prev) =>
      prev.map((e) => (e.id === edgeId ? { ...e, ...updates } : e))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold jp-serif">角色关系图</h1>
          <p className="text-sm text-slate-500 mt-1">
            拖拽节点构建角色关系，点击节点连线
          </p>
        </div>
        <Button onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" />
          保存
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Available Characters */}
        <aside className="w-64 bg-white border-r border-slate-200 p-4 overflow-auto">
          <h3 className="font-semibold mb-3">可用角色</h3>
          {availableCharacters.length === 0 ? (
            <p className="text-sm text-slate-400 italic">暂无角色</p>
          ) : (
            <div className="space-y-2">
              {availableCharacters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => handleAddNode(char.id)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50 text-left"
                >
                  {char.name}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Center: Canvas */}
        <div
          className="flex-1 relative bg-slate-100 overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => {
            setSelectedNode(null);
            setSelectedEdge(null);
            setConnecting(null);
          }}
        >
          {/* SVG for edges */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {edges.map((edge) => {
              const source = nodes.find((n) => n.id === edge.sourceId);
              const target = nodes.find((n) => n.id === edge.targetId);
              if (!source || !target) return null;

              const edgeType = EDGE_TYPES.find((t) => t.value === edge.type);
              const color = edgeType?.color || "#64748b";

              return (
                <g key={edge.id}>
                  <line
                    x1={source.x + 40}
                    y1={source.y + 20}
                    x2={target.x + 40}
                    y2={target.y + 20}
                    stroke={edge.id === selectedEdge ? "#3b82f6" : color}
                    strokeWidth={edge.id === selectedEdge ? "3" : "2"}
                    markerEnd="url(#arrowhead)"
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdge(edge.id);
                      setSelectedNode(null);
                    }}
                  />
                  {edge.label && (
                    <text
                      x={(source.x + target.x) / 2 + 40}
                      y={(source.y + target.y) / 2 + 15}
                      fill={color}
                      fontSize="12"
                      className="pointer-events-none"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <div
              key={node.id}
              className={cn(
                "absolute w-20 h-10 flex items-center justify-center bg-white border-2 rounded-lg shadow-sm cursor-move text-xs font-medium select-none",
                node.id === selectedNode
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-slate-300"
              )}
              style={{ left: node.x, top: node.y, zIndex: 10 }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleMouseDown(e, node.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (connecting) {
                  handleEndConnection(node.id);
                } else {
                  setSelectedNode(node.id);
                  setSelectedEdge(null);
                }
              }}
            >
              {node.characterName}
            </div>
          ))}

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 italic">
              从左侧拖拽角色到此处
            </div>
          )}
        </div>

        {/* Right: Properties Panel */}
        <aside className="w-72 bg-white border-l border-slate-200 p-4 overflow-auto">
          <h3 className="font-semibold mb-3">属性</h3>

          {selectedNode && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">节点</label>
                <p className="text-sm text-slate-600">
                  {nodes.find((n) => n.id === selectedNode)?.characterName}
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handleStartConnection(selectedNode)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50"
                >
                  <Plus className="w-3 h-3 inline mr-1" />
                  创建关系
                </button>
                <button
                  onClick={() => handleDeleteNode(selectedNode)}
                  className="w-full px-3 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
                >
                  <X className="w-3 h-3 inline mr-1" />
                  删除节点
                </button>
              </div>
            </div>
          )}

          {selectedEdge && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  关系类型
                </label>
                <select
                  value={edges.find((e) => e.id === selectedEdge)?.type || "other"}
                  onChange={(e) =>
                    updateEdge(selectedEdge, {
                      type: e.target.value as Edge["type"],
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                >
                  {EDGE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">标签</label>
                <input
                  type="text"
                  value={edges.find((e) => e.id === selectedEdge)?.label || ""}
                  onChange={(e) =>
                    updateEdge(selectedEdge, { label: e.target.value })
                  }
                  placeholder="例：好友"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <button
                onClick={() => handleDeleteEdge(selectedEdge)}
                className="w-full px-3 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
              >
                <X className="w-3 h-3 inline mr-1" />
                删除关系
              </button>
            </div>
          )}

          {!selectedNode && !selectedEdge && (
            <p className="text-sm text-slate-400 italic">
              选择节点或关系以编辑属性
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
















