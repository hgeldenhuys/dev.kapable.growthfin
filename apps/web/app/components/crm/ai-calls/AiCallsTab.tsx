/**
 * AiCallsTab Component (Phase J - AI Call History View)
 *
 * Reusable component for displaying AI calls in lead/contact detail pages.
 * Can be embedded as a tab.
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { AiCallCard } from './AiCallCard';
import { Bot, Phone } from 'lucide-react';
import { Link } from 'react-router';

interface AiCallsTabProps {
  entityType: 'lead' | 'contact';
  entityId: string;
  workspaceId: string;
  entityName?: string;
}

// Types
interface AiCallAnalysis {
  intent?: string;
  objections?: string[];
  nextSteps?: string[];
  leadQuality?: 'hot' | 'warm' | 'cold';
}

interface AiCall {
  id: string;
  conversationId: string;
  callOutcome: 'interested' | 'not_interested' | 'callback' | 'voicemail' | 'no_answer' | 'failed' | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  audioSeconds: number | null;
  cost: string | null;
  keyPoints: string[] | null;
  analysis: AiCallAnalysis | null;
  createdAt: string;
}

/**
 * Fetch AI calls for an entity
 */
async function fetchEntityAiCalls(
  entityType: 'lead' | 'contact',
  entityId: string,
  workspaceId: string
): Promise<AiCall[]> {
  const response = await fetch(
    `/api/v1/crm/${entityType}s/${entityId}/ai-calls?workspaceId=${workspaceId}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch AI calls');
  }

  const data = await response.json();
  return data.aiCalls || [];
}

export function AiCallsTab({ entityType, entityId, workspaceId, entityName }: AiCallsTabProps) {
  const {
    data: aiCalls,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ai-calls', entityType, entityId, workspaceId],
    queryFn: () => fetchEntityAiCalls(entityType, entityId, workspaceId),
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-muted-foreground">Loading AI calls...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <Bot className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-red-600">Failed to load AI calls</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!aiCalls || aiCalls.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Phone className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">No AI calls yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use the AI Call button to initiate an AI-powered voice call
                {entityName ? ` with ${entityName}` : ''}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {aiCalls.length} AI call{aiCalls.length !== 1 ? 's' : ''}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/dashboard/${workspaceId}/crm/ai-calls`}>
            View All AI Calls
          </Link>
        </Button>
      </div>

      {/* AI Calls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {aiCalls.map((aiCall) => (
          <AiCallCard
            key={aiCall.id}
            aiCall={aiCall}
            contactName={entityName}
            workspaceId={workspaceId}
          />
        ))}
      </div>

      {/* Summary */}
      {aiCalls.length > 1 && (
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">
                  {aiCalls.filter((c) => c.callOutcome === 'interested').length}
                </p>
                <p className="text-xs text-muted-foreground">Interested</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(
                    aiCalls.reduce((sum, c) => sum + (c.audioSeconds || 0), 0) / 60
                  )}m
                </p>
                <p className="text-xs text-muted-foreground">Total Duration</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {aiCalls.filter((c) => c.sentiment === 'positive').length}
                </p>
                <p className="text-xs text-muted-foreground">Positive Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AiCallsTab;
