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
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { Story } from "@/interfaces/Story";
import { StoryVersion } from "@/interfaces/StoryVersion";
import { IoMdThumbsUp } from "react-icons/io";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { formatDistance } from "date-fns";

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

const StoryNode = ({ data }: NodeProps) => (
  <div
    className={`px-4 py-2 rounded-full ${
      data.isCurrentVersion
        ? "bg-purple-900/80 border-purple-500"
        : "bg-green-900/80 border-green-500"
    } border cursor-pointer transition-all duration-200 hover:scale-105 relative text-white`}
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

const nodeTypes = {
  storyNode: StoryNode,
};

const useStoryGraph = (storyId: string) => {
  const { getStory } = useStoriesProcess();
  const [story, setStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const memoizedGetStory = useCallback(async () => {
    try {
      const storyData = await getStory({ story_id: storyId });
      return storyData;
    } catch (error) {
      console.error("Error fetching story:", error);
      return null;
    }
  }, [storyId, getStory]);

  useEffect(() => {
    let isMounted = true;

    const fetchStory = async () => {
      const storyData = await memoizedGetStory();

      if (isMounted && storyData) {
        setStory(storyData);
        setIsLoading(false);
      }
    };

    fetchStory();

    return () => {
      isMounted = false;
    };
  }, [memoizedGetStory]);

  const graphData = useMemo(() => {
    if (!story) return { nodes: [], edges: [] };

    const versions = Object.values(story.versions);
    const nodeGap = 150;
    const startX = 0;
    const startY = 300;

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
        isCurrentVersion: version.id === Number(story.current_version),
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
  }, [story]);

  return { graphData, isLoading, story };
};

const StoryGraphPage = () => {
  const params = useParams();
  const storyId = useMemo(
    () => (Array.isArray(params.id) ? params.id[0] : params.id),
    [params.id]
  );

  const [selectedNode, setSelectedNode] = useState<FlowNode["data"] | null>(
    null
  );

  if (!storyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <p className="text-gray-200 text-lg">Invalid story ID</p>
      </div>
    );
  }

  const { graphData, isLoading } = useStoryGraph(storyId);
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <Spinner className="w-8 h-8" />
        <p className="text-gray-200 text-lg">Loading story graph...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-4rem)] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
          style: { stroke: "#4B5563", strokeWidth: 2 },
        }}
        className="h-full"
      >
        <Background />
        {selectedNode && (
          <Card className="absolute right-4 top-4 w-80 bg-black/50 backdrop-blur-sm border-gray-800 p-4 text-white">
            <h3 className="text-lg font-semibold mb-2">
              Version {selectedNode.id}
            </h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-400">Title:</span>{" "}
                {selectedNode.title}
              </p>
              <p>
                <span className="text-gray-400">Author:</span>{" "}
                {`${selectedNode.author.slice(
                  0,
                  6
                )}...${selectedNode.author.slice(-4)}`}
              </p>
              <p>
                <span className="text-gray-400">Votes:</span>{" "}
                <span className="text-yellow-500">{selectedNode.votes}</span>
              </p>
              <p>
                <span className="text-gray-400">Created:</span>{" "}
                {formatDistance(new Date(selectedNode.timestamp), new Date(), {
                  addSuffix: true,
                })}
              </p>
              <div>
                <span className="text-gray-400">Preview:</span>
                <p className="mt-1 text-gray-300 line-clamp-3">
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
