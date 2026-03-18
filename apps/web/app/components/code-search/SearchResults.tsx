/**
 * Code Search Results Component
 * Display search results grouped by file
 */

import { useState, useMemo } from 'react';
import { FileText, ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { toast } from 'sonner';
import type { SearchResult, SearchStats } from '../../hooks/useCodeSearch';

interface SearchResultsProps {
  results: SearchResult[];
  stats: SearchStats | null;
  isSearching: boolean;
  query: string;
}

interface GroupedResult {
  filePath: string;
  matches: SearchResult[];
}

export function SearchResults({ results, stats, isSearching, query }: SearchResultsProps) {
  // Group results by file
  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();

    for (const result of results) {
      const existing = groups.get(result.filePath) || [];
      existing.push(result);
      groups.set(result.filePath, existing);
    }

    return Array.from(groups.entries()).map(([filePath, matches]) => ({
      filePath,
      matches: matches.sort((a, b) => a.lineNumber - b.lineNumber),
    }));
  }, [results]);

  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (filePath: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const openInEditor = (filePath: string, lineNumber: number) => {
    // VS Code deep link format: vscode://file/path:line
    const vscodeUrl = `vscode://file${filePath}:${lineNumber}`;
    window.open(vscodeUrl, '_blank');
    copyToClipboard(`${filePath}:${lineNumber}`, 'file path');
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => (
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        ))}
      </>
    );
  };

  // Loading state
  if (isSearching && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Searching codebase...</p>
      </div>
    );
  }

  // No results
  if (!isSearching && results.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <div>
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm text-muted-foreground">
            Try a different query or adjust your search filters
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      {stats && (
        <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-3">
          <div className="flex items-center gap-4">
            <span>
              Found <strong className="text-foreground">{stats.totalMatches}</strong> match
              {stats.totalMatches !== 1 ? 'es' : ''} in{' '}
              <strong className="text-foreground">{groupedResults.length}</strong> file
              {groupedResults.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs">({stats.executionTimeMs}ms)</span>
            {stats.truncated && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                (Results limited to {stats.totalMatches})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Searching indicator */}
      {isSearching && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          Searching...
        </div>
      )}

      {/* Results grouped by file */}
      <div className="space-y-3">
        {groupedResults.map((group) => (
          <FileResultGroup
            key={group.filePath}
            group={group}
            query={query}
            isCollapsed={collapsedFiles.has(group.filePath)}
            onToggle={() => toggleFile(group.filePath)}
            onCopy={copyToClipboard}
            onOpenInEditor={openInEditor}
            highlightMatch={highlightMatch}
          />
        ))}
      </div>
    </div>
  );
}

interface FileResultGroupProps {
  group: GroupedResult;
  query: string;
  isCollapsed: boolean;
  onToggle: () => void;
  onCopy: (text: string, label: string) => void;
  onOpenInEditor: (filePath: string, lineNumber: number) => void;
  highlightMatch: (text: string, query: string) => React.ReactNode;
}

function FileResultGroup({
  group,
  query,
  isCollapsed,
  onToggle,
  onCopy,
  onOpenInEditor,
  highlightMatch,
}: FileResultGroupProps) {
  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 flex-1 text-left hover:text-primary transition-colors group"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            )}
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <CardTitle className="text-sm font-mono">
                {group.filePath.replace(/^\/Users\/[^/]+\//, '~/')}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {group.matches.length} match{group.matches.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(group.filePath, 'file path')}
            className="h-8"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="px-4 pb-4 space-y-2">
          {group.matches.map((result, idx) => (
            <div
              key={`${result.lineNumber}-${idx}`}
              className="border rounded-md overflow-hidden hover:border-primary/50 transition-colors"
            >
              {/* Context Before */}
              {result.contextBefore && result.contextBefore.length > 0 && (
                <div className="bg-muted/30 text-xs font-mono">
                  {result.contextBefore.map((line, i) => (
                    <div key={i} className="px-3 py-1 text-muted-foreground border-b">
                      <span className="inline-block w-12 text-right mr-3 select-none">
                        {result.lineNumber - result.contextBefore!.length + i}
                      </span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Matching Line */}
              <div className="bg-background">
                <div className="flex items-start px-3 py-2 text-sm font-mono group">
                  <button
                    onClick={() => onOpenInEditor(group.filePath, result.lineNumber)}
                    className="flex-1 flex items-start text-left hover:text-primary transition-colors"
                  >
                    <span className="inline-block w-12 text-right mr-3 text-muted-foreground select-none">
                      {result.lineNumber}
                    </span>
                    <span className="flex-1 break-all">
                      {highlightMatch(result.lineContent, query)}
                    </span>
                  </button>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCopy(result.lineContent, 'line')}
                      className="h-6 px-2"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenInEditor(group.filePath, result.lineNumber)}
                      className="h-6 px-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Context After */}
              {result.contextAfter && result.contextAfter.length > 0 && (
                <div className="bg-muted/30 text-xs font-mono">
                  {result.contextAfter.map((line, i) => (
                    <div key={i} className="px-3 py-1 text-muted-foreground border-t">
                      <span className="inline-block w-12 text-right mr-3 select-none">
                        {result.lineNumber + i + 1}
                      </span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
