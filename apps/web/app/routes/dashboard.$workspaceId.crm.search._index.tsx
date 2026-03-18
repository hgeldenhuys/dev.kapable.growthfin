/**
 * Global Search Route
 * Search across all CRM entities
 */

import { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { SearchResultCard } from '~/components/crm/SearchResultCard';
import { useGlobalSearch } from '~/hooks/useSearch';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import type { SearchFilters } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function SearchPage() {
  const workspaceId = useWorkspaceId();
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    entityTypes: [],
  });

  const { data: results, isLoading } = useGlobalSearch(searchQuery, workspaceId, filters);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced auto-search on input change
  useEffect(() => {
    if (query.length >= 2) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchQuery(query);
      }, 400);
    } else if (query.length === 0) {
      setSearchQuery('');
    }
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length >= 2) {
      clearTimeout(debounceRef.current);
      setSearchQuery(query);
    }
  };

  const handleEntityTypeToggle = (entityType: 'lead' | 'contact' | 'account' | 'opportunity') => {
    setFilters((prev) => {
      const entityTypes = prev.entityTypes || [];
      const isSelected = entityTypes.includes(entityType);

      return {
        ...prev,
        entityTypes: isSelected
          ? entityTypes.filter((t) => t !== entityType)
          : [...entityTypes, entityType],
      };
    });
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
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Search CRM</h1>
        <p className="text-muted-foreground">
          Search across leads, contacts, accounts, and opportunities
        </p>
      </div>

      {/* Search Input */}
      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Enter search query (minimum 2 characters)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={query.length < 2}>
                Search
              </Button>
            </div>

            {/* Entity Type Filters */}
            <div className="space-y-2">
              <Label>Filter by Entity Type</Label>
              <div className="flex flex-wrap gap-4">
                {(['lead', 'contact', 'account', 'opportunity'] as const).map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`filter-${type}`}
                      checked={filters.entityTypes?.includes(type)}
                      onCheckedChange={() => handleEntityTypeToggle(type)}
                    />
                    <Label
                      htmlFor={`filter-${type}`}
                      className="capitalize cursor-pointer"
                    >
                      {type === 'opportunity' ? 'Opportunities' : `${type}s`}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {searchQuery && (
        <div className="space-y-4">
          {isLoading && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Searching...</p>
              </CardContent>
            </Card>
          )}

          {!isLoading && results && results.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No results found for "{searchQuery}"
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try adjusting your search query or filters
                </p>
              </CardContent>
            </Card>
          )}

          {!isLoading && groupedResults && Object.keys(groupedResults).length > 0 && (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                Found {results?.length} result{results?.length !== 1 ? 's' : ''} for "
                {searchQuery}"
              </div>

              {Object.entries(groupedResults).map(([entityType, entityResults]) => (
                <Card key={entityType}>
                  <CardHeader>
                    <CardTitle className="capitalize">
                      {entityType === 'opportunity' ? 'Opportunities' : `${entityType}s`} ({entityResults.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {entityResults.map((result, index) => (
                      <SearchResultCard key={index} result={result} />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!searchQuery && (
        <Card>
          <CardContent className="py-12 text-center">
            <SearchIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Enter a search query to find leads, contacts, accounts, and opportunities
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Search by name, email, company, or any other field
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
