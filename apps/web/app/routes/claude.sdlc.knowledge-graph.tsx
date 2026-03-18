/**
 * SDLC Knowledge Graph Route
 * Displays the knowledge graph with entities and relations
 * React Router v7
 */

import { ReactFlowProvider } from 'reactflow';
import { KnowledgeGraph } from "../components/sdlc/KnowledgeGraph";

export default function KnowledgeGraphPage() {
  return (
    <div className="container mx-auto py-6">
      <ReactFlowProvider>
        <KnowledgeGraph />
      </ReactFlowProvider>
    </div>
  );
}
