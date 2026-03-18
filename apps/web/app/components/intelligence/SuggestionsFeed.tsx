/**
 * Suggestions Feed Widget
 * Shows active suggestions with severity indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Lightbulb, ArrowRight, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { Link } from 'react-router';
import type { Suggestion } from '../../lib/api/intelligence';

interface SuggestionsFeedProps {
  suggestions: Suggestion[];
  workspaceId: string;
  isLoading: boolean;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  info: {
    icon: Info,
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
};

export function SuggestionsFeed({
  suggestions,
  workspaceId,
  isLoading,
}: SuggestionsFeedProps) {
  const activeSuggestions = suggestions.filter((s) => s.status === 'pending');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Active Suggestions
        </CardTitle>
        <Link
          to={`/dashboard/${workspaceId}/ai/intelligence/suggestions`}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : activeSuggestions.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No active suggestions
          </div>
        ) : (
          <div className="space-y-2">
            {activeSuggestions.slice(0, 5).map((suggestion) => {
              const config = severityConfig[suggestion.severity];
              const Icon = config.icon;

              return (
                <div
                  key={suggestion.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.className.split(' ').slice(-1)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={config.className}>
                        {suggestion.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {suggestion.type}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">{suggestion.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {suggestion.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
