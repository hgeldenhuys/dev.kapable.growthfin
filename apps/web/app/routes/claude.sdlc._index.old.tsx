/**
 * SDLC Dashboard Route
 * Visualizes knowledge graph, kanban board, and coherence metrics
 * Includes navigation to multi-session features (Sessions, Boards)
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Overview } from "../components/sdlc/Overview";
import { KanbanBoard } from "../components/sdlc/KanbanBoard";
import { KnowledgeGraph } from "../components/sdlc/KnowledgeGraph";
import { CoherenceMetrics } from "../components/sdlc/CoherenceMetrics";
import { useSDLCSnapshot } from "../hooks/useSDLC";
import { GitBranch, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router";

export default function SDLCDashboard() {
  useSDLCSnapshot(); // Fetch SDLC data with polling
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GitBranch className="h-8 w-8" />
            SDLC Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time software development lifecycle tracking and visualization
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="knowledge-graph">Knowledge Graph</TabsTrigger>
          <TabsTrigger value="coherence">Coherence</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="boards">Boards</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Overview />
        </TabsContent>

        <TabsContent value="kanban" className="mt-6">
          <div className="space-y-6">
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-900 dark:text-blue-300">
                This shows your current workspace board. For multi-session board management with lock visualization,{" "}
                <button
                  onClick={() => {
                    const tabsList = document.querySelector('[role="tablist"]');
                    if (tabsList) {
                      const boardsTab = Array.from(tabsList.querySelectorAll('[role="tab"]')).find(
                        (tab) => (tab as HTMLElement).textContent?.includes("Boards")
                      ) as HTMLElement;
                      boardsTab?.click();
                    }
                  }}
                  className="font-semibold underline hover:text-blue-800 dark:hover:text-blue-200"
                >
                  see Boards tab
                </button>
                .
              </AlertDescription>
            </Alert>
            <KanbanBoard />
          </div>
        </TabsContent>

        <TabsContent value="knowledge-graph" className="mt-6">
          <KnowledgeGraph />
        </TabsContent>

        <TabsContent value="coherence" className="mt-6">
          <CoherenceMetrics />
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <div className="space-y-6">
            {/* Embedded Sessions Content */}
            <Card>
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>
                  Monitor all Claude Code sessions across the codebase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <ExternalLink className="h-4 w-4" />
                  <AlertDescription>
                    For the full sessions view with detailed management options,{" "}
                    <button
                      onClick={() => navigate("/claude/sdlc/sessions")}
                      className="font-semibold underline hover:text-foreground/80"
                    >
                      open dedicated Sessions page
                    </button>
                    .
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Preview Message */}
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Sessions Overview</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Active Claude Code sessions are displayed on the dedicated Sessions page with full filtering and health monitoring.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="boards" className="mt-6">
          <div className="space-y-6">
            {/* Embedded Boards Content */}
            <Card>
              <CardHeader>
                <CardTitle>Kanban Boards</CardTitle>
                <CardDescription>
                  Monitor board availability and manage locks across all sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <ExternalLink className="h-4 w-4" />
                  <AlertDescription>
                    For the full boards view with lock visualization and management,{" "}
                    <button
                      onClick={() => navigate("/claude/sdlc/boards")}
                      className="font-semibold underline hover:text-foreground/80"
                    >
                      open dedicated Boards page
                    </button>
                    .
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Preview Message */}
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Multi-Session Boards</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  The Boards tab displays all Kanban boards with lock status visualization. This prevents concurrent edits when multiple sessions work on the same board.
                </p>
                <p className="text-xs">
                  Locks automatically expire after 5 minutes of inactivity to prevent stale locks from blocking work.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm font-medium">About SDLC Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            This dashboard provides real-time visibility into the software development lifecycle process.
            All data is loaded from the filesystem and streamed via Server-Sent Events (SSE) for instant updates.
          </p>
          <div className="grid gap-2 md:grid-cols-2 mt-4">
            <div>
              <div className="font-medium text-foreground mb-1">Overview</div>
              <div className="text-xs">Summary of active work, epics, and coherence health</div>
            </div>
            <div>
              <div className="font-medium text-foreground mb-1">Kanban</div>
              <div className="text-xs">Visual workflow with WIP limits and story tracking</div>
            </div>
            <div>
              <div className="font-medium text-foreground mb-1">Knowledge Graph</div>
              <div className="text-xs">Captured architectural insights and relations</div>
            </div>
            <div>
              <div className="font-medium text-foreground mb-1">Coherence</div>
              <div className="text-xs">Semantic development metrics and violation tracking</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
