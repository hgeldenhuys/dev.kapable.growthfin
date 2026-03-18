/**
 * Search Results
 * Display semantic search results with syntax highlighting
 */

import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ExternalLink, FileCode } from 'lucide-react';
import type { SemanticSearchResult } from '../../lib/api/intelligence';

interface SearchResultsProps {
  results: SemanticSearchResult[];
  isLoading: boolean;
  onOpenFile: (filePath: string, lineStart: number) => void;
}

const entityTypeColors: Record<string, string> = {
  function: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  class: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  interface: 'bg-green-500/10 text-green-500 border-green-500/20',
  type: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  variable: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  constant: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

export function SearchResults({
  results,
  isLoading,
  onOpenFile,
}: SearchResultsProps) {
  if (isLoading) {
    return (
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
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No results found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Try a different search query or rebuild your index
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Example queries:</p>
            <p className="font-mono bg-muted px-2 py-1 rounded inline-block">
              "authentication logic"
            </p>
            <p className="font-mono bg-muted px-2 py-1 rounded inline-block ml-2">
              "database connection handler"
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result, index) => (
        <Card key={`${result.filePath}-${result.lineStart}-${index}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    entityTypeColors[result.entityType.toLowerCase()] || ''
                  }
                >
                  {result.entityType}
                </Badge>
                <Badge variant="outline" className="bg-muted">
                  {(result.score * 100).toFixed(0)}% match
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenFile(result.filePath, result.lineStart)}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </Button>
            </div>

            <h3 className="text-lg font-semibold mb-2 font-mono">
              {result.entityName}
            </h3>

            <p className="text-sm text-muted-foreground mb-3">
              {result.summary}
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileCode className="h-3 w-3" />
                {result.filePath}
              </span>
              <span>
                Lines {result.lineStart}–{result.lineEnd}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
