/**
 * Index Status Card
 * Displays indexing status, entity count, and last indexed time
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { RefreshCw, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import type { IndexStatus } from '../../lib/api/intelligence';

interface IndexStatusCardProps {
  status: IndexStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
  onRebuild: () => void;
}

export function IndexStatusCard({
  status,
  isLoading,
  onRefresh,
  onRebuild,
}: IndexStatusCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4" />
          Codebase Index
        </CardTitle>
        <div className="flex items-center gap-2">
          {status?.isIndexing && (
            <Badge variant="outline" className="gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Indexing
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status && !isLoading ? (
          <div className="text-sm text-muted-foreground">
            No index found
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{status?.totalFiles || 0}</div>
                <p className="text-xs text-muted-foreground">Total Files</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{status?.indexedEntities || 0}</div>
                <p className="text-xs text-muted-foreground">Entities Indexed</p>
              </div>
            </div>

            {status?.lastIndexedAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Last indexed: {new Date(status.lastIndexedAt).toLocaleString()}
              </div>
            )}

            {!status?.lastIndexedAt && !status?.isIndexing && (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" />
                Index not yet built
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={onRebuild}
              disabled={status?.isIndexing || isLoading}
            >
              {status?.isIndexing ? 'Indexing...' : 'Rebuild Index'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
