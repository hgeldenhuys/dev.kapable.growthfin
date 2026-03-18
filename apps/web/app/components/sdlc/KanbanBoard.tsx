/**
 * SDLC Kanban Board Component
 * Displays stories in kanban columns with WIP limits
 * Supports observer mode when board is locked
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { useSDLCSnapshot } from "../../hooks/useSDLC";
import { useObserverMode } from "../../hooks/useObserverMode";
import { AlertCircle } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { WipLimitsDisplay } from "./WipLimitsDisplay";
import { WipViolationAlert } from "./WipViolationAlert";
import { StoryDetailDialog } from "./StoryDetailDialog";
import { SkeletonLoader } from "./SkeletonLoader";
import { ErrorState } from "./ErrorState";
import { ObserverModeBanner } from "./ObserverModeBanner";

interface KanbanColumn {
  id: string;
  title: string;
  status: keyof NonNullable<ReturnType<typeof useSDLCSnapshot>['data']>['stories'];
  wipLimit?: number;
}

const columns: KanbanColumn[] = [
  { id: 'backlog', title: 'Backlog', status: 'backlog' },
  { id: 'todo', title: 'To Do', status: 'todo', wipLimit: 10 },
  { id: 'ready', title: 'Ready', status: 'ready', wipLimit: 5 },
  { id: 'in-progress', title: 'In Progress', status: 'inProgress', wipLimit: 3 },
  { id: 'review', title: 'Review', status: 'review', wipLimit: 5 },
  { id: 'done', title: 'Done', status: 'done' },
];

export function KanbanBoard() {
  const { data, isLoading, error, refetch } = useSDLCSnapshot();
  const { isObserverMode } = useObserverMode("sdlc-board");
  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleStoryClick = (story: any) => {
    // In observer mode, still allow viewing story details but not editing
    setSelectedStory(story);
    setDialogOpen(true);
  };

  if (isLoading) {
    return <SkeletonLoader variant="kanban" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Error Loading Kanban Board"
        message={error instanceof Error ? error.message : String(error)}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data) {
    return null;
  }

  // Get WIP limits from data or use defaults
  const wipLimits = data.kanban?.wipLimits || {};

  // Calculate WIP violations based on story status (source of truth)
  const violations: Array<{column: string; current: number; limit: number; severity: 'critical' | 'warning'}> = [];

  for (const column of columns) {
    const stories = data.stories[column.status] || [];
    const storyCount = stories.length;
    const limit = wipLimits.per_column?.[column.id] || column.wipLimit;
    const warningThreshold = wipLimits.global?.warning_threshold || 0.8;

    if (limit && storyCount > limit) {
      violations.push({
        column: column.title,
        current: storyCount,
        limit,
        severity: 'critical',
      });
    } else if (limit && storyCount >= limit * warningThreshold) {
      violations.push({
        column: column.title,
        current: storyCount,
        limit,
        severity: 'warning',
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Observer Mode Banner */}
      <ObserverModeBanner boardId="sdlc-board" />

      {/* WIP Violations */}
      <WipViolationAlert violations={violations} />

      {/* WIP Limits Summary */}
      {Object.keys(wipLimits).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">WIP Limits Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <WipLimitsDisplay wipLimits={wipLimits} />
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column, columnIndex) => {
          // Get stories based on their status field (source of truth)
          const stories = data.stories[column.status] || [];

          const wipLimit = wipLimits.per_column?.[column.id] || column.wipLimit;
          const isOverLimit = wipLimit && stories.length > wipLimit;

          return (
            <div key={`column-${column.id}-${columnIndex}`} className="flex-shrink-0 w-80">
              <Card className={isOverLimit ? 'border-destructive' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {column.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {stories.length}
                      </Badge>
                      {wipLimit && (
                        <Badge
                          variant={isOverLimit ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {isOverLimit && <AlertCircle className="h-3 w-3 mr-1" />}
                          /{wipLimit}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[600px] pr-4">
                    {stories.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No stories
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stories.map((story) => (
                          <div
                            key={story.id}
                            title={isObserverMode ? "Read-only - board is locked" : ""}
                          >
                            <Card
                              className={`transition-all ${
                                isObserverMode
                                  ? "cursor-not-allowed opacity-75 border-gray-300 bg-gray-50 dark:bg-gray-900 dark:border-gray-700"
                                  : "cursor-pointer hover:bg-accent"
                              }`}
                              onClick={() => !isObserverMode && handleStoryClick(story)}
                            >
                              <CardContent className="p-3">
                                {/* Story ID and Title */}
                                <div className="font-medium text-sm mb-2 flex items-center gap-2">
                                  {story.id}
                                  {isObserverMode && (
                                    <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100 rounded">
                                      Read-only
                                    </span>
                                  )}
                                </div>
                                <div className={`text-sm mb-3 line-clamp-2 ${isObserverMode ? "text-muted-foreground" : ""}`}>
                                  {story.title}
                                </div>

                              {/* Story Metadata */}
                              <div className="flex flex-wrap gap-1">
                                {story.priority && (
                                  <Badge
                                    variant={
                                      story.priority === 'P0' ? 'destructive' :
                                      story.priority === 'P1' ? 'default' :
                                      'outline'
                                    }
                                    className="text-xs"
                                  >
                                    {story.priority}
                                  </Badge>
                                )}
                                {story.points && (
                                  <Badge variant="secondary" className="text-xs">
                                    {story.points}pt
                                  </Badge>
                                )}
                                {story.epic && (
                                  <Badge variant="outline" className="text-xs">
                                    {story.epic}
                                  </Badge>
                                )}
                              </div>

                              {/* Blockers */}
                              {story.blockers && story.blockers.length > 0 && (
                                <div className="mt-2 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 text-destructive" />
                                  <span className="text-xs text-destructive">
                                    {story.blockers.length} blocker(s)
                                  </span>
                                </div>
                              )}

                              {/* Assignee */}
                              {story.assignee && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  {story.assignee}
                                </div>
                              )}
                            </CardContent>
                            </Card>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Blocked Stories */}
      {data.stories.blocked && data.stories.blocked.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Blocked Stories ({data.stories.blocked.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.stories.blocked.map((story) => (
                <div
                  key={story.id}
                  className="flex items-center justify-between p-3 border border-destructive rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{story.id}: {story.title}</div>
                    {story.blockers && story.blockers.length > 0 && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Blocked by: {story.blockers.join(', ')}
                      </div>
                    )}
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    Blocked
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Story Detail Dialog */}
      <StoryDetailDialog
        story={selectedStory}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
