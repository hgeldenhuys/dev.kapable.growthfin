/**
 * AiCallButton Component
 *
 * Button to initiate AI-powered voice calls via ElevenLabs Conversational AI.
 * The AI agent autonomously conducts qualifying calls with leads/contacts.
 *
 * Features:
 * - Script selection dialog to choose how AI conducts the call
 * - States: idle, selecting-script, initiating, active, completed, error
 * - Context-aware: passes lead/contact history to AI
 *
 * Phase I: AI Voice Calling (ElevenLabs Conversational AI)
 */

import { useState, useCallback } from 'react';
import { Bot, Loader2, ChevronDown, Target, Phone, CheckCircle, MessageSquare, HelpCircle, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '~/components/ui/dropdown-menu';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

export interface AiCallButtonProps {
  /** Workspace ID for the API call */
  workspaceId: string;
  /** Lead ID - provide either leadId OR contactId, not both */
  leadId?: string;
  /** Contact ID - provide either leadId OR contactId, not both */
  contactId?: string;
  /** User ID for tracking who initiated the call */
  userId?: string;
  /** Phone number to call (E.164 format), null if no phone */
  phoneNumber: string | null;
  /** Entity name for display in tooltips */
  entityName?: string;
  /** Optional custom prompt for the AI agent (overrides script) */
  customPrompt?: string;
  /** Additional CSS classes */
  className?: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Whether to show script selection dropdown */
  showScriptSelection?: boolean;
}

type CallState = 'idle' | 'selecting-script' | 'initiating' | 'active' | 'completed' | 'error';

interface AiCallScript {
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  objective?: string;
  isDefault: boolean;
  isActive: boolean;
}

interface AiCallResponse {
  success: boolean;
  callId?: string;
  aiCallId?: string;
  conversationId?: string;
  error?: {
    code: string;
    message: string;
  };
}

const PURPOSE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  qualification: Target,
  sales_pitch: Phone,
  demo_booking: CheckCircle,
  follow_up: MessageSquare,
  survey: HelpCircle,
  appointment_reminder: Star,
  custom: Bot,
};

export function AiCallButton({
  workspaceId,
  leadId,
  contactId,
  userId,
  phoneNumber,
  entityName,
  customPrompt,
  className,
  variant = 'outline',
  size = 'default',
  showScriptSelection = true,
}: AiCallButtonProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Determine entity type and endpoint
  const entityType = leadId ? 'lead' : 'contact';
  const entityId = leadId || contactId;

  // Fetch available scripts
  const { data: scriptsData, isLoading: scriptsLoading } = useQuery({
    queryKey: ['ai-call-scripts', workspaceId, 'active'],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/ai-call-scripts?workspaceId=${workspaceId}&activeOnly=true`
      );
      if (!response.ok) {
        throw new Error('Failed to load scripts');
      }
      const data = await response.json();
      return data.scripts as AiCallScript[];
    },
    enabled: !!workspaceId && showScriptSelection,
  });

  const scripts = scriptsData || [];
  const defaultScript = scripts.find(s => s.isDefault);
  const selectedScript = scripts.find(s => s.id === selectedScriptId) || defaultScript;

  // Mutation for initiating AI call
  const initiateCall = useMutation({
    mutationFn: async (scriptId?: string) => {
      const endpoint = leadId
        ? `/api/v1/crm/leads/${leadId}/ai-call`
        : `/api/v1/crm/contacts/${contactId}/ai-call`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId,
          userId,
          customPrompt,
          scriptId: scriptId || selectedScriptId || defaultScript?.id,
        }),
      });

      const data: AiCallResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to initiate AI call');
      }

      return data;
    },
    onMutate: () => {
      setCallState('initiating');
      setIsDialogOpen(false);
    },
    onSuccess: (data) => {
      setCallState('active');
      setConversationId(data.conversationId || null);
      const scriptName = selectedScript?.name || 'default';
      toast.success(`AI call initiated to ${entityName || entityType}`, {
        description: `Using "${scriptName}" script. The AI agent is now conducting the call.`,
      });
    },
    onError: (error: Error) => {
      setCallState('error');
      toast.error('Failed to initiate AI call', {
        description: error.message,
      });
      // Reset to idle after error
      setTimeout(() => setCallState('idle'), 3000);
    },
  });

  /**
   * Handle AI call button click
   */
  const handleAiCall = useCallback(async (scriptId?: string) => {
    if (!phoneNumber) {
      toast.error('No phone number available');
      return;
    }

    if (!entityId) {
      toast.error('Lead ID or Contact ID is required');
      return;
    }

    if (callState === 'initiating' || callState === 'active') {
      return;
    }

    initiateCall.mutate(scriptId);
  }, [phoneNumber, entityId, callState, initiateCall]);

  /**
   * Handle clicking the main button - show script selection if available
   */
  const handleMainButtonClick = useCallback(() => {
    if (showScriptSelection && scripts.length > 0) {
      setIsDialogOpen(true);
      setCallState('selecting-script');
    } else {
      handleAiCall();
    }
  }, [showScriptSelection, scripts.length, handleAiCall]);

  /**
   * Reset to idle state
   */
  const resetToIdle = useCallback(() => {
    setCallState('idle');
    setConversationId(null);
    setSelectedScriptId(null);
  }, []);

  // Derived states
  const hasNoPhone = !phoneNumber;
  const isLoading = callState === 'initiating';
  const isActive = callState === 'active';
  const isError = callState === 'error';
  const isSelecting = callState === 'selecting-script';

  // No phone number state
  if (hasNoPhone) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={cn('gap-2', className)}
        title="No phone number available for AI call"
      >
        <Bot className="h-4 w-4" />
        <span>AI Call</span>
      </Button>
    );
  }

  // Initiating state
  if (isLoading) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={cn('gap-2', className)}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Initiating...</span>
      </Button>
    );
  }

  // Active call state
  if (isActive) {
    return (
      <Button
        variant="secondary"
        size={size}
        disabled
        className={cn('gap-2', className)}
        title="AI call in progress"
      >
        <div className="relative">
          <Bot className="h-4 w-4 text-green-600" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        <span className="text-green-600">AI Call Active</span>
      </Button>
    );
  }

  // Error state (briefly shown)
  if (isError) {
    return (
      <Button
        variant="destructive"
        size={size}
        disabled
        className={cn('gap-2', className)}
      >
        <Bot className="h-4 w-4" />
        <span>Error</span>
      </Button>
    );
  }

  // If we have scripts, show dropdown with script selection
  if (showScriptSelection && scripts.length > 0) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={cn('gap-2', className)}
              title={entityName ? `Start AI call with ${entityName}` : `Start AI call to ${entityType}`}
            >
              <Bot className="h-4 w-4" />
              <span>AI Call</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Select Script</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {scripts.map((script) => {
              const PurposeIcon = PURPOSE_ICONS[script.purpose || 'custom'] || Bot;
              return (
                <DropdownMenuItem
                  key={script.id}
                  onClick={() => handleAiCall(script.id)}
                  className="flex items-start gap-2 py-2"
                >
                  <PurposeIcon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium truncate">{script.name}</span>
                      {script.isDefault && (
                        <Badge variant="secondary" className="text-xs h-4 px-1">
                          Default
                        </Badge>
                      )}
                    </div>
                    {script.objective && (
                      <p className="text-xs text-muted-foreground truncate">
                        {script.objective}
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleAiCall()}
              className="text-muted-foreground"
            >
              <Bot className="h-4 w-4 mr-2" />
              Use default script
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Script selection dialog (for more detailed selection if needed) */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setCallState('idle');
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Select Call Script</DialogTitle>
              <DialogDescription>
                Choose a script to guide the AI during the call with {entityName || entityType}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4 max-h-64 overflow-y-auto">
              {scripts.map((script) => {
                const PurposeIcon = PURPOSE_ICONS[script.purpose || 'custom'] || Bot;
                const isSelected = selectedScriptId === script.id || (!selectedScriptId && script.isDefault);
                return (
                  <div
                    key={script.id}
                    onClick={() => setSelectedScriptId(script.id)}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <PurposeIcon className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{script.name}</span>
                        {script.isDefault && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                      </div>
                      {script.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {script.description}
                        </p>
                      )}
                      {script.objective && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Goal: {script.objective}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleAiCall(selectedScriptId || defaultScript?.id)}>
                <Bot className="h-4 w-4 mr-2" />
                Start Call
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Idle state - show simple AI call button (no scripts available)
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => handleAiCall()}
      className={cn('gap-2', className)}
      title={entityName ? `Start AI call with ${entityName}` : `Start AI call to ${entityType}`}
    >
      <Bot className="h-4 w-4" />
      <span>AI Call</span>
    </Button>
  );
}

export default AiCallButton;
