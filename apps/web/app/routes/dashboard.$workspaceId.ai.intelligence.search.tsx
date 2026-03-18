/**
 * Code Search Page
 * Ripgrep-based code search with real-time SSE results
 */

import { useState } from 'react';
import { useParams } from 'react-router';
import { SearchForm } from '../components/code-search/SearchForm';
import { SearchResults } from '../components/code-search/SearchResults';
import { useCodeSearch } from '../hooks/useCodeSearch';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Info, AlertCircle, Code2 } from 'lucide-react';

export default function CodeSearchPage() {
  const { workspaceId } = useParams();
  const [currentQuery, setCurrentQuery] = useState('');

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  const { search, cancel, results, isSearching, error, stats, progress } = useCodeSearch(workspaceId);

  const handleSearch = (params: any) => {
    setCurrentQuery(params.query);
    search(params);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Code2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Code Search</h1>
        </div>
        <p className="text-muted-foreground">
          Fast, ripgrep-powered code search across your workspace
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Search for code patterns, function names, or any text in your codebase. Use glob patterns
          to filter by file type. Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">⌘K</kbd> to focus search.
        </AlertDescription>
      </Alert>

      {/* Search Form */}
      <SearchForm
        onSearch={handleSearch}
        isSearching={isSearching}
        onCancel={cancel}
      />

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress Display */}
      {isSearching && progress && (
        <div className="text-sm text-muted-foreground">
          Scanned {progress.filesScanned} files...
        </div>
      )}

      {/* Results or Empty State */}
      {currentQuery ? (
        <SearchResults
          results={results}
          stats={stats}
          isSearching={isSearching}
          query={currentQuery}
        />
      ) : (
        <div className="text-center py-16 space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Code2 className="h-8 w-8 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Search your codebase</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Enter a search query to find functions, classes, or any text patterns in your code
            </p>
          </div>

          {/* Example Queries */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Example queries:</p>
            <div className="flex flex-wrap justify-center gap-2">
              <ExampleQuery
                text="AuthService"
                onClick={() => handleSearch({ query: 'AuthService' })}
              />
              <ExampleQuery
                text="TODO"
                onClick={() => handleSearch({ query: 'TODO' })}
              />
              <ExampleQuery
                text="export function"
                onClick={() => handleSearch({ query: 'export function' })}
              />
              <ExampleQuery
                text="async/await"
                onClick={() => handleSearch({ query: 'async' })}
              />
            </div>
          </div>

          {/* Tips */}
          <div className="max-w-md mx-auto text-left space-y-2 pt-4 border-t">
            <p className="text-sm font-medium">Tips:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Use quotes for exact phrase matching</li>
              <li>• Use glob patterns like <code className="px-1 py-0.5 bg-muted rounded text-xs">*.ts</code> to filter files</li>
              <li>• Enable case-sensitive search for precise matching</li>
              <li>• Add context lines to see surrounding code</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExampleQueryProps {
  text: string;
  onClick: () => void;
}

function ExampleQuery({ text, onClick }: ExampleQueryProps) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors font-mono"
    >
      {text}
    </button>
  );
}
