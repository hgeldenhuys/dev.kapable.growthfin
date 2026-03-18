/**
 * Story Detail Dialog Component
 * Shows full markdown content and metadata for a user story
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Code } from "lucide-react";

interface StoryDetailDialogProps {
  story: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoryDetailDialog({ story, open, onOpenChange }: StoryDetailDialogProps) {
  if (!story) return null;

  // Fallback display name for stories without ID/title
  const displayTitle = story.id || story.title || story.report_id || "Untitled Story";
  const hasContent = story.content && typeof story.content === 'string';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {displayTitle}
            {story.raw && (
              <Badge variant="outline" className="text-xs">
                <Code className="h-3 w-3 mr-1" />
                Raw Markdown
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {/* Metadata */}
            {!story.raw && (
              <div className="flex flex-wrap gap-2">
                {story.priority && (
                  <Badge
                    variant={
                      story.priority === 'P0' ? 'destructive' :
                      story.priority === 'P1' ? 'default' :
                      story.priority === 'High' ? 'default' :
                      'outline'
                    }
                  >
                    Priority: {story.priority}
                  </Badge>
                )}
                {story.points && (
                  <Badge variant="secondary">
                    {story.points} Points
                  </Badge>
                )}
                {story.status && (
                  <Badge variant="outline">
                    Status: {story.status}
                  </Badge>
                )}
                {story.epic && (
                  <Badge variant="outline">
                    Epic: {story.epic}
                  </Badge>
                )}
                {story.phase && (
                  <Badge variant="outline">
                    Phase: {story.phase}
                  </Badge>
                )}
              </div>
            )}

            {/* QA Report specific fields */}
            {story.report_id && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Report ID: {story.report_id}
                </Badge>
                {story.date && (
                  <Badge variant="outline">
                    Date: {story.date}
                  </Badge>
                )}
                {story.overall_status && (
                  <Badge variant={story.overall_status === 'PASSED' ? 'default' : 'destructive'}>
                    {story.overall_status}
                  </Badge>
                )}
              </div>
            )}

            {/* Full Markdown Content */}
            {hasContent && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                  <Code className="h-4 w-4" />
                  Markdown Content
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                  {story.content}
                </pre>
              </div>
            )}

            {/* Debug: Show all fields */}
            {!hasContent && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Object Fields
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(story, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
