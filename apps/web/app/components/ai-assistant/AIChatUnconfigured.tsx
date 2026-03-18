/**
 * AIChatUnconfigured Component
 * Shows helpful message when AI is not configured
 */

import { AlertCircle, Settings, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../ui/button';

export interface AIChatUnconfiguredProps {
  workspaceId: string;
}

export function AIChatUnconfigured({ workspaceId }: AIChatUnconfiguredProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />

      <h3 className="text-lg font-semibold mb-2">
        AI Assistant Not Configured
      </h3>

      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        To use the AI assistant, you need to configure your OpenRouter API key
        in workspace settings.
      </p>

      <Button asChild className="mb-6">
        <Link to={`/dashboard/${workspaceId}/settings/ai`}>
          <Settings className="h-4 w-4 mr-2" />
          Configure AI Settings
        </Link>
      </Button>

      <div className="mt-2 p-4 bg-muted rounded-lg text-left w-full max-w-sm">
        <p className="text-sm font-medium mb-3">How to get started:</p>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Get an API key from OpenRouter.ai</li>
          <li>Go to workspace settings</li>
          <li>Add your API key in the AI section</li>
          <li>Start chatting with your AI assistant!</li>
        </ol>
      </div>

      <a
        href="https://openrouter.ai/keys"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 text-xs text-primary hover:underline inline-flex items-center gap-1"
      >
        Get OpenRouter API Key
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
