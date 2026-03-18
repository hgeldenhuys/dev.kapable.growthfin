/**
 * AI Analytics Dashboard Component
 * Main container component for analytics with all charts and metrics
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { ToolUsageChart } from './ToolUsageChart';
import { CostTrendChart } from './CostTrendChart';
import { PerformanceMetrics } from './PerformanceMetrics';
import { LiveActivityFeed } from './LiveActivityFeed';
import {
  useToolUsageStats,
  useCostAnalytics,
  usePerformanceMetrics,
  type DateRange,
} from '~/hooks/useAIAnalytics';
import { subDays, format } from 'date-fns';
import { BarChart3, DollarSign, Zap, Activity } from 'lucide-react';

interface AIAnalyticsDashboardProps {
  workspaceId: string;
}

type DateRangePreset = '7d' | '30d' | '90d';

const DATE_RANGE_DAYS: Record<DateRangePreset, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function getDateRange(preset: DateRangePreset): DateRange {
  const end = new Date().toISOString();
  const start = subDays(new Date(), DATE_RANGE_DAYS[preset]).toISOString();
  return { start, end };
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-bold mt-2">{value}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AIAnalyticsDashboard({ workspaceId }: AIAnalyticsDashboardProps) {
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('30d');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRange(dateRangePreset));

  // Update date range when preset changes
  useEffect(() => {
    setDateRange(getDateRange(dateRangePreset));
  }, [dateRangePreset]);

  // Fetch all analytics data
  const {
    data: toolUsageData,
    isLoading: toolUsageLoading,
    error: toolUsageError,
  } = useToolUsageStats(workspaceId, dateRange);

  const {
    data: costData,
    isLoading: costLoading,
    error: costError,
  } = useCostAnalytics(workspaceId, 'day', dateRange);

  const {
    data: performanceData,
    isLoading: performanceLoading,
    error: performanceError,
  } = usePerformanceMetrics(workspaceId);

  const isLoading = toolUsageLoading || costLoading || performanceLoading;
  const hasError = toolUsageError || costError || performanceError;

  // Calculate summary metrics
  const totalInvocations = toolUsageData?.stats.reduce(
    (sum, tool) => sum + tool.invocations,
    0
  ) ?? 0;

  const totalErrors = toolUsageData?.stats.reduce(
    (sum, tool) => sum + tool.errorCount,
    0
  ) ?? 0;

  const avgSuccessRate = toolUsageData?.stats.length
    ? (
        toolUsageData.stats.reduce((sum, tool) => sum + tool.successRate, 0) /
        toolUsageData.stats.length
      ).toFixed(1)
    : '0.0';

  const avgLatency = performanceData?.metrics.length
    ? (
        performanceData.metrics.reduce((sum, m) => sum + m.latency.avg, 0) /
        performanceData.metrics.length
      ).toFixed(0)
    : '0';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Tool usage, performance, and cost insights
          </p>
        </div>
        <Select
          value={dateRangePreset}
          onValueChange={(v: DateRangePreset) => setDateRangePreset(v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range Display */}
      <div className="text-sm text-muted-foreground">
        Showing data from {format(new Date(dateRange.start!), 'MMM d, yyyy')} to{' '}
        {format(new Date(dateRange.end!), 'MMM d, yyyy')}
      </div>

      {/* Error State */}
      {hasError && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive">
              Error loading analytics: {String(toolUsageError || costError || performanceError)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading analytics...</p>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Content */}
      {!isLoading && !hasError && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Invocations"
              value={totalInvocations.toLocaleString()}
              subtitle={`${totalErrors} errors`}
              icon={<BarChart3 className="h-6 w-6 text-primary" />}
            />
            <KPICard
              title="Success Rate"
              value={`${avgSuccessRate}%`}
              subtitle={`${toolUsageData?.stats.length ?? 0} tools`}
              icon={<Activity className="h-6 w-6 text-green-600" />}
            />
            <KPICard
              title="Total Cost"
              value={`$${costData?.summary.totalCost.toFixed(2) ?? '0.00'}`}
              subtitle={`${DATE_RANGE_DAYS[dateRangePreset]} days`}
              icon={<DollarSign className="h-6 w-6 text-purple-600" />}
            />
            <KPICard
              title="Avg Latency"
              value={`${avgLatency}ms`}
              subtitle={`Across ${performanceData?.metrics.length ?? 0} tools`}
              icon={<Zap className="h-6 w-6 text-yellow-600" />}
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ToolUsageChart
              tools={toolUsageData?.stats ?? []}
              isLoading={toolUsageLoading}
            />
            <CostTrendChart
              breakdown={costData?.breakdown ?? []}
              totalCost={costData?.summary.totalCost ?? 0}
              isLoading={costLoading}
            />
          </div>

          {/* Performance Metrics */}
          <PerformanceMetrics
            metrics={performanceData?.metrics ?? []}
            isLoading={performanceLoading}
          />

          {/* Live Activity Feed */}
          <LiveActivityFeed workspaceId={workspaceId} />
        </>
      )}
    </div>
  );
}
