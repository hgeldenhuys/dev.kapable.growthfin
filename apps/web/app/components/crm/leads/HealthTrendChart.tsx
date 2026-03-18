/**
 * HealthTrendChart Component
 * Line chart showing 30-day health score trend
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useHealthHistory, getTrendDirection } from '~/hooks/useHealthScore';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface HealthTrendChartProps {
  leadId: string;
  workspaceId: string;
  days?: number;
}

export function HealthTrendChart({ leadId, workspaceId, days = 30 }: HealthTrendChartProps) {
  const { data: history, isLoading, error } = useHealthHistory(leadId, workspaceId, days);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">Failed to load health trend</p>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Not enough data to show trend. Health score needs multiple calculations.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Format data for chart
  const chartData = history.map((point) => ({
    date: new Date(point.calculated_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    score: point.health_score,
    status: point.health_status,
  }));

  // Determine trend
  const trend = getTrendDirection(history);
  const trendConfig = {
    up: {
      icon: TrendingUp,
      label: 'Improving',
      color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900',
    },
    down: {
      icon: TrendingDown,
      label: 'Declining',
      color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900',
    },
    stable: {
      icon: Minus,
      label: 'Stable',
      color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900',
    },
  };

  const currentTrend = trendConfig[trend];
  const TrendIcon = currentTrend.icon;

  // Calculate average
  const avgScore = Math.round(
    history.reduce((sum, point) => sum + point.health_score, 0) / history.length
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{days}-Day Health Trend</span>
          <Badge className={currentTrend.color}>
            <TrendIcon className="h-3 w-3 mr-1" />
            {currentTrend.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart */}
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />

              {/* Reference lines for thresholds */}
              <ReferenceLine
                y={76}
                stroke="hsl(var(--green-600))"
                strokeDasharray="3 3"
                label={{ value: 'Excellent', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              <ReferenceLine
                y={51}
                stroke="hsl(var(--blue-600))"
                strokeDasharray="3 3"
                label={{ value: 'Healthy', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              <ReferenceLine
                y={26}
                stroke="hsl(var(--orange-600))"
                strokeDasharray="3 3"
                label={{ value: 'At Risk', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />

              {/* Actual line */}
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-lg font-bold">{history[history.length - 1].health_score}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-lg font-bold">{avgScore}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Change</p>
              <p
                className={`text-lg font-bold ${
                  trend === 'up'
                    ? 'text-green-600 dark:text-green-400'
                    : trend === 'down'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-blue-600 dark:text-blue-400'
                }`}
              >
                {trend === 'up' && '+'}
                {history.length >= 2
                  ? history[history.length - 1].health_score - history[0].health_score
                  : 0}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
