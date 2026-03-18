/**
 * AI Calls List Page (Phase J - AI Call History View)
 *
 * Displays a grid of AI voice calls with filtering and search capabilities.
 */

import { useState } from 'react';
import { useLoaderData, Link } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Button } from '~/components/ui/button';
import { AiCallCard } from '~/components/crm/ai-calls/AiCallCard';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { Bot, Search, Phone, FileText, BarChart2 } from 'lucide-react';
import { getSession } from '~/lib/auth';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

// Reuse types from component
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
  direction?: 'inbound' | 'outbound' | null;
  callerIdentified?: boolean;
  callerPhoneNumber?: string | null;
  identifiedEntityType?: 'lead' | 'contact' | null;
}

/**
 * Loader - Fetch AI calls for workspace
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const { workspaceId } = params;

  if (!workspaceId) {
    throw new Response('Workspace ID is required', { status: 400 });
  }

  // Fetch from API
  const apiUrl = process.env['API_URL'] || 'http://localhost:3000';
  const response = await fetch(
    `${apiUrl}/api/v1/crm/ai-calls?workspaceId=${workspaceId}&limit=100`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    console.error('[AI Calls Loader] Failed to fetch:', await response.text());
    return { aiCalls: [] };
  }

  const data = await response.json();
  return { aiCalls: data.aiCalls || [] };
}

export default function AiCallsListPage() {
  const workspaceId = useWorkspaceId();
  const { aiCalls: allAiCalls } = useLoaderData<typeof loader>();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');

  // Apply filters
  const aiCalls = allAiCalls.filter((call: AiCall) => {
    const matchesOutcome = outcomeFilter === 'all' || call.callOutcome === outcomeFilter;
    const matchesSentiment = sentimentFilter === 'all' || call.sentiment === sentimentFilter;
    const matchesDirection = directionFilter === 'all' || call.direction === directionFilter;
    return matchesOutcome && matchesSentiment && matchesDirection;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8" />
            AI Calls
          </h1>
          <p className="text-muted-foreground">
            View and analyze AI-powered voice calls
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/dashboard/${workspaceId}/crm/analytics/ai-calls`}>
              <BarChart2 className="mr-2 h-4 w-4" />
              Analytics
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/dashboard/${workspaceId}/crm/ai-call-scripts`}>
              <FileText className="mr-2 h-4 w-4" />
              Manage Scripts
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Direction Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Direction</label>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directions</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Outcome Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Outcome</label>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                  <SelectItem value="callback">Callback</SelectItem>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sentiment Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sentiment</label>
              <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiments</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Calls Grid */}
      {aiCalls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Phone className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">No AI calls yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  AI calls will appear here after you initiate calls from lead or contact pages.
                </p>
              </div>
              <div className="flex gap-2 mt-4">
                <Button asChild variant="outline">
                  <Link to={`/dashboard/${workspaceId}/crm/leads`}>
                    Go to Leads
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/dashboard/${workspaceId}/crm/contacts`}>
                    Go to Contacts
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiCalls.map((aiCall: AiCall) => (
            <AiCallCard
              key={aiCall.id}
              aiCall={aiCall}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}

      {/* Stats Summary */}
      {aiCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{aiCalls.length}</p>
                <p className="text-sm text-muted-foreground">Total Calls</p>
              </div>
              <div className="text-center p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {aiCalls.filter((c: AiCall) => c.direction === 'outbound' || !c.direction).length}
                </p>
                <p className="text-sm text-muted-foreground">Outbound</p>
              </div>
              <div className="text-center p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {aiCalls.filter((c: AiCall) => c.direction === 'inbound').length}
                </p>
                <p className="text-sm text-muted-foreground">Inbound</p>
              </div>
              <div className="text-center p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {aiCalls.filter((c: AiCall) => c.callOutcome === 'interested').length}
                </p>
                <p className="text-sm text-muted-foreground">Interested</p>
              </div>
              <div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {aiCalls.filter((c: AiCall) => c.callOutcome === 'callback').length}
                </p>
                <p className="text-sm text-muted-foreground">Callbacks</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">
                  {Math.round(
                    aiCalls.reduce((sum: number, c: AiCall) => sum + (c.audioSeconds || 0), 0) / 60
                  )}m
                </p>
                <p className="text-sm text-muted-foreground">Total Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
