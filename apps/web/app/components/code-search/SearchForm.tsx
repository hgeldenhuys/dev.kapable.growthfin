/**
 * Code Search Form Component
 * Search input with optional filters
 */

import { useState, useEffect } from 'react';
import { Search, X, Settings2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import type { SearchParams } from '../../hooks/useCodeSearch';

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isSearching: boolean;
  onCancel?: () => void;
}

export function SearchForm({ onSearch, isSearching, onCancel }: SearchFormProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [filePattern, setFilePattern] = useState('*.{ts,tsx,js,jsx,md,json,yaml,yml}');
  const [contextLines, setContextLines] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (query.trim().length === 0) {
      return;
    }

    if (query.length > 500) {
      return;
    }

    onSearch({
      query: query.trim(),
      caseSensitive,
      filePattern: filePattern.trim() || undefined,
      contextLines,
    });
  };

  const handleClear = () => {
    setQuery('');
    setCaseSensitive(false);
    setFilePattern('*.{ts,tsx,js,jsx,md,json,yaml,yml}');
    setContextLines(0);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('code-search-input')?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="code-search-input"
            type="text"
            placeholder="Search code... (⌘K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSearching}
            className="pl-9 pr-9"
            maxLength={500}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={isSearching}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isSearching ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={!onCancel}
          >
            Cancel
          </Button>
        ) : (
          <Button type="submit" disabled={query.trim().length === 0 || query.length > 500}>
            Search
          </Button>
        )}
      </div>

      {query.length > 500 && (
        <p className="text-sm text-destructive">
          Query too long ({query.length}/500 characters)
        </p>
      )}

      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide' : 'Show'} search options
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 pt-4 border rounded-lg p-4">
          {/* Case Sensitive */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="case-sensitive"
              checked={caseSensitive}
              onCheckedChange={(checked) => setCaseSensitive(checked as boolean)}
              disabled={isSearching}
            />
            <Label
              htmlFor="case-sensitive"
              className="text-sm font-normal cursor-pointer"
            >
              Case sensitive
            </Label>
          </div>

          {/* File Pattern */}
          <div className="space-y-2">
            <Label htmlFor="file-pattern" className="text-sm">
              File pattern (glob)
            </Label>
            <Input
              id="file-pattern"
              type="text"
              placeholder="*.{'{ts,tsx,js,jsx}'}"
              value={filePattern}
              onChange={(e) => setFilePattern(e.target.value)}
              disabled={isSearching}
            />
            <p className="text-xs text-muted-foreground">
              Examples: *.ts, *.{'{ts,tsx}'}, **/*.md
            </p>
          </div>

          {/* Context Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="context-lines" className="text-sm">
                Context lines: {contextLines}
              </Label>
            </div>
            <Slider
              id="context-lines"
              min={0}
              max={5}
              step={1}
              value={[contextLines]}
              onValueChange={(value) => setContextLines(value[0])}
              disabled={isSearching}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Show {contextLines} line{contextLines !== 1 ? 's' : ''} before and after each match
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </form>
  );
}
