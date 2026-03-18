/**
 * Memory List Widget
 * Shows recent memories with type badges
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Brain, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Memory } from '../../lib/api/intelligence';

interface MemoryListWidgetProps {
  memories: Memory[];
  workspaceId: string;
  isLoading: boolean;
}

const memoryTypeColors: Record<string, string> = {
  pattern: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  decision: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  preference: 'bg-green-500/10 text-green-500 border-green-500/20',
  fact: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

export function MemoryListWidget({
  memories,
  workspaceId,
  isLoading,
}: MemoryListWidgetProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Recent Memories
        </CardTitle>
        <Link
          to={`/dashboard/${workspaceId}/ai/intelligence/memory`}
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
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : memories.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No memories yet
          </div>
        ) : (
          <div className="space-y-2">
            {memories.slice(0, 5).map((memory) => (
              <div
                key={memory.id}
                className="flex items-start justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={memoryTypeColors[memory.type] || ''}
                    >
                      {memory.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(memory.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <div className="text-sm font-medium truncate">{memory.key}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {memory.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
