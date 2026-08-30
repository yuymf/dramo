"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Script, Block } from "@/lib/models";
import { readJSON, saveJSON } from "@/lib/storage/local";
import { Button } from "@/components/ui/button";
import { Download, Maximize2 } from "lucide-react";

interface BranchingCanvasProps {
  script: Script;
  projectId: string;
  onOpenBlock?: (blockId: string) => void;
}

interface BranchingGraph {
  nodes: Array<{ id: string; x: number; y: number }>;
  edges: Array<{ id: string; sourceId: string; targetId: string; label?: string }>;
}

interface BlockNodeData extends Record<string, unknown> {
  label: string;
  textSnippet: string;
  sceneTitle: string;
  sceneId: string;
}

// 辅助：从 HTML 中提取纯文本摘要
function stripHtml(html: string, maxLength = 60): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const text = tmp.textContent || tmp.innerText || "";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

// 辅助：生成初始布局（按场景分组）
function generateInitialLayout(script: Script): BranchingGraph {
  const nodes: Array<{ id: string; x: number; y: number }> = [];
  const edges: Array<{ id: string; sourceId: string; targetId: string; label?: string }> = [];

  let globalY = 50;
  const sceneSpacing = 300;
  const blockSpacing = { x: 350, y: 150 };

  script.scenes.forEach((scene) => {
    const blocks = scene.content;
    let sceneX = 50;

    blocks.forEach((block, blockIdx) => {
      nodes.push({
        id: block.id,
        x: sceneX,
        y: globalY,
      });

      // 场景内线性连接
      if (blockIdx > 0) {
        const prevBlock = blocks[blockIdx - 1];
        edges.push({
          id: `e-${prevBlock.id}-${block.id}`,
          sourceId: prevBlock.id,
          targetId: block.id,
          label: "",
        });
      }

      sceneX += blockSpacing.x;
    });

    globalY += sceneSpacing;
  });

  return { nodes, edges };
}

function BranchingCanvasInner({ script, projectId, onOpenBlock }: BranchingCanvasProps) {
  const storageKey = `branching_graph_${projectId}`;
  const reactFlowInstance = useReactFlow();
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [edgeLabelInput, setEdgeLabelInput] = useState("");

  // 从 script 生成节点
  const scriptToNodes = useCallback((): Node<BlockNodeData>[] => {
    const allBlocks: Array<Block & { sceneTitle: string; sceneId: string }> = [];
    script.scenes.forEach((scene) => {
      scene.content.forEach((block) => {
        allBlocks.push({
          ...block,
          sceneTitle: scene.title,
          sceneId: scene.id,
        });
      });
    });

    // 读取本地位置
    const savedGraph = readJSON<BranchingGraph | null>(storageKey, null);
    const positionMap = new Map<string, { x: number; y: number }>();
    if (savedGraph) {
      savedGraph.nodes.forEach((n) => {
        positionMap.set(n.id, { x: n.x, y: n.y });
      });
    } else {
      // 生成初始布局
      const initialGraph = generateInitialLayout(script);
      initialGraph.nodes.forEach((n) => {
        positionMap.set(n.id, { x: n.x, y: n.y });
      });
      saveJSON(storageKey, initialGraph);
    }

    return allBlocks.map((block) => {
      const pos = positionMap.get(block.id) || { x: 0, y: 0 };
      return {
        id: block.id,
        type: "default",
        position: pos,
        data: {
          label: block.label,
          textSnippet: stripHtml(block.text),
          sceneTitle: block.sceneTitle,
          sceneId: block.sceneId,
        },
      };
    });
  }, [script, storageKey]);

  const scriptToEdges = useCallback((): Edge[] => {
    const savedGraph = readJSON<BranchingGraph | null>(storageKey, null);
    if (!savedGraph) {
      // 已在 scriptToNodes 中初始化
      const initialGraph = generateInitialLayout(script);
      return initialGraph.edges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        label: e.label,
        type: "smoothstep",
      }));
    }

    return savedGraph.edges.map((e) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      label: e.label,
      type: "smoothstep",
    }));
  }, [script, storageKey]);

  const [nodes, , onNodesChange] = useNodesState(scriptToNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(scriptToEdges());

  // 持久化
  const persistGraph = useCallback(() => {
    const graph: BranchingGraph = {
      nodes: nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
      edges: edges.map((e) => ({
        id: e.id,
        sourceId: e.source,
        targetId: e.target,
        label: e.label as string | undefined,
      })),
    };
    saveJSON(storageKey, graph);
  }, [nodes, edges, storageKey]);

  useEffect(() => {
    persistGraph();
  }, [nodes, edges, persistGraph]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: `e-${params.source}-${params.target}`,
            type: "smoothstep",
            label: "",
          },
          eds,
        ),
      );
    },
    [setEdges]
  );

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onOpenBlock) {
        onOpenBlock(node.id);
      }
    },
    [onOpenBlock]
  );

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setEdgeLabelInput((edge.label as string) || "");
  }, []);

  const handleEdgeLabelSave = useCallback(() => {
    if (selectedEdge) {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedEdge.id ? { ...e, label: edgeLabelInput } : e
        )
      );
      setSelectedEdge(null);
      setEdgeLabelInput("");
    }
  }, [selectedEdge, edgeLabelInput, setEdges]);

  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  const handleExportJSON = useCallback(() => {
    const graph: BranchingGraph = {
      nodes: nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
      edges: edges.map((e) => ({
        id: e.id,
        sourceId: e.source,
        targetId: e.target,
        label: e.label as string | undefined,
      })),
    };
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branching-graph-${projectId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, projectId]);

  // 初始化时自动 fit view
  useEffect(() => {
    const timer = setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 100);
    return () => clearTimeout(timer);
  }, [reactFlowInstance]);

  return (
    <div className="relative w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeClick={handleEdgeClick}
        fitView
        attributionPosition="bottom-right"
      >
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            // 按场景着色
            const sceneId = (node.data as BlockNodeData).sceneId;
            const hash = Array.from(sceneId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
            return colors[hash % colors.length];
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Panel position="top-left" className="flex gap-2">
          <Button onClick={handleFitView} size="sm" variant="outline" className="bg-white">
            <Maximize2 className="w-4 h-4 mr-1" />
            适应画布
          </Button>
          <Button onClick={handleExportJSON} size="sm" variant="outline" className="bg-white">
            <Download className="w-4 h-4 mr-1" />
            导出 JSON
          </Button>
        </Panel>
      </ReactFlow>

      {/* 边标签编辑面板 */}
      {selectedEdge && (
        <div className="absolute top-4 right-4 bg-white border border-slate-300 rounded-lg p-4 shadow-lg z-50 w-64">
          <h3 className="text-sm font-semibold mb-2">编辑分支标签</h3>
          <input
            type="text"
            value={edgeLabelInput}
            onChange={(e) => setEdgeLabelInput(e.target.value)}
            placeholder="如：选项A、是/否"
            className="w-full px-2 py-1 border border-slate-300 rounded text-sm mb-2"
          />
          <div className="flex gap-2">
            <Button onClick={handleEdgeLabelSave} size="sm" className="flex-1">
              保存
            </Button>
            <Button
              onClick={() => {
                setSelectedEdge(null);
                setEdgeLabelInput("");
              }}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BranchingCanvas(props: BranchingCanvasProps) {
  return (
    <ReactFlowProvider>
      <BranchingCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

