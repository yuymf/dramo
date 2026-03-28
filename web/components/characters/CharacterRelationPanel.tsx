/**
 * Character Relation Panel - ReactFlow-based draggable relationship graph
 */
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  BackgroundVariant,
  MarkerType,
  NodeTypes,
  Handle,
  Position,
  NodeProps,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save, Plus, Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface CharacterNodeData extends Record<string, unknown> {
  characterId: string;
  characterName: string;
  description?: string;
  alias?: string;
  imageUrl?: string;
  expanded?: boolean;
}

interface CharacterNode extends Node {
  data: CharacterNodeData;
}

interface CharacterRelationPanelProps {
  nodes: {
    id: string;
    characterId: string;
    characterName: string;
    description?: string;
    alias?: string;
    imageUrl?: string;
    x: number;
    y: number;
  }[];
  edges: {
    id: string;
    sourceId: string;
    targetId: string;
    label?: string;
    type?: "family" | "friend" | "colleague" | "rival" | "lover" | "other";
  }[];
  onNodesChange: (
    nodes: {
      id: string;
      characterId: string;
      characterName: string;
      description?: string;
      alias?: string;
      imageUrl?: string;
      x: number;
      y: number;
    }[]
  ) => void;
  onEdgesChange: (
    edges: {
      id: string;
      sourceId: string;
      targetId: string;
      label?: string;
      type?: "family" | "friend" | "colleague" | "rival" | "lover" | "other";
    }[]
  ) => void;
  onSave: () => void;
  onAddCharacter?: (pos?: { x: number; y: number }) => void;
  onNodeSelected?: (characterId: string | null) => void;
  onNodeDelete?: (characterId: string) => void;
  onRenameCharacter?: (characterId: string, newName: string) => void;
  selectedCharacterId?: string | null;
}

const EDGE_TYPES = [
  { value: "family", label: "家人", color: "#dc2626" },
  { value: "friend", label: "朋友", color: "#16a34a" },
  { value: "colleague", label: "同事", color: "#2563eb" },
  { value: "rival", label: "对手", color: "#ea580c" },
  { value: "lover", label: "恋人", color: "#db2777" },
  { value: "other", label: "其他", color: "#64748b" },
] as const;

// Custom Character Node Component
function CharacterNodeComponent({ data, selected }: NodeProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className={cn(
        "bg-white rounded-lg shadow-md transition-all border-2",
        selected ? "border-blue-500 shadow-lg" : "border-slate-200",
        data.expanded ? "min-w-[240px]" : "min-w-[120px]"
      )}
      onDoubleClick={() => setShowDetails(!showDetails)}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className="p-3">
        <div className="flex items-start gap-2">
          {(data.imageUrl as string) && (
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
              <Image
                src={data.imageUrl as string}
                alt={data.characterName as string}
                fill
                className="object-cover"
                sizes="40px"
                unoptimized
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{data.characterName as string}</div>
            {(data.alias as string) && (
              <div className="text-xs text-slate-400 truncate">别称：{data.alias as string}</div>
            )}
            {(showDetails || (data.expanded as boolean)) && (data.description as string) && (
              <div className="text-xs text-slate-500 mt-1 line-clamp-3">
                {data.description as string}
              </div>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  characterNode: CharacterNodeComponent,
};

function CharacterRelationPanelInternal({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange: onParentNodesChange,
  onEdgesChange: onParentEdgesChange,
  onSave,
  onAddCharacter,
  onNodeSelected,
  onNodeDelete,
  onRenameCharacter,
  selectedCharacterId,
}: CharacterRelationPanelProps) {
  const reactFlowInstance = useReactFlow();
  // Convert to ReactFlow format
  const rfNodes: CharacterNode[] = useMemo(
    () =>
      initialNodes.map((node) => ({
        id: node.id,
        type: "characterNode",
        position: { x: node.x, y: node.y },
        data: {
          characterId: node.characterId,
          characterName: node.characterName,
          description: node.description,
          alias: node.alias,
          imageUrl: node.imageUrl,
        },
      })),
    [initialNodes]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      initialEdges.map((edge) => {
        const edgeType = EDGE_TYPES.find((t) => t.value === edge.type);
        return {
          id: edge.id,
          source: edge.sourceId,
          target: edge.targetId,
          label: edge.label || edgeType?.label,
          type: "smoothstep",
          animated: true,
          style: { stroke: edgeType?.color || "#64748b", strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeType?.color || "#64748b",
          },
          data: { relationType: edge.type },
        };
      }),
    [initialEdges]
  );

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(rfEdges);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
    edgeId?: string;
    isPaneMenu?: boolean;
    canvasX?: number;
    canvasY?: number;
  } | null>(null);

  // Sync nodes when initialNodes changes
  useEffect(() => {
    console.log('Syncing nodes from props:', rfNodes.length, 'nodes');
    setNodes(rfNodes);
  }, [rfNodes, setNodes]);

  // Sync edges when initialEdges changes
  useEffect(() => {
    console.log('Syncing edges from props:', rfEdges.length, 'edges');
    setEdges(rfEdges);
  }, [rfEdges, setEdges]);

  // Center and select node when selectedCharacterId changes
  useEffect(() => {
    if (selectedCharacterId && reactFlowInstance) {
      const node = nodes.find((n) => (n as CharacterNode).data.characterId === selectedCharacterId);
      if (node) {
        // Select the node
        setSelectedNode(node.id);
        
        // Center the view on the node
        reactFlowInstance.setCenter(node.position.x, node.position.y, {
          zoom: 1.2,
          duration: 800,
        });
      }
    }
  }, [selectedCharacterId, nodes, reactFlowInstance]);

  // Sync back to parent when nodes change
  const syncNodes = useCallback(
    (updatedNodes: Node[]) => {
      onParentNodesChange(
        updatedNodes.map((n) => ({
          id: n.id,
          characterId: (n as CharacterNode).data.characterId,
          characterName: (n as CharacterNode).data.characterName,
          description: (n as CharacterNode).data.description,
          alias: (n as CharacterNode).data.alias,
          imageUrl: (n as CharacterNode).data.imageUrl,
          x: n.position.x,
          y: n.position.y,
        }))
      );
    },
    [onParentNodesChange]
  );

  // Sync back to parent when edges change
  const syncEdges = useCallback(
    (updatedEdges: Edge[]) => {
      onParentEdgesChange(
        updatedEdges.map((e) => ({
          id: e.id,
          sourceId: e.source,
          targetId: e.target,
          label: e.label as string,
          type: e.data?.relationType as "family" | "friend" | "colleague" | "rival" | "lover" | "other" | undefined,
        }))
      );
    },
    [onParentEdgesChange]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge_${Date.now()}`,
        type: "smoothstep" as const,
        animated: true,
        style: { stroke: "#16a34a", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#16a34a" },
        label: "朋友",
        data: { relationType: "friend" },
      };
      const updatedEdges = addEdge(newEdge, edges);
      setEdges(updatedEdges);
      syncEdges(updatedEdges);
    },
    [edges, setEdges, syncEdges]
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: Node) => {
      void _node;
      // Sync all nodes using current state (not the parameter which might be incomplete)
      syncNodes(nodes);
    },
    [syncNodes, nodes]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
      setSelectedEdge(null);
      // Notify parent of selected character
      if (onNodeSelected) {
        onNodeSelected((node as CharacterNode).data.characterId);
      }
    },
    [onNodeSelected]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge.id);
      setSelectedNode(null);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setContextMenu(null);
    // Clear selection
    if (onNodeSelected) {
      onNodeSelected(null);
    }
  }, [onNodeSelected]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('Node context menu triggered:', node.id);
      
      // Ensure menu doesn't go off-screen
      const menuWidth = 180;
      const menuHeight = 120;
      const x = Math.min(event.clientX, window.innerWidth - menuWidth);
      const y = Math.min(event.clientY, window.innerHeight - menuHeight);
      
      setContextMenu({
        x,
        y,
        nodeId: node.id,
      });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('Edge context menu triggered:', edge.id);
      
      // Ensure menu doesn't go off-screen
      const menuWidth = 180;
      const menuHeight = 80;
      const x = Math.min(event.clientX, window.innerWidth - menuWidth);
      const y = Math.min(event.clientY, window.innerHeight - menuHeight);
      
      setContextMenu({
        x,
        y,
        edgeId: edge.id,
      });
    },
    []
  );

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    console.log('Pane context menu triggered');
    
    // Convert screen coordinates to canvas coordinates
    const canvasPosition = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    // Ensure menu doesn't go off-screen
    const menuWidth = 180;
    const menuHeight = 80;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight);
    
    setContextMenu({
      x,
      y,
      isPaneMenu: true,
      canvasX: canvasPosition.x,
      canvasY: canvasPosition.y,
    });
  }, [reactFlowInstance]);

  const handleDeleteNode = useCallback(() => {
    if (contextMenu?.nodeId) {
      const nodeToDelete = nodes.find((n) => n.id === contextMenu.nodeId) as CharacterNode | undefined;
      const updatedNodes = nodes.filter((n) => n.id !== contextMenu.nodeId);
      const updatedEdges = edges.filter(
        (e) => e.source !== contextMenu.nodeId && e.target !== contextMenu.nodeId
      );
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      syncNodes(updatedNodes);
      syncEdges(updatedEdges);
      setSelectedNode(null);
      
      // Notify parent to remove from character library
      if (onNodeDelete && nodeToDelete) {
        onNodeDelete(nodeToDelete.data.characterId);
      }
    }
    setContextMenu(null);
  }, [contextMenu, nodes, edges, setNodes, setEdges, syncNodes, syncEdges, onNodeDelete]);

  const handleDeleteEdge = useCallback(() => {
    if (contextMenu?.edgeId) {
      const updatedEdges = edges.filter((e) => e.id !== contextMenu.edgeId);
      setEdges(updatedEdges);
      syncEdges(updatedEdges);
      setSelectedEdge(null);
    }
    setContextMenu(null);
  }, [contextMenu, edges, setEdges, syncEdges]);

  const handleToggleExpand = useCallback(() => {
    if (contextMenu?.nodeId) {
      const updatedNodes = nodes.map((n) =>
        n.id === contextMenu.nodeId
          ? {
              ...n,
              data: {
                ...((n as CharacterNode).data),
                expanded: !((n as CharacterNode).data.expanded),
              },
            }
          : n
      );
      setNodes(updatedNodes as CharacterNode[]);
    }
    setContextMenu(null);
  }, [contextMenu, nodes, setNodes]);

  const handleAddCharacterFromPane = useCallback(() => {
    if (contextMenu?.isPaneMenu && onAddCharacter) {
      onAddCharacter({
        x: contextMenu.canvasX || 100,
        y: contextMenu.canvasY || 100,
      });
    }
    setContextMenu(null);
  }, [contextMenu, onAddCharacter]);

  const handleRenameNode = useCallback(() => {
    if (contextMenu?.nodeId) {
      const node = nodes.find((n) => n.id === contextMenu.nodeId) as CharacterNode | undefined;
      if (!node) return;
      
      const newName = prompt("请输入新的角色名称：", node.data.characterName);
      if (newName === null || newName.trim() === "" || newName.trim() === node.data.characterName) return;
      
      // Update node name locally
      const updatedNodes = nodes.map((n) =>
        n.id === contextMenu.nodeId
          ? {
              ...n,
              data: {
                ...(n as CharacterNode).data,
                characterName: newName.trim(),
              },
            }
          : n
      );
      setNodes(updatedNodes as CharacterNode[]);
      syncNodes(updatedNodes);
      
      // Notify parent to update character asset
      if (onRenameCharacter && node) {
        onRenameCharacter(node.data.characterId, newName.trim());
      }
    }
    setContextMenu(null);
  }, [contextMenu, nodes, setNodes, syncNodes, onRenameCharacter]);

  const handleChangeEdgeType = useCallback(
    (newType: (typeof EDGE_TYPES)[number]["value"]) => {
      if (selectedEdge) {
        const edgeType = EDGE_TYPES.find((t) => t.value === newType);
        const updatedEdges = edges.map((e) =>
          e.id === selectedEdge
            ? {
                ...e,
                label: edgeType?.label,
                style: { stroke: edgeType?.color || "#64748b", strokeWidth: 2 },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: edgeType?.color || "#64748b",
                },
                data: { relationType: newType },
              }
            : e
        );
        setEdges(updatedEdges);
        syncEdges(updatedEdges);
      }
    },
    [selectedEdge, edges, setEdges, syncEdges]
  );

  const selectedEdgeData = edges.find((e) => e.id === selectedEdge);

  return (
    <>
      <div className="h-full flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-sm">角色关系图</h3>
            <p className="text-xs text-slate-500">拖拽节点 • 右键菜单 • 双击展开</p>
          </div>
          <div className="flex gap-2">
            {onAddCharacter && (
              <button
                onClick={() => onAddCharacter()}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-white flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                新建角色
              </button>
            )}
            <button
              onClick={onSave}
              className="px-3 py-1.5 text-xs bg-[var(--brand-500)] text-white rounded hover:bg-[var(--brand-600)] flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              保存
            </button>
          </div>
        </div>

        {/* ReactFlow Canvas */}
        <div className="flex-1 relative" onContextMenu={(e) => e.preventDefault()}>
          <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeInternal}
          onEdgesChange={onEdgesChangeInternal}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          selectNodesOnDrag={true}
          panOnDrag={[1, 2]}
          panOnScroll={false}
          zoomOnScroll={true}
          zoomOnPinch={true}
          minZoom={0.2}
          maxZoom={2}
          fitView
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
          }}
          attributionPosition="bottom-left"
          disableKeyboardA11y={false}
        >
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const n = node as CharacterNode;
              return n.data.characterId ? "#3b82f6" : "#94a3b8";
            }}
            nodeStrokeWidth={3}
            zoomable
            pannable
          />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
        </div>

        {/* Properties Panel */}
        {(selectedNode || selectedEdge) && (
          <div className="w-full border-t border-slate-200 bg-slate-50 p-3 flex-shrink-0">
          <div className="flex items-center gap-4">
            {selectedNode && (
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-500 mb-1">选中节点</div>
                <div className="text-sm font-semibold">
                  {(nodes.find((n) => n.id === selectedNode) as CharacterNode)?.data
                    ?.characterName}
                </div>
              </div>
            )}
            {selectedEdge && (
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-500 mb-1">关系类型</div>
                <div className="flex gap-1 flex-wrap">
                  {EDGE_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => handleChangeEdgeType(type.value)}
                      className={cn(
                        "px-2 py-1 text-xs rounded transition-colors",
                        selectedEdgeData?.data?.relationType === type.value
                          ? "text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                      style={{
                        backgroundColor:
                          selectedEdgeData?.data?.relationType === type.value
                            ? type.color
                            : undefined,
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Context Menu - Outside the main container */}
      {contextMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setContextMenu(null)}
          />
          {/* Menu */}
          <div
            className="fixed bg-white rounded-lg shadow-xl border border-slate-300 py-1 z-[9999] min-w-[180px]"
            style={{ 
              left: `${contextMenu.x}px`, 
              top: `${contextMenu.y}px`,
              pointerEvents: 'auto'
            }}
          >
            {contextMenu.nodeId && (
              <>
                <button
                  onClick={handleRenameNode}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2 transition-colors"
                >
                  <Info className="w-4 h-4 text-slate-600" />
                  <span>重命名</span>
                </button>
                <button
                  onClick={handleToggleExpand}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2 transition-colors"
                >
                  <Info className="w-4 h-4 text-slate-600" />
                  <span>切换详情显示</span>
                </button>
                <div className="border-t border-slate-200 my-1" />
                <button
                  onClick={handleDeleteNode}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>删除节点</span>
                </button>
              </>
            )}
            {contextMenu.edgeId && (
              <>
                <div className="px-4 py-1.5 text-xs font-medium text-slate-500 border-b border-slate-200">
                  关系操作
                </div>
                <button
                  onClick={handleDeleteEdge}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>删除关系</span>
                </button>
              </>
            )}
            {contextMenu.isPaneMenu && (
              <>
                <button
                  onClick={handleAddCharacterFromPane}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4 text-[var(--brand-600)]" />
                  <span>新建角色</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

// Exported component with ReactFlowProvider wrapper
export function CharacterRelationPanel(props: CharacterRelationPanelProps) {
  return (
    <ReactFlowProvider>
      <CharacterRelationPanelInternal {...props} />
    </ReactFlowProvider>
  );
}
