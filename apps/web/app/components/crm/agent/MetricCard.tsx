/**
 * MetricCard Component
 * Display performance metrics with progress bars and comparison badges
 */

import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
  goal?: {
    current: number;
    target: number;
    label: string;
  };
  teamComparison?: {
    rank: number;
    total: number;
    label: string;
  };
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  goal,
  teamComparison
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.direction === 'up') return <TrendingUp className="h-3.5 w-3.5" />;
    if (trend.direction === 'down') return <TrendingDown className="h-3.5 w-3.5" />;
    return <Minus className="h-3.5 w-3.5" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.direction === 'up') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (trend.direction === 'down') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getGoalProgress = () => {
    if (!goal) return 0;
    return Math.min((goal.current / goal.target) * 100, 100);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Main Value */}
          <div className="text-2xl font-bold">{value}</div>

          {/* Trend Badge */}
          {trend && (
            <Badge variant="outline" className={`${getTrendColor()} flex items-center gap-1 w-fit`}>
              {getTrendIcon()}
              <span className="text-xs font-medium">
                {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
              </span>
            </Badge>
          )}

          {/* Goal Progress */}
          {goal && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{goal.label}</span>
                <span className="font-medium">
                  {goal.current}/{goal.target}
                </span>
              </div>
              <Progress value={getGoalProgress()} className="h-2" />
            </div>
          )}

          {/* Team Comparison */}
          {teamComparison && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                #{teamComparison.rank} of {teamComparison.total}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {teamComparison.label}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
