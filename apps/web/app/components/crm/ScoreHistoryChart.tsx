/**
 * ScoreHistoryChart Component
 * Display 7-day score history trend as a line chart
 *
 * Shows score changes over time with:
 * - Line chart visualization
 * - Score change indicators
 * - Trigger event markers
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { useLeadScoreHistory } from '~/hooks/useLeadScoreHistory';
import { cn } from '~/lib/utils';

interface ScoreHistoryChartProps {
  leadId: string;
  workspaceId: string;
  days?: number;
  className?: string;
}

export function ScoreHistoryChart({
  leadId,
  workspaceId,
  days = 7,
  className,
}: ScoreHistoryChartProps) {
  const { data, isLoading, error } = useLeadScoreHistory({
    leadId,
    workspaceId,
    days,
  });

  // Process history data for chart
  const chartData = useMemo(() => {
    if (!data?.history || data.history.length === 0) {
      return [];
    }

    // Sort by date ascending
    const sorted = [...data.history].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return sorted.map((entry) => ({
      id: entry.id,
      score: entry.scoreAfter,
      delta: entry.scoreDelta,
      date: new Date(entry.createdAt),
      trigger: entry.triggerType,
      reason: entry.triggerReason,
    }));
  }, [data?.history]);

  // Calculate chart dimensions and coordinates
  const chartDimensions = useMemo(() => {
    if (chartData.length === 0) {
      return { width: 0, height: 0, points: '', minScore: 0, maxScore: 100 };
    }

    const width = 600;
    const height = 200;
    const padding = 20;

    const scores = chartData.map((d) => d.score);
    const minScore = Math.max(0, Math.min(...scores) - 10);
    const maxScore = Math.min(100, Math.max(...scores) + 10);
    const scoreRange = maxScore - minScore;

    // Calculate SVG path points
    const points = chartData
      .map((point, index) => {
        const x = padding + (index / (chartData.length - 1 || 1)) * (width - 2 * padding);
        const y =
          height -
          padding -
          ((point.score - minScore) / scoreRange) * (height - 2 * padding);
        return `${x},${y}`;
      })
      .join(' ');

    return { width, height, points, minScore, maxScore, padding };
  }, [chartData]);

  // Calculate overall trend
  const trend = useMemo(() => {
    if (chartData.length < 2) return null;

    const firstScore = chartData[0].score;
    const lastScore = chartData[chartData.length - 1].score;
    const change = lastScore - firstScore;

    return {
      change,
      percentage: ((change / firstScore) * 100).toFixed(1),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    };
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Score History (Last {days} days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Score History (Last {days} days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load score history</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Score History (Last {days} days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No score history available for this lead yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { width, height, points, minScore, maxScore, padding } = chartDimensions;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Score History (Last {days} days)
          </CardTitle>
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 text-sm font-medium',
                trend.direction === 'up' && 'text-green-600 dark:text-green-400',
                trend.direction === 'down' && 'text-red-600 dark:text-red-400',
                trend.direction === 'neutral' && 'text-muted-foreground'
              )}
            >
              {trend.direction === 'up' && <TrendingUp className="h-4 w-4" />}
              {trend.direction === 'down' && <TrendingDown className="h-4 w-4" />}
              {trend.direction === 'neutral' && <Minus className="h-4 w-4" />}
              <span>
                {trend.change > 0 && '+'}
                {trend.change} ({trend.percentage}%)
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart */}
          <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="border rounded-md bg-muted/10"
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((score) => {
              const y =
                height -
                padding -
                ((score - minScore) / (maxScore - minScore)) * (height - 2 * padding);
              return (
                <g key={score}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-muted-foreground/20"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding - 5}
                    y={y + 4}
                    textAnchor="end"
                    className="text-xs fill-muted-foreground"
                  >
                    {score}
                  </text>
                </g>
              );
            })}

            {/* Line chart */}
            <polyline
              points={points}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {chartData.map((point, index) => {
              const x = padding + (index / (chartData.length - 1 || 1)) * (width - 2 * padding);
              const y =
                height -
                padding -
                ((point.score - minScore) / (maxScore - minScore)) * (height - 2 * padding);

              return (
                <g key={point.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="hsl(var(--primary))"
                    className="cursor-pointer hover:r-7 transition-all"
                  >
                    <title>
                      {point.date.toLocaleDateString()}: {point.score}
                      {point.delta !== 0 && ` (${point.delta > 0 ? '+' : ''}${point.delta})`}
                    </title>
                  </circle>
                </g>
              );
            })}
          </svg>

          {/* Timeline of events */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Recent Changes</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {chartData
                .slice()
                .reverse()
                .slice(0, 5)
                .map((point) => (
                  <div
                    key={point.id}
                    className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {point.date.toLocaleDateString()}
                      </span>
                      {point.reason && (
                        <span className="text-muted-foreground">• {point.reason}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{point.score}</span>
                      {point.delta !== 0 && (
                        <span
                          className={cn(
                            'font-medium',
                            point.delta > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          )}
                        >
                          ({point.delta > 0 && '+'}
                          {point.delta})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
