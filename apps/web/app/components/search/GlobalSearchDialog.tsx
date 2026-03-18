/**
 * GlobalSearchDialog Component (Phase O)
 * Cmd-K accessible global search dialog
 *
 * Features:
 * - Full-text search across leads, contacts, and transcripts
 * - Type filtering
 * - Keyboard navigation
 * - Result highlighting
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '~/components/ui/command';
import { Badge } from '~/components/ui/badge';
import { User, Building, Phone, Mail, FileText, Search, Loader2 } from 'lucide-react';
import { useFullTextSearch, type SearchResultType, type FullTextSearchResult } from '~/hooks/useSearch';
import { cn } from '~/lib/utils';

export interface GlobalSearchDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Result type icon mapping
const resultTypeIcons: Record<SearchResultType, React.ElementType> = {
  lead: User,
  contact: Building,
  transcript: FileText,
};

// Result type labels
const resultTypeLabels: Record<SearchResultType, string> = {
  lead: 'Lead',
  contact: 'Contact',
  transcript: 'Transcript',
};

// Result type colors
const resultTypeColors: Record<SearchResultType, string> = {
  lead: 'bg-blue-100 text-blue-800',
  contact: 'bg-green-100 text-green-800',
  transcript: 'bg-purple-100 text-purple-800',
};

export function GlobalSearchDialog({
  workspaceId,
  open,
  onOpenChange,
}: GlobalSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<SearchResultType[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Search results
  const { data: searchData, isLoading } = useFullTextSearch(query, workspaceId, {
    types: selectedTypes.length > 0 ? selectedTypes : undefined,
    enabled: open,
  });

  const results = searchData?.results ?? [];

  // Group results by type (with null safety)
  const groupedResults = results.reduce(
    (acc, result) => {
      if (!result?.type || !result?.id) return acc;
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<SearchResultType, FullTextSearchResult[]>
  );

  // Handle keyboard shortcut (Cmd-K / Ctrl-K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  // Clear query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedTypes([]);
    }
  }, [open]);

  // Navigate to result
  const handleSelect = useCallback(
    (result: FullTextSearchResult) => {
      onOpenChange(false);

      switch (result.type) {
        case 'lead':
          navigate(`/dashboard/${workspaceId}/crm/leads/${result.id}`);
          break;
        case 'contact':
          navigate(`/dashboard/${workspaceId}/crm/contacts/${result.id}`);
          break;
        case 'transcript':
          // Navigate to AI call detail (use metadata for leadId/contactId)
          navigate(`/dashboard/${workspaceId}/crm/ai-calls/${result.id}`);
          break;
      }
    },
    [navigate, workspaceId, onOpenChange]
  );

  // Toggle type filter
  const toggleType = (type: SearchResultType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Render highlighted text
  const renderHighlight = (html: string | undefined) => {
    if (!html) return null;
    return (
      <p
        className="mt-1 text-xs text-muted-foreground line-clamp-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        ref={inputRef}
        placeholder="Search leads, contacts, transcripts..."
        value={query}
        onValueChange={setQuery}
      />

      {/* Type Filters */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="text-xs text-muted-foreground">Filter:</span>
        {(['lead', 'contact', 'transcript'] as SearchResultType[]).map((type) => (
          <Badge
            key={type}
            variant={selectedTypes.includes(type) ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer text-xs',
              selectedTypes.includes(type) && resultTypeColors[type]
            )}
            onClick={() => toggleType(type)}
          >
            {resultTypeLabels[type]}s
          </Badge>
        ))}
      </div>

      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
          </div>
        )}

        {!isLoading && query.length >= 2 && results.length === 0 && (
          <CommandEmpty>
            <div className="flex flex-col items-center py-6">
              <Search className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No results found for "{query}"
              </p>
              <p className="text-xs text-muted-foreground">
                Try a different search term
              </p>
            </div>
          </CommandEmpty>
        )}

        {!isLoading && query.length < 2 && (
          <div className="flex flex-col items-center py-6">
            <Search className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Type at least 2 characters to search
            </p>
          </div>
        )}

        {/* Leads */}
        {groupedResults.lead && groupedResults.lead.length > 0 && (
          <>
            <CommandGroup heading="Leads">
              {groupedResults.lead.map((result) => {
                const Icon = resultTypeIcons[result.type] || Search;
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    value={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="cursor-pointer"
                  >
                    <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                      <Icon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.title}</span>
                        {result.metadata?.status && (
                          <Badge variant="outline" className="text-xs">
                            {result.metadata.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {result.metadata?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {result.metadata.email}
                          </span>
                        )}
                        {result.metadata?.company && (
                          <span>• {result.metadata.company}</span>
                        )}
                      </div>
                      {renderHighlight(result.highlight)}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Contacts */}
        {groupedResults.contact && groupedResults.contact.length > 0 && (
          <>
            <CommandGroup heading="Contacts">
              {groupedResults.contact.map((result) => {
                const Icon = resultTypeIcons[result.type] || Search;
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    value={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="cursor-pointer"
                  >
                    <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                      <Icon className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-medium">{result.title}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {result.metadata?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {result.metadata.email}
                          </span>
                        )}
                        {result.metadata?.department && (
                          <span>• {result.metadata.department}</span>
                        )}
                      </div>
                      {renderHighlight(result.highlight)}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Transcripts */}
        {groupedResults.transcript && groupedResults.transcript.length > 0 && (
          <CommandGroup heading="Call Transcripts">
            {groupedResults.transcript.map((result) => {
              const Icon = resultTypeIcons[result.type] || Search;
              return (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  value={`${result.type}-${result.id}`}
                  onSelect={() => handleSelect(result)}
                  className="cursor-pointer"
                >
                  <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                    <Icon className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.title}</span>
                      {result.metadata?.outcome && (
                        <Badge variant="outline" className="text-xs">
                          {result.metadata.outcome}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {result.subtitle}
                    </div>
                    {renderHighlight(result.highlight)}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer */}
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="mr-4">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↑↓</kbd> navigate
        </span>
        <span className="mr-4">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↵</kbd> select
        </span>
        <span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">esc</kbd> close
        </span>
      </div>
    </CommandDialog>
  );
}
