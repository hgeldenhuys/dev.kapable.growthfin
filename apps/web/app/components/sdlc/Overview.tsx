/**
 * SDLC Overview Tab
 * Summary cards and recent activity feed
 * Includes multi-session statistics and quick navigation
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useSDLCSnapshot } from "../../hooks/useSDLC";
import { Activity, GitBranch, AlertCircle, Lock } from "lucide-react";
import { useNavigate } from "react-router";
import { StoryDetailDialog } from "./StoryDetailDialog";
import { SkeletonLoader } from "./SkeletonLoader";
import { ErrorState } from "./ErrorState";
import { CoherenceMetrics } from "./CoherenceMetrics";

export function Overview() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useSDLCSnapshot();
  const [selectedRetrospective, setSelectedRetrospective] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Multi-session stats
  const [multiSessionStats, setMultiSessionStats] = useState<{
    activeSessions: number;
    lockedBoards: number;
    staleLocks: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch multi-session stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const [sessionsRes, boardsRes] = await Promise.all([
          fetch('/api/v1/sdlc/sessions'),
          fetch('/api/v1/sdlc/boards'),
        ]);

        if (sessionsRes.ok && boardsRes.ok) {
          const sessionsData = await sessionsRes.json();
          const boardsData = await boardsRes.json();

          setMultiSessionStats({
            activeSessions: sessionsData.sessions?.length || 0,
            lockedBoards: boardsData.locked_boards || 0,
            staleLocks: boardsData.stale_locks || 0,
          });
        }
      } catch (err) {
        console.error('Failed to fetch multi-session stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handleRetrospectiveClick = (retro: any) => {
    setSelectedRetrospective(retro);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="list" count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Error Loading SDLC Data"
        message={error instanceof Error ? error.message : String(error)}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data) {
    return null;
  }

  // Calculate active stories
  const activeStories = [
    ...(data.stories.ready || []),
    ...(data.stories.inProgress || []),
    ...(data.stories.review || []),
  ];

  // Calculate active epics
  const activeEpics = data.epics.active || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Active Stories */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stories</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStories.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.stories.inProgress?.length || 0} in progress
            </p>
          </CardContent>
        </Card>

        {/* Active Epics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Epics</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEpics.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.epics.planned?.length || 0} planned
            </p>
          </CardContent>
        </Card>

        {/* Total Files */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metadata.totalFiles}</div>
            <p className="text-xs text-muted-foreground mt-1">
              In codebase
            </p>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card className={statsLoading ? 'opacity-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{multiSessionStats?.activeSessions || 0}</div>
            <button
              onClick={() => navigate('/claude/sdlc/sessions')}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline mt-1"
            >
              View Sessions
            </button>
          </CardContent>
        </Card>

        {/* Locked Boards */}
        <Card className={statsLoading ? 'opacity-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locked Boards</CardTitle>
            <Lock className={`h-4 w-4 ${multiSessionStats?.lockedBoards ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${multiSessionStats?.lockedBoards ? 'text-red-600' : ''}`}>
              {multiSessionStats?.lockedBoards || 0}
            </div>
            <button
              onClick={() => navigate('/claude/sdlc/boards')}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline mt-1"
            >
              View Boards
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Stale Locks Warning */}
      {multiSessionStats && multiSessionStats.staleLocks > 0 && (
        <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-orange-900 dark:text-orange-100">
              {multiSessionStats.staleLocks} Stale Lock{multiSessionStats.staleLocks !== 1 ? 's' : ''}
            </div>
            <div className="text-sm text-orange-800 dark:text-orange-200 mt-1">
              Boards have locks older than 5 minutes. Consider checking the Boards tab for details or force-releasing stale locks.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/claude/sdlc/boards')}
              className="mt-3 bg-orange-100 dark:bg-orange-900 hover:bg-orange-200 dark:hover:bg-orange-800 border-orange-300 dark:border-orange-700"
            >
              Go to Boards
            </Button>
          </div>
        </div>
      )}

      {/* Coherence Metrics */}
      <CoherenceMetrics />

      {/* Active Stories List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Stories</CardTitle>
          <CardDescription>Stories currently in progress or ready for development</CardDescription>
        </CardHeader>
        <CardContent>
          {activeStories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active stories
            </div>
          ) : (
            <div className="space-y-2">
              {activeStories.slice(0, 10).map((story) => (
                <div
                  key={story.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium">{story.id}: {story.title}</div>
                    {story.epic && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Epic: {story.epic}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {story.priority && (
                      <Badge variant="outline" className="text-xs">
                        {story.priority}
                      </Badge>
                    )}
                    {story.points && (
                      <Badge variant="secondary" className="text-xs">
                        {story.points}pt
                      </Badge>
                    )}
                    <Badge
                      variant={
                        story.status === 'in-progress' ? 'default' :
                        story.status === 'review' ? 'secondary' :
                        'outline'
                      }
                      className="text-xs"
                    >
                      {story.status || 'ready'}
                    </Badge>
                  </div>
                </div>
              ))}
              {activeStories.length > 10 && (
                <div className="text-center py-2 text-sm text-muted-foreground">
                  ... and {activeStories.length - 10} more stories
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Retrospectives */}
      {data.retrospectives && data.retrospectives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Retrospectives</CardTitle>
            <CardDescription>Latest sprint retrospectives and learnings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.retrospectives.slice(0, 5).map((retro, index) => {
                // Extract date from content if available
                let displayDate = 'Draft';
                if (retro.content) {
                  // Try to match **Date**: YYYY-MM-DD pattern
                  const dateMatch = retro.content.match(/\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/);
                  if (dateMatch) {
                    // Parse as local date to avoid timezone shifts
                    const [year, month, day] = dateMatch[1].split('-').map(Number);
                    const date = new Date(year, month - 1, day); // month is 0-indexed
                    displayDate = date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    });
                  }
                }

                // Extract title from first heading
                let displayTitle = `Retrospective ${index + 1}`;
                if (retro.content) {
                  const titleMatch = retro.content.match(/^#\s+(.+?)$/m);
                  if (titleMatch) {
                    displayTitle = titleMatch[1].replace(/🔄|📚|🎯|✨/g, '').trim();
                  }
                }

                return (
                  <div
                    key={index}
                    className="border-l-2 border-primary pl-4 py-2 cursor-pointer hover:bg-accent transition-colors rounded-r-lg pr-3"
                    onClick={() => handleRetrospectiveClick(retro)}
                  >
                    <div className="font-medium">{displayTitle}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {displayDate}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Knowledge Graph Summary */}
      {data.knowledgeGraph && (
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Graph</CardTitle>
            <CardDescription>Captured knowledge and architectural insights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{data.knowledgeGraph.entities.components?.length || 0}</div>
                <div className="text-sm text-muted-foreground mt-1">Components</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{data.knowledgeGraph.entities.decisions?.length || 0}</div>
                <div className="text-sm text-muted-foreground mt-1">Decisions</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{data.knowledgeGraph.entities.understandings?.length || 0}</div>
                <div className="text-sm text-muted-foreground mt-1">Understandings</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{data.knowledgeGraph.entities.values?.length || 0}</div>
                <div className="text-sm text-muted-foreground mt-1">Values</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{data.knowledgeGraph.relations?.length || 0}</div>
                <div className="text-sm text-muted-foreground mt-1">Relations</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Retrospective Detail Dialog */}
      <StoryDetailDialog
        story={selectedRetrospective}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
