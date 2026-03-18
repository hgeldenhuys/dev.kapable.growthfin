/**
 * Semantic Search Bar
 * Natural language search input with debouncing
 */

import { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Search, Loader2 } from 'lucide-react';

interface SemanticSearchBarProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  placeholder?: string;
}

export function SemanticSearchBar({
  onSearch,
  isSearching,
  placeholder = 'Search your codebase with natural language...',
}: SemanticSearchBarProps) {
  const [query, setQuery] = useState('');

  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        onSearch(query.trim());
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-10 pr-10"
      />
      {isSearching && (
        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
