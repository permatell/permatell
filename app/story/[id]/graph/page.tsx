"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  NodeProps,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
  Background,
} from "reactflow";
import "reactflow/dist/style.css";
import { useParams } from "next/navigation";
import { StoryVersion } from "@/interfaces/StoryVersion";
import { IoMdThumbsUp } from "react-icons/io";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { formatDistance } from "date-fns";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";

interface FlowNode extends Node {
  data: {
    id: number;
    votes: number;
    title: string;
    timestamp: number;
    author: string;
    content: string;
    isCurrentVersion: boolean;
  };
}

type FlowEdge = Edge<{
  animated?: boolean;
}>;

const StoryNode = ({ data, selected }: NodeProps) => {
  const baseSize = 80;
  const voteScale = Math.log(data.votes + 1) + 1;
  const size = baseSize * voteScale;

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
      className={`flex flex-col items-center justify-center ${
        selected
          ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-black scale-110"
          : ""
      } ${
        data.isCurrentVersion
          ? "bg-purple-900/80 border-purple-500"
          : "bg-green-900/80 border-green-500"
      } border rounded-full cursor-pointer transition-all duration-200 hover:scale-105 relative text-white`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={`target-${data.id}`}
        style={{ background: "#555" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id={`source-${data.id}`}
        style={{ background: "#555" }}
      />

      <div className="text-sm font-medium text-white">v{data.id}</div>
      <div className="flex items-center gap-1 text-xs text-gray-300">
        <IoMdThumbsUp size={12} className="text-yellow-500" />
        <span className="text-white">{data.votes}</span>
      </div>
    </div>
  );
};

const nodeTypes = {
  storyNode: StoryNode,
};

const useStoryGraph = (storyId?: string) => {
  const { currentStory } = useStoriesProcess();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentStory) {
      setIsLoading(false);
    }
  }, [currentStory]);

  const graphData = useMemo(() => {
    if (!currentStory) return { nodes: [], edges: [] };

    const versions = Object.values(currentStory.versions);
    const nodeGap = 250;
    const startX = nodeGap / 2;
    const startY = 0;

    const nodes: FlowNode[] = versions.map((version: StoryVersion, index) => ({
      id: version.id.toString(),
      type: "storyNode",
      position: {
        x: startX + index * nodeGap,
        y: startY + (Math.sin(index) * nodeGap) / 3,
      },
      data: {
        id: version.id,
        votes: version.votes || 0,
        title: version.title,
        timestamp: Number(version.timestamp),
        author: version.author,
        content: version.content,
        isCurrentVersion: version.id === Number(currentStory.current_version),
      },
    }));

    const edges: FlowEdge[] = versions.slice(1).map((version, index) => ({
      id: `e${versions[index].id}-${version.id}`,
      source: versions[index].id.toString(),
      target: version.id.toString(),
      sourceHandle: `source-${versions[index].id}`,
      targetHandle: `target-${version.id}`,
      type: "smoothstep",
      animated: false,
    }));

    return { nodes, edges };
  }, [currentStory]);

  return { graphData, isLoading, story: currentStory };
};

const StoryGraphPage = () => {
  const params = useParams();
  const { currentStory } = useStoriesProcess();
  const storyId = useMemo(
    () => (Array.isArray(params.id) ? params.id[0] : params.id),
    [params.id]
  );

  if (!storyId) {
    return <div>Invalid story ID</div>;
  }

  const { graphData, isLoading } = useStoryGraph(storyId);
  const [selectedNode, setSelectedNode] = useState<FlowNode["data"] | null>(
    null
  );

  useEffect(() => {
    if (!currentStory && storyId) {
      window.location.href = `/story/${storyId}`;
    }
  }, [currentStory, storyId]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      setNodes(graphData.nodes);
      setEdges(graphData.edges);
    }
  }, [graphData, setNodes, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  const fitViewOptions = useMemo(
    () => ({
      padding: 0.5,
      minZoom: 0.1,
      maxZoom: 1.5,
      duration: 800,
    }),
    []
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <Spinner className="w-8 h-8" />
        <p className="text-gray-200 text-lg">Loading story graph...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={fitViewOptions}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
          style: { stroke: "#4B5563", strokeWidth: 2 },
        }}
        minZoom={fitViewOptions.minZoom}
        maxZoom={fitViewOptions.maxZoom}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        className="h-full"
      >
        <Background />
        {selectedNode && (
          <Card className="absolute right-4 top-4 w-80 !bg-black/50 backdrop-blur-sm border-gray-800 p-4 text-white z-50 shadow-xl animate-in fade-in slide-in-from-right duration-300">
            <h3 className="text-lg font-semibold mb-2 text-white">
              Version {selectedNode.id}
            </h3>
            <div className="space-y-2 text-sm text-white">
              <p>
                <span className="text-gray-400">Title:</span>{" "}
                <span className="text-white">{selectedNode.title}</span>
              </p>
              <p>
                <span className="text-gray-400">Author:</span>{" "}
                <span className="text-white">
                  {`${selectedNode.author.slice(
                    0,
                    6
                  )}...${selectedNode.author.slice(-4)}`}
                </span>
              </p>
              <p>
                <span className="text-gray-400">Votes:</span>{" "}
                <span className="text-yellow-500">{selectedNode.votes}</span>
              </p>
              <p>
                <span className="text-gray-400">Created:</span>{" "}
                <span className="text-white">
                  {formatDistance(
                    new Date(selectedNode.timestamp),
                    new Date(),
                    {
                      addSuffix: true,
                    }
                  )}
                </span>
              </p>
              <div>
                <span className="text-gray-400">Preview:</span>
                <p className="mt-1 text-white line-clamp-3">
                  {selectedNode.content}
                </p>
              </div>
            </div>
          </Card>
        )}
      </ReactFlow>
    </div>
  );
};

export default StoryGraphPage;
