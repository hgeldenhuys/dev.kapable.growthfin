/**
 * Graph Visualization Component
 * Interactive node-edge graph using React Flow
 */

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Handle,
  Position,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeTypes,
  MarkerType,
  Panel,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '../ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import dagre from '@dagrejs/dagre';

interface GraphVisualizationProps {
  entities: {
    components: any[];
    decisions: any[];
    understandings: any[];
    values: any[];
    purposes: any[];
  };
  relations: any[];
  onEntityClick: (entity: any, entityType: string) => void;
}

// Color scheme for entity types
const entityColors = {
  components: '#3b82f6',    // blue
  decisions: '#10b981',      // green
  understandings: '#f59e0b', // amber
  values: '#ec4899',         // pink
  purposes: '#8b5cf6',       // purple
};

// Custom node component
function CustomNode({ data }: { data: any }) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        style={{
          padding: '10px 16px',
          borderRadius: '6px',
          background: data.color,
          color: '#fff',
          border: '2px solid rgba(0, 0, 0, 0.1)',
          fontSize: '12px',
          fontWeight: 500,
          minWidth: '120px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        className="hover:shadow-lg"
      >
        <div className="font-semibold">{data.label}</div>
        {data.subtitle && (
          <div className="text-[10px] opacity-80 mt-1">{data.subtitle}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

// Dagre layout configuration
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const nodeWidth = 172;
  const nodeHeight = 50;
  const isHorizontal = direction === 'LR';

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 100,
    ranksep: 150,
    marginx: 50,
    marginy: 50,
  });

  for (const node of nodes) {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export function GraphVisualization({ entities, relations, onEntityClick }: GraphVisualizationProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Transform entities to nodes
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [];

    for (const [type, items] of Object.entries(entities)) {
      for (const entity of items) {
        nodes.push({
          id: entity.id || entity.name,
          type: 'custom',
          data: {
            label: entity.name || entity.id || 'Unknown',
            subtitle: type.slice(0, -1), // Remove 's' from type
            color: entityColors[type as keyof typeof entityColors] || '#6b7280',
            entity,
            entityType: type,
          },
          position: { x: 0, y: 0 }, // Will be set by layout
        });
      }
    }

    return nodes;
  }, [entities]);

  // Transform relations to edges
  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];

    // Flatten all relation types into a single array
    for (const relationGroup of relations) {
      // Check if relationGroup has a 'relations' property (the actual array)
      const relationsList = relationGroup.relations || relationGroup;

      if (Array.isArray(relationsList)) {
        for (const rel of relationsList) {
          // Only add edge if both source and target nodes exist
          if (rel.from && rel.to) {
            edges.push({
              id: `${rel.from}-${rel.to}-${rel.type || 'relates'}`,
              source: rel.from,
              target: rel.to,
              label: rel.type || 'relates',
              type: 'smoothstep',
              animated: false,
              style: {
                stroke: hoveredNode && (rel.from === hoveredNode || rel.to === hoveredNode)
                  ? '#3b82f6'
                  : '#94a3b8',
                strokeWidth: hoveredNode && (rel.from === hoveredNode || rel.to === hoveredNode)
                  ? 3
                  : 2,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: hoveredNode && (rel.from === hoveredNode || rel.to === hoveredNode)
                  ? '#3b82f6'
                  : '#94a3b8',
              },
              labelStyle: {
                fontSize: 10,
                fill: '#64748b',
              },
              labelBgStyle: {
                fill: '#fff',
                fillOpacity: 0.8,
              },
            });
          }
        }
      }
    }

    return edges;
  }, [relations, hoveredNode]);

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // Handle node click
  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      const { entity, entityType } = node.data;
      onEntityClick(entity, entityType);
    },
    [onEntityClick]
  );

  // Handle node hover
  const onNodeMouseEnter = useCallback((_: any, node: Node) => {
    setHoveredNode(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  // Handle fit view
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 800 });
  }, [fitView]);

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
  }, [zoomOut]);

  return (
    <div className="w-full h-[700px] border rounded-lg relative bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
      >
        <Background />
        <Controls />

        {/* Custom control panel */}
        <Panel position="top-right" className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomIn}
            className="bg-background"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomOut}
            className="bg-background"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFitView}
            className="bg-background"
          >
            <Maximize2 className="h-4 w-4 mr-2" />
            Fit View
          </Button>
        </Panel>

        {/* Stats panel */}
        <Panel position="top-left" className="bg-background/95 backdrop-blur p-3 rounded-lg border">
          <div className="text-xs space-y-1">
            <div className="font-semibold">Knowledge Graph</div>
            <div className="text-muted-foreground">
              {nodes.length} nodes • {edges.length} edges
            </div>
          </div>
        </Panel>

        {/* Legend */}
        <Panel position="bottom-left" className="bg-background/95 backdrop-blur p-3 rounded-lg border">
          <div className="text-xs space-y-2">
            <div className="font-semibold mb-2">Entity Types</div>
            {Object.entries(entityColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground capitalize">
                  {type}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
