/**
 * GlobalSearchInput Component
 * Search input with dropdown results
 */

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { SearchResultCard } from './SearchResultCard';
import { useGlobalSearch } from '~/hooks/useSearch';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import type { SearchFilters } from '~/types/crm';
import { cn } from '~/lib/utils';

interface GlobalSearchInputProps {
  filters?: SearchFilters;
  onResultClick?: () => void;
  className?: string;
}

export function GlobalSearchInput({ filters, onResultClick, className }: GlobalSearchInputProps) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const workspaceId = useWorkspaceId();

  const { data: results, isLoading } = useGlobalSearch(query, workspaceId, filters);

  const handleClear = () => {
    setQuery('');
    setShowResults(false);
  };

  const handleResultClick = () => {
    setShowResults(false);
    setQuery('');
    onResultClick?.();
  };

  // Group results by entity type
  const groupedResults = results?.reduce((acc, result) => {
    if (!acc[result.entityType]) {
      acc[result.entityType] = [];
    }
    acc[result.entityType].push(result);
    return acc;
  }, {} as Record<string, typeof results>);

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search leads, contacts, accounts, opportunities..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && query.length >= 2 && (
        <Card className="absolute top-full mt-2 w-full z-50 max-h-96 overflow-auto">
          <CardContent className="p-4">
            {isLoading && (
              <div className="text-center text-sm text-muted-foreground py-4">
                Searching...
              </div>
            )}

            {!isLoading && results && results.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">
                No results found for "{query}"
              </div>
            )}

            {!isLoading && groupedResults && (
              <div className="space-y-4">
                {Object.entries(groupedResults).map(([entityType, entityResults]) => (
                  <div key={entityType}>
                    <h3 className="text-sm font-semibold capitalize mb-2">
                      {entityType}s ({entityResults.length})
                    </h3>
                    <div className="space-y-2">
                      {entityResults.map((result, index) => (
                        <SearchResultCard
                          key={index}
                          result={result}
                          onClick={handleResultClick}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
