/**
 * StopEventView Component
 *
 * Custom view for Stop hook events
 * Displays the last assistant message and stop-related metadata
 */

import { useState } from 'react';
import { MessageSquare, Clock, StopCircle, User, Maximize2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { FullscreenMarkdownViewer } from '../FullscreenMarkdownViewer';
import type { HookEvent } from '~/hooks/useHookEvent';

interface StopEventViewProps {
  event: HookEvent;
}

export function StopEventView({ event }: StopEventViewProps) {
  const { conversation, event: stopEvent } = event.payload;
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  // Extract last assistant message from conversation
  // Structure: conversation.message.content[0].text
  const messageContent = conversation?.message?.content;
  const messageText = Array.isArray(messageContent) && messageContent.length > 0
    ? messageContent[0].text || 'No message available'
    : 'No message available';

  return (
    <div className="space-y-4">
      {/* Stop Event Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StopCircle className="h-4 w-4 text-red-500" />
            Stop Event
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Stop Hook Active</p>
              <Badge variant={stopEvent?.stop_hook_active ? 'default' : 'outline'}>
                {stopEvent?.stop_hook_active ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Event Time
              </p>
              <p className="text-sm font-mono">
                {new Date(event.payload.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Assistant Message */}
      {conversation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Last Assistant Message
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreenOpen(true)}
                className="h-8 w-8"
                aria-label="Open fullscreen viewer"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {conversation.lineNumber && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Transcript Line:</span>
                <Badge variant="outline" className="font-mono">
                  {conversation.lineNumber}
                </Badge>
              </div>
            )}

            <div className="bg-muted/50 p-4 rounded-md">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Assistant</p>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-sm whitespace-pre-wrap break-words">{messageText}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Working Directory */}
      {stopEvent?.cwd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Working Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono block overflow-x-auto">
              {stopEvent.cwd}
            </code>
          </CardContent>
        </Card>
      )}

      {/* Fullscreen Markdown Viewer */}
      {isFullscreenOpen && (
        <FullscreenMarkdownViewer
          content={messageText}
          onClose={() => setIsFullscreenOpen(false)}
        />
      )}
    </div>
  );
}
