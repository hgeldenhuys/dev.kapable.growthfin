/**
 * AI Call Detail Page (Phase J - AI Call History View)
 *
 * Displays full details of an AI voice call including transcript,
 * analysis, and conversation events.
 */

import { useLoaderData, useNavigate, Link } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { cn } from '~/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { getSession } from '~/lib/auth';
import {
  ArrowLeft,
  Bot,
  Clock,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  Clock3,
  Voicemail,
  PhoneMissed,
  AlertCircle,
  Smile,
  Meh,
  Frown,
  Flame,
  Sun,
  Snowflake,
  User,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

// Types
interface AiCallAnalysis {
  intent?: string;
  objections?: string[];
  nextSteps?: string[];
  leadQuality?: 'hot' | 'warm' | 'cold';
}

// AiCall type matches crmAiCalls schema
type AiCall = {
  id: string;
  conversationId: string;
  agentId: string;
  callOutcome: 'interested' | 'not_interested' | 'callback' | 'voicemail' | 'no_answer' | 'failed' | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  audioSeconds: number | null;
  cost: string | null;
  keyPoints: string[] | null;
  analysis: AiCallAnalysis | null;
  transcript: string | null;
  createdAt: string;
  updatedAt: string;
};

interface AiCallEvent {
  id: string;
  eventType: 'user_speech' | 'agent_response' | 'tool_use' | 'conversation_started' | 'conversation_ended' | 'error';
  timestamp: string;
  content: string | null;
  metadata: Record<string, any> | null;
}

/**
 * Loader - Fetch AI call details
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const { workspaceId, aiCallId } = params;

  if (!workspaceId || !aiCallId) {
    throw new Response('Missing required parameters', { status: 400 });
  }

  const apiUrl = process.env['API_URL'] || 'http://localhost:3000';
  const response = await fetch(
    `${apiUrl}/api/v1/crm/ai-calls/${aiCallId}?workspaceId=${workspaceId}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Response('AI call not found', { status: 404 });
    }
    throw new Response('Failed to fetch AI call', { status: response.status });
  }

  const data = await response.json();
  return {
    call: data.call as AiCall,
    events: data.events || [] as AiCallEvent[],
    transcript: data.transcript,
  };
}

/**
 * Format duration
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Outcome badge configuration
 */
const OUTCOME_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; className?: string }
> = {
  interested: { label: 'Interested', variant: 'default', icon: <ThumbsUp className="h-4 w-4" />, className: 'bg-green-500' },
  not_interested: { label: 'Not Interested', variant: 'destructive', icon: <ThumbsDown className="h-4 w-4" /> },
  callback: { label: 'Callback Requested', variant: 'secondary', icon: <Clock3 className="h-4 w-4" />, className: 'bg-yellow-500 text-black' },
  voicemail: { label: 'Voicemail', variant: 'outline', icon: <Voicemail className="h-4 w-4" /> },
  no_answer: { label: 'No Answer', variant: 'outline', icon: <PhoneMissed className="h-4 w-4" /> },
  failed: { label: 'Failed', variant: 'destructive', icon: <AlertCircle className="h-4 w-4" /> },
};

/**
 * Sentiment badge configuration
 */
const SENTIMENT_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  positive: { label: 'Positive', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300', icon: <Smile className="h-4 w-4" /> },
  neutral: { label: 'Neutral', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400 border-gray-300', icon: <Meh className="h-4 w-4" /> },
  negative: { label: 'Negative', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300', icon: <Frown className="h-4 w-4" /> },
};

/**
 * Lead quality badge configuration
 */
const QUALITY_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  hot: { label: 'Hot Lead', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300', icon: <Flame className="h-4 w-4" /> },
  warm: { label: 'Warm Lead', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300', icon: <Sun className="h-4 w-4" /> },
  cold: { label: 'Cold Lead', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300', icon: <Snowflake className="h-4 w-4" /> },
};

/**
 * Event type colors for timeline
 */
const EVENT_COLORS: Record<string, string> = {
  user_speech: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  agent_response: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
  tool_use: 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
  conversation_started: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
  conversation_ended: 'bg-gray-100 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800',
  error: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
};

export default function AiCallDetailPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const { call, events, transcript } = useLoaderData<typeof loader>();

  const outcomeConfig = call.callOutcome ? OUTCOME_CONFIG[call.callOutcome] : null;
  const sentimentConfig = call.sentiment ? SENTIMENT_CONFIG[call.sentiment] : null;
  const qualityConfig = call.analysis?.leadQuality ? QUALITY_CONFIG[call.analysis.leadQuality] : null;

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/ai-calls`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-8 w-8" />
              AI Call Details
            </h1>
            <p className="text-muted-foreground">
              {formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/dashboard/${workspaceId}/crm/ai-calls`}>
              View All Calls
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Call Summary</CardTitle>
          <CardDescription>
            Conversation ID: {call.conversationId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Outcome */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Outcome</p>
              {outcomeConfig ? (
                <Badge
                  variant={outcomeConfig.variant}
                  className={cn('gap-2 text-sm py-1.5 px-3', outcomeConfig.className)}
                >
                  {outcomeConfig.icon}
                  {outcomeConfig.label}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Unknown</span>
              )}
            </div>

            {/* Sentiment */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Sentiment</p>
              {sentimentConfig ? (
                <Badge
                  variant="outline"
                  className={cn('gap-2 text-sm py-1.5 px-3', sentimentConfig.className)}
                >
                  {sentimentConfig.icon}
                  {sentimentConfig.label}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Not analyzed</span>
              )}
            </div>

            {/* Lead Quality */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Lead Quality</p>
              {qualityConfig ? (
                <Badge
                  variant="outline"
                  className={cn('gap-2 text-sm py-1.5 px-3', qualityConfig.className)}
                >
                  {qualityConfig.icon}
                  {qualityConfig.label}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Not assessed</span>
              )}
            </div>

            {/* Duration & Cost */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Duration: <strong>{formatDuration(call.audioSeconds)}</strong>
                </span>
              </div>
              {call.cost && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Cost: <strong>${parseFloat(call.cost).toFixed(2)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Points */}
          {call.keyPoints && call.keyPoints.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Key Points
              </h4>
              <ul className="space-y-2">
                {call.keyPoints.map((point: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Separator />

          {/* Intent */}
          {call.analysis?.intent && (
            <div>
              <h4 className="font-medium mb-2">Detected Intent</h4>
              <p className="text-sm bg-muted/50 rounded-lg p-3">{call.analysis.intent}</p>
            </div>
          )}

          {/* Objections */}
          {call.analysis?.objections && call.analysis.objections.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Objections Raised
              </h4>
              <ul className="space-y-2">
                {call.analysis.objections.map((objection: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                    {objection}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {call.analysis?.nextSteps && call.analysis.nextSteps.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                Recommended Next Steps
              </h4>
              <ul className="space-y-2">
                {call.analysis.nextSteps.map((step: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <span className="font-medium">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!call.keyPoints?.length && !call.analysis?.intent && !call.analysis?.objections?.length && !call.analysis?.nextSteps?.length && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No analysis data available for this call.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transcript & Events Tabs */}
      <Tabs defaultValue="transcript" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transcript">
            <MessageCircle className="mr-2 h-4 w-4" />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="events">
            <Clock className="mr-2 h-4 w-4" />
            Event Timeline
          </TabsTrigger>
        </TabsList>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Full Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              {transcript ? (
                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm">
                  {transcript}
                </div>
              ) : events.length > 0 ? (
                <div className="space-y-3">
                  {events
                    .filter((e: AiCallEvent) => e.eventType === 'user_speech' || e.eventType === 'agent_response')
                    .map((event: AiCallEvent) => (
                      <div
                        key={event.id}
                        className={cn(
                          'p-3 rounded-lg border',
                          event.eventType === 'user_speech'
                            ? 'bg-blue-50 dark:bg-blue-900/20 ml-8'
                            : 'bg-purple-50 dark:bg-purple-900/20 mr-8'
                        )}
                      >
                        <div className="flex justify-between text-xs mb-2">
                          <span className="font-medium flex items-center gap-1">
                            {event.eventType === 'user_speech' ? (
                              <>
                                <User className="h-3 w-3" />
                                Customer
                              </>
                            ) : (
                              <>
                                <Bot className="h-3 w-3" />
                                AI Agent
                              </>
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            {format(new Date(event.timestamp), 'HH:mm:ss')}
                          </span>
                        </div>
                        <p className="text-sm">{event.content}</p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No transcript available for this call.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Events</CardTitle>
              <CardDescription>
                Chronological timeline of all events during the call
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length > 0 ? (
                <div className="space-y-3">
                  {events.map((event: AiCallEvent) => (
                    <div
                      key={event.id}
                      className={cn(
                        'p-3 rounded-lg border',
                        EVENT_COLORS[event.eventType] || 'bg-muted'
                      )}
                    >
                      <div className="flex justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {event.eventType.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.timestamp), 'HH:mm:ss.SSS')}
                        </span>
                      </div>
                      {event.content && (
                        <p className="text-sm">{event.content}</p>
                      )}
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <pre className="text-xs text-muted-foreground mt-2 overflow-x-auto">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No events recorded for this call.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Technical Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Call ID</p>
              <p className="font-mono text-xs truncate">{call.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Agent ID</p>
              <p className="font-mono text-xs truncate">{call.agentId}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p>{format(new Date(call.createdAt), 'PPpp')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Updated</p>
              <p>{format(new Date(call.updatedAt), 'PPpp')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
