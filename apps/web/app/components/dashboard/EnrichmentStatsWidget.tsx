/**
 * EnrichmentStatsWidget Component
 * Dashboard widget showing enrichment statistics
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Sparkles, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface EnrichmentStats {
  total_enriched: number;
  success_rate: number;
  average_confidence: number;
  pending_count: number;
}

interface EnrichmentStatsWidgetProps {
  stats: EnrichmentStats | null;
  isLoading?: boolean;
  className?: string;
}

export function EnrichmentStatsWidget({
  stats,
  isLoading = false,
  className,
}: EnrichmentStatsWidgetProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Enrichment Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Enrichment Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No enrichment data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Enrichment Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Total Enriched</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_enriched}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Success Rate</span>
            </div>
            <p className="text-2xl font-bold">
              {Math.round(stats.success_rate * 100)}%
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">Avg Confidence</span>
            </div>
            <p className="text-2xl font-bold">
              {Math.round(stats.average_confidence * 100)}%
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold">{stats.pending_count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
