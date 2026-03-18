/**
 * Conversation Search Page
 * Search and explore past AI conversations
 */

import { useState } from 'react';
import { useParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  searchConversations,
  type ConversationSearchRequest,
  type ConversationSearchResult,
} from '../lib/api/intelligence';
import { ConversationSearchFilters } from '../components/intelligence/ConversationSearchFilters';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Search, MessageSquare, FileText, Tag, Calendar, ExternalLink } from 'lucide-react';

export default function ConversationSearchPage() {
  const { workspaceId } = useParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Partial<ConversationSearchRequest>>({});
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationSearchResult | null>(null);

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: (request: ConversationSearchRequest) =>
      searchConversations(workspaceId, request),
    onError: (error: Error) => {
      toast.error(`Search failed: ${error.message}`);
    },
  });

  const handleSearch = () => {
    const request: ConversationSearchRequest = {
      query: searchQuery || undefined,
      limit: 50,
      ...filters,
    };

    searchMutation.mutate(request);
  };

  const handleFiltersChange = (
    newFilters: Partial<ConversationSearchRequest>
  ) => {
    setFilters(newFilters);
    // Auto-search when filters change
    const request: ConversationSearchRequest = {
      query: searchQuery || undefined,
      limit: 50,
      ...newFilters,
    };
    searchMutation.mutate(request);
  };

  const results = searchMutation.data?.results || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Conversation Search</h1>
        <p className="text-muted-foreground">
          Find and explore past AI conversations
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversation summaries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={searchMutation.isPending}>
          {searchMutation.isPending ? 'Searching...' : 'Search'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <ConversationSearchFilters onFiltersChange={handleFiltersChange} />
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          {searchMutation.isPending ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-full bg-muted animate-pulse rounded" />
                      <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : results.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchMutation.isSuccess
                    ? 'No conversations found'
                    : 'Start searching'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchMutation.isSuccess
                    ? 'Try adjusting your search query or filters'
                    : 'Enter a search query or apply filters to find conversations'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Found {results.length} conversation
                {results.length !== 1 ? 's' : ''}
              </div>

              {results.map((conversation) => (
                <Card
                  key={conversation.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(conversation.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedConversation(conversation);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Summary */}
                      <p className="text-sm">{conversation.summary}</p>

                      {/* Topics */}
                      {conversation.topics.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          {conversation.topics.map((topic) => (
                            <Badge key={topic} variant="secondary" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Files */}
                      {conversation.filesDiscussed.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          {conversation.filesDiscussed.slice(0, 3).map((file) => (
                            <span
                              key={file}
                              className="font-mono bg-muted px-2 py-1 rounded"
                            >
                              {file}
                            </span>
                          ))}
                          {conversation.filesDiscussed.length > 3 && (
                            <span>+{conversation.filesDiscussed.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Conversation Detail Modal */}
      <Dialog
        open={!!selectedConversation}
        onOpenChange={(open) => !open && setSelectedConversation(null)}
      >
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Conversation Details</DialogTitle>
            <DialogDescription>
              {selectedConversation &&
                new Date(selectedConversation.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedConversation && (
            <div className="space-y-4">
              {/* Summary */}
              <div>
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedConversation.summary}
                </p>
              </div>

              {/* Topics */}
              {selectedConversation.topics.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Topics</h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedConversation.topics.map((topic) => (
                      <Badge key={topic} variant="secondary">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {selectedConversation.keywords.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Keywords</h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedConversation.keywords.map((keyword) => (
                      <Badge key={keyword} variant="outline">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Files Discussed */}
              {selectedConversation.filesDiscussed.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Files Discussed</h3>
                  <div className="space-y-1">
                    {selectedConversation.filesDiscussed.map((file) => (
                      <div
                        key={file}
                        className="text-sm font-mono bg-muted px-3 py-2 rounded"
                      >
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to original conversation (if applicable) */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // TODO: Navigate to original conversation
                    toast.info('Navigation to conversation not yet implemented');
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Original Conversation
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
