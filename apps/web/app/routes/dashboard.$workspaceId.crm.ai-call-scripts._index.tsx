/**
 * AI Call Scripts Management Page
 *
 * Create and manage reusable AI call script templates for voice calls.
 * Scripts define how the AI agent should conduct calls - objectives,
 * talking points, objection handling, and end conditions.
 *
 * Phase I: AI Voice Calling (ElevenLabs Conversational AI)
 */

import { Link, useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import {
  Plus,
  Bot,
  Edit,
  Trash2,
  Loader2,
  Star,
  Phone,
  Target,
  MessageSquare,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';
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
} from '~/components/ui/alert-dialog';

type AiCallScript = {
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  objective?: string;
  opening: string;
  talkingPoints?: string[];
  objectionHandlers?: Record<string, string>;
  qualifyingQuestions?: string[];
  closing?: string;
  endConditions?: {
    success: string[];
    failure: string[];
    neutral: string[];
  };
  voiceStyle?: {
    tone?: string;
    pace?: string;
    enthusiasm?: string;
  };
  isActive: boolean;
  isDefault: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
};

const PURPOSE_LABELS: Record<string, string> = {
  qualification: 'Lead Qualification',
  sales_pitch: 'Sales Pitch',
  demo_booking: 'Demo Booking',
  follow_up: 'Follow Up',
  survey: 'Survey',
  appointment_reminder: 'Appointment Reminder',
  custom: 'Custom',
};

const PURPOSE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  qualification: Target,
  sales_pitch: Phone,
  demo_booking: CheckCircle,
  follow_up: MessageSquare,
  survey: HelpCircle,
  appointment_reminder: Star,
  custom: Bot,
};

export default function AiCallScriptsIndex() {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['ai-call-scripts', workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/ai-call-scripts?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error('Failed to load AI call scripts');
      }
      const data = await response.json();
      return data.scripts as AiCallScript[];
    },
    enabled: !!workspaceId,
  });

  const scripts = data || [];

  const deleteScript = useMutation({
    mutationFn: async (scriptId: string) => {
      const response = await fetch(
        `/api/v1/crm/ai-call-scripts/${scriptId}?workspaceId=${workspaceId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete script');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-call-scripts', workspaceId] });
      toast.success('Script deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete script', { description: error.message });
    },
  });

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Call Scripts</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage scripts that guide AI voice calls - objectives, talking points, and objection handling
          </p>
        </div>
        <Button asChild>
          <Link to={`/dashboard/${workspaceId}/crm/ai-call-scripts/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Script
          </Link>
        </Button>
      </div>

      {scripts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No AI call scripts yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first script to guide AI voice calls with leads and contacts
            </p>
            <Button asChild>
              <Link to={`/dashboard/${workspaceId}/crm/ai-call-scripts/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Create Script
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scripts.map((script) => {
            const PurposeIcon = PURPOSE_ICONS[script.purpose || 'custom'] || Bot;
            return (
              <Card key={script.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <PurposeIcon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-lg">{script.name}</CardTitle>
                      </div>
                      {script.description && (
                        <CardDescription className="mt-1">
                          {script.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {script.isDefault && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" />
                          Default
                        </Badge>
                      )}
                      <Badge variant={script.isActive ? 'default' : 'secondary'}>
                        {script.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Purpose */}
                    <Badge variant="outline">
                      {PURPOSE_LABELS[script.purpose || 'custom'] || 'Custom'}
                    </Badge>

                    {/* Objective */}
                    {script.objective && (
                      <div>
                        <p className="text-sm font-medium mb-1">Objective:</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {script.objective}
                        </p>
                      </div>
                    )}

                    {/* Opening */}
                    <div>
                      <p className="text-sm font-medium mb-1">Opening:</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        "{script.opening}"
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{script.talkingPoints?.length || 0} talking points</span>
                      <span>{Object.keys(script.objectionHandlers || {}).length} objection handlers</span>
                      <span>{script.qualifyingQuestions?.length || 0} questions</span>
                    </div>

                    {/* Voice style */}
                    {script.voiceStyle && (
                      <div className="flex gap-2">
                        {script.voiceStyle.tone && (
                          <Badge variant="secondary" className="text-xs">
                            {script.voiceStyle.tone}
                          </Badge>
                        )}
                        {script.voiceStyle.pace && (
                          <Badge variant="secondary" className="text-xs">
                            {script.voiceStyle.pace} pace
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Use count */}
                    <div className="text-xs text-muted-foreground">
                      Used {script.useCount} time{script.useCount !== 1 ? 's' : ''}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link to={`/dashboard/${workspaceId}/crm/ai-call-scripts/${script.id}`}>
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Script</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{script.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteScript.mutate(script.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
