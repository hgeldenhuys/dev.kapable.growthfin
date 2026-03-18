/**
 * US-AI-009: Chat Widget Component
 * Header for the chat widget with minimize, clear, and voice mode buttons
 */

import { X, Trash2, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { cn } from '../../lib/utils';

export interface AIChatHeaderProps {
  onMinimize: () => void;
  onClear?: () => void;
  voiceMode?: boolean;
  onToggleVoiceMode?: () => void;
}

export function AIChatHeader({ onMinimize, onClear, voiceMode, onToggleVoiceMode }: AIChatHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b p-4 pt-0 bg-muted/30">
      <div className="flex items-center gap-1">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">AI Assistant</h3>
      </div>
      <div className="flex items-center gap-1">
        {onToggleVoiceMode && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              voiceMode && 'text-primary bg-primary/10'
            )}
            onClick={onToggleVoiceMode}
            title={voiceMode ? 'Voice mode on — click to disable' : 'Auto-read responses'}
            data-testid="ai-chat-voice-mode"
          >
            {voiceMode ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
        )}
        {onClear && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                data-testid="ai-chat-clear-button"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear conversation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all messages in this conversation. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClear}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onMinimize}
          data-testid="ai-chat-minimize-button"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
