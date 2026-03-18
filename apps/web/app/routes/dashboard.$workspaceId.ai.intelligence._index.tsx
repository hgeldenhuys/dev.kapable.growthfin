/**
 * Intelligence Overview Dashboard
 * Main landing page for AI workspace intelligence features
 */

import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getIndexStatus,
  buildIndex,
  listMemories,
  listSuggestions,
  getContextBudget,
} from '../lib/api/intelligence';
import { IndexStatusCard } from '../components/intelligence/IndexStatusCard';
import { MemoryListWidget } from '../components/intelligence/MemoryListWidget';
import { SuggestionsFeed } from '../components/intelligence/SuggestionsFeed';
import { ContextBudgetMeter } from '../components/intelligence/ContextBudgetMeter';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Search, Brain, MessageSquare, Lightbulb } from 'lucide-react';
import { Link } from 'react-router';

export default function IntelligenceDashboard() {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  // Fetch index status
  const {
    data: indexStatus,
    isLoading: isLoadingIndex,
    refetch: refetchIndex,
  } = useQuery({
    queryKey: ['intelligence', 'index-status', workspaceId],
    queryFn: () => getIndexStatus(workspaceId),
    refetchInterval: 30000, // Refetch every 30s
  });

  // Fetch recent memories
  const { data: memoriesData, isLoading: isLoadingMemories } = useQuery({
    queryKey: ['intelligence', 'memories', workspaceId],
    queryFn: () => listMemories(workspaceId, { limit: 5 }),
    refetchInterval: 30000,
  });

  // Fetch active suggestions
  const { data: suggestionsData, isLoading: isLoadingSuggestions } = useQuery({
    queryKey: ['intelligence', 'suggestions', workspaceId],
    queryFn: () => listSuggestions(workspaceId, { status: 'pending', limit: 5 }),
    refetchInterval: 30000,
  });

  // TODO: Get active conversation ID from context/state
  // For now, we'll skip context budget as it requires a conversation ID
  const activeConversationId = null;

  const { data: contextBudget, isLoading: isLoadingContext } = useQuery({
    queryKey: ['intelligence', 'context-budget', workspaceId, activeConversationId],
    queryFn: () =>
      activeConversationId
        ? getContextBudget(workspaceId, activeConversationId)
        : Promise.resolve(null),
    enabled: !!activeConversationId,
    refetchInterval: 30000,
  });

  // Build index mutation
  const buildIndexMutation = useMutation({
    mutationFn: () => buildIndex(workspaceId, { incremental: false }),
    onSuccess: () => {
      toast.success('Index rebuild started');
      queryClient.invalidateQueries({
        queryKey: ['intelligence', 'index-status', workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to rebuild index: ${error.message}`);
    },
  });

  const handleRebuildIndex = () => {
    buildIndexMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workspace Intelligence</h1>
        <p className="text-muted-foreground">
          AI-powered insights and tools for your workspace
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link to={`/dashboard/${workspaceId}/ai/intelligence/search`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Semantic Search</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Search your codebase using natural language
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to={`/dashboard/${workspaceId}/ai/intelligence/memory`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Manager</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Manage learned patterns and decisions
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to={`/dashboard/${workspaceId}/ai/intelligence/conversations`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversation Search</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Find past conversations and context
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to={`/dashboard/${workspaceId}/ai/intelligence/suggestions`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suggestions</CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                View AI-powered improvement suggestions
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Dashboard Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IndexStatusCard
          status={indexStatus || null}
          isLoading={isLoadingIndex}
          onRefresh={() => refetchIndex()}
          onRebuild={handleRebuildIndex}
        />

        <ContextBudgetMeter
          budget={contextBudget || null}
          isLoading={isLoadingContext}
        />

        <MemoryListWidget
          memories={memoriesData?.memories || []}
          workspaceId={workspaceId}
          isLoading={isLoadingMemories}
        />

        <SuggestionsFeed
          suggestions={suggestionsData?.suggestions || []}
          workspaceId={workspaceId}
          isLoading={isLoadingSuggestions}
        />
      </div>

      {/* Getting Started Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started with Intelligence Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1. Build the Codebase Index</h3>
            <p className="text-sm text-muted-foreground">
              Click "Rebuild Index" above to index your codebase. This enables semantic search
              and allows the AI to understand your code structure.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2. Use Semantic Search</h3>
            <p className="text-sm text-muted-foreground">
              Navigate to the Semantic Search page to find code using natural language queries
              like "authentication logic" or "database connection handler".
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">3. Manage Memories</h3>
            <p className="text-sm text-muted-foreground">
              The AI learns patterns and decisions as you work. View and manage these
              memories to help the AI provide better assistance.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">4. Review Suggestions</h3>
            <p className="text-sm text-muted-foreground">
              Check the Suggestions page for AI-identified improvements like missing tests,
              incomplete documentation, or code quality issues.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
