/**
 * SDLC About Route
 * Documentation and conceptual model explanation
 * Epic 2 Implementation - Comprehensive documentation
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { BookOpen, Boxes, Activity, Terminal, Workflow, Lightbulb, Info } from "lucide-react";

export default function AboutRoute() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="h-8 w-8" />
            About SDLC Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Conceptual model, CLI commands, and workflows
          </p>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="conceptual-model" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="conceptual-model">Conceptual Model</TabsTrigger>
          <TabsTrigger value="cli-commands">CLI Commands</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        {/* Conceptual Model Tab */}
        <TabsContent value="conceptual-model" className="space-y-6 mt-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Understanding the SDLC System</CardTitle>
              <CardDescription>
                The foundation of multi-session development coordination
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                The SDLC Dashboard provides real-time visibility into software development lifecycle
                processes across multiple Claude Code sessions. It enables coordination, prevents conflicts,
                and tracks progress through a board-centric model.
              </p>
            </CardContent>
          </Card>

          {/* Boards Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5" />
                <CardTitle>Boards (Primary Entity)</CardTitle>
              </div>
              <CardDescription>
                Permanent workspaces with specific goals and context
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">What are Boards?</h4>
                <p className="text-sm text-muted-foreground">
                  Boards are permanent Kanban workspaces stored in <code className="text-xs bg-muted px-1 py-0.5 rounded">.claude/sdlc/kanban/boards/</code>.
                  Each board represents a specific development context (feature, epic, sprint) and persists
                  across session restarts.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Board Characteristics:</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li><strong>Persistent:</strong> Survive Claude Code session restarts</li>
                  <li><strong>Goal-oriented:</strong> Each board has a specific purpose and sprint goal</li>
                  <li><strong>Lockable:</strong> Can be locked by sessions to prevent concurrent edits</li>
                  <li><strong>Trackable:</strong> Maintain story state, progress, and metrics</li>
                  <li><strong>Coordinated:</strong> Locks ensure only one session modifies at a time</li>
                </ul>
              </div>

              <Alert>
                <Boxes className="h-4 w-4" />
                <AlertTitle>Board Lock Mechanism</AlertTitle>
                <AlertDescription>
                  Boards use file-based locks (.lock files) that expire after 5 minutes of inactivity.
                  This prevents stale locks from blocking work when sessions crash or disconnect.
                </AlertDescription>
              </Alert>

              <div>
                <h4 className="font-semibold mb-2">Example Use Cases:</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="border rounded p-3">
                    <Badge variant="outline" className="mb-2">Feature Board</Badge>
                    <p className="text-xs text-muted-foreground">
                      Track stories for implementing user authentication
                    </p>
                  </div>
                  <div className="border rounded p-3">
                    <Badge variant="outline" className="mb-2">Epic Board</Badge>
                    <p className="text-xs text-muted-foreground">
                      Coordinate multi-sprint API redesign work
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sessions Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle>Sessions (Secondary Entity)</CardTitle>
              </div>
              <CardDescription>
                Temporary workers that execute tasks on boards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">What are Sessions?</h4>
                <p className="text-sm text-muted-foreground">
                  Sessions represent individual Claude Code instances currently running. They are temporary,
                  tracked via heartbeat, and coordinate with boards through the lock mechanism.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Session Characteristics:</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li><strong>Temporary:</strong> Exist only while Claude Code is running</li>
                  <li><strong>Active:</strong> Send heartbeats every 30 seconds to prove they're alive</li>
                  <li><strong>Workers:</strong> Lock boards to work on stories</li>
                  <li><strong>Trackable:</strong> Show current story, board, and checkpoint data</li>
                  <li><strong>Health-monitored:</strong> Status indicators (active, warning, stale, archived)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Session Health Indicators:</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="flex items-center gap-2 border rounded p-2">
                    <span>🟢</span>
                    <div>
                      <div className="text-sm font-medium">Active</div>
                      <div className="text-xs text-muted-foreground">Heartbeat &lt; 1 min ago</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border rounded p-2">
                    <span>🟡</span>
                    <div>
                      <div className="text-sm font-medium">Warning</div>
                      <div className="text-xs text-muted-foreground">Heartbeat 1-5 min ago</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border rounded p-2">
                    <span>🔴</span>
                    <div>
                      <div className="text-sm font-medium">Stale</div>
                      <div className="text-xs text-muted-foreground">Heartbeat &gt; 5 min ago</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border rounded p-2">
                    <span>⚫</span>
                    <div>
                      <div className="text-sm font-medium">Archived</div>
                      <div className="text-xs text-muted-foreground">Session ended</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Relationship Section */}
          <Card>
            <CardHeader>
              <CardTitle>Board-Session Relationship</CardTitle>
              <CardDescription>
                How boards and sessions coordinate to prevent conflicts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">The Lock Protocol:</h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                  <li>
                    <strong>Session requests lock:</strong> When a session wants to work on a board,
                    it attempts to acquire a lock
                  </li>
                  <li>
                    <strong>Lock granted (if available):</strong> If the board is unlocked, the session
                    creates a .lock file with its session ID
                  </li>
                  <li>
                    <strong>Heartbeat maintenance:</strong> While working, the session updates the lock
                    heartbeat every 30 seconds
                  </li>
                  <li>
                    <strong>Lock release:</strong> When done, the session releases the lock by deleting
                    the .lock file
                  </li>
                  <li>
                    <strong>Stale lock detection:</strong> If heartbeat stops for &gt; 5 minutes, the lock
                    is considered stale and can be taken over
                  </li>
                </ol>
              </div>

              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-900 dark:text-blue-300">
                  Relationship Summary
                </AlertTitle>
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <div className="mt-2 space-y-1">
                    <div><strong>One-to-One (Current):</strong> A session locks one board at a time</div>
                    <div><strong>One-to-Many (History):</strong> A board can be locked by multiple sessions over time</div>
                    <div><strong>Coordination:</strong> Locks prevent concurrent modifications</div>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CLI Commands Tab */}
        <TabsContent value="cli-commands" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                <CardTitle>SDLC CLI Commands</CardTitle>
              </div>
              <CardDescription>
                Command reference for SDLC operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sprint Planning */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge>Sprint Planning</Badge>
                </h4>
                <div className="space-y-3">
                  <div className="border-l-2 border-primary pl-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded">/sdlc:planning</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start sprint planning session, create stories from PRD
                    </p>
                  </div>
                  <div className="border-l-2 border-primary pl-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded">/sdlc:start [feature]</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Launch SDLC orchestration for a new feature
                    </p>
                  </div>
                </div>
              </div>

              {/* Quality Checks */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="secondary">Quality & Testing</Badge>
                </h4>
                <div className="space-y-3">
                  <div className="border-l-2 border-secondary pl-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded">/sdlc/sprint-qa</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verify functionality works, run tests
                    </p>
                  </div>
                  <div className="border-l-2 border-secondary pl-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded">/sdlc/coherence-check</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verify coherence maintained (≥0.75 target)
                    </p>
                  </div>
                </div>
              </div>

              {/* Completion */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline">Completion</Badge>
                </h4>
                <div className="space-y-3">
                  <div className="border-l-2 border-muted-foreground pl-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded">/sdlc/feature-complete "name"</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Document and commit completed feature
                    </p>
                  </div>
                  <div className="border-l-2 border-muted-foreground pl-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded">/sdlc/retrospective</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Reflect on sprint and capture learnings
                    </p>
                  </div>
                </div>
              </div>

              {/* Utilities */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="destructive">Investigation</Badge>
                </h4>
                <div className="space-y-3">
                  <div className="border-l-2 border-destructive pl-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded">/sdlc/audit &lt;type&gt;</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Systematic codebase investigation (e2e-routes, api-contracts, etc.)
                    </p>
                  </div>
                  <div className="border-l-2 border-destructive pl-4">
                    <code className="text-sm bg-muted px-2 py-1 rounded">/sdlc/tweak "description"</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Post-sprint corrections and minor fixes
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                <CardTitle>Common Workflows</CardTitle>
              </div>
              <CardDescription>
                Step-by-step guides for typical SDLC operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Starting a New Feature */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Starting a New Feature
                </h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                  <li>Run <code className="bg-muted px-1 py-0.5 rounded text-xs">/sdlc/requirement "feature idea"</code> to get clear specifications</li>
                  <li>Run <code className="bg-muted px-1 py-0.5 rounded text-xs">/sdlc:start [requirement]</code> to launch orchestration</li>
                  <li>System creates board, generates stories, assigns agents</li>
                  <li>Monitor progress in Boards tab (real-time updates via SSE)</li>
                  <li>Run <code className="bg-muted px-1 py-0.5 rounded text-xs">/sdlc/sprint-qa</code> to verify functionality</li>
                  <li>Run <code className="bg-muted px-1 py-0.5 rounded text-xs">/sdlc/coherence-check</code> to ensure quality</li>
                  <li>Run <code className="bg-muted px-1 py-0.5 rounded text-xs">/sdlc/feature-complete "feature-name"</code> to finalize</li>
                </ol>
              </div>

              {/* Multi-Session Coordination */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Multi-Session Coordination
                </h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                  <li>Session A starts, requests lock on "feature-auth" board</li>
                  <li>Session B starts, attempts to lock same board → sees "Locked by Session A"</li>
                  <li>Session B can view board in read-only mode or work on different board</li>
                  <li>Session A completes work, releases lock</li>
                  <li>Session B automatically detects available board (via SSE update)</li>
                  <li>Session B acquires lock and continues work</li>
                </ol>
              </div>

              {/* Handling Stale Locks */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Recovering from Stale Locks
                </h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                  <li>Navigate to Boards tab and identify stale lock (⚠️ indicator)</li>
                  <li>Review checkpoint data to see last completed work</li>
                  <li>Click "Force Release" or "Takeover Lock" button</li>
                  <li>System loads checkpoint state and resumes from last known point</li>
                  <li>Continue work on the board with new session</li>
                </ol>
              </div>

              {/* Best Practices */}
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertTitle className="text-green-900 dark:text-green-300">
                  Best Practices
                </AlertTitle>
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Always check Sessions tab before starting work on a board</li>
                    <li>Use Overview tab to monitor overall project health</li>
                    <li>Run coherence checks regularly to maintain quality (&gt; 0.75)</li>
                    <li>Complete retrospectives after each sprint to capture learnings</li>
                    <li>Use dedicated sessions for different boards to avoid lock conflicts</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
