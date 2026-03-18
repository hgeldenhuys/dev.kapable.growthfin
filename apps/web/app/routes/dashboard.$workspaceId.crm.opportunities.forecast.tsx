/**
 * Pipeline Forecast & Analytics Dashboard
 * Displays pipeline metrics by stage, revenue forecast, deal velocity,
 * win/loss analysis, and pipeline health indicators.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '~/components/ui/alert';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StageMetric {
  stage: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
  avgDealSize: number;
  avgProbability: number;
}

interface PipelineMetrics {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  totalDeals: number;
  winRate: number;
  wonCount: number;
  lostCount: number;
  totalClosedCount: number;
  avgDealSize: number;
  avgSalesCycleDays: number;
  stages: StageMetric[];
}

interface ForecastMonth {
  month: string;
  bestCase: number;
  expected: number;
  worstCase: number;
  dealsCount: number;
}

interface PipelineForecast {
  months: ForecastMonth[];
  totals: {
    bestCase: number;
    expected: number;
    worstCase: number;
    dealsCount: number;
  };
}

interface VelocityPeriod {
  deals: number;
  value: number;
  winRate: number;
  avgDealSize: number;
  avgCycleDays: number;
}

interface StageVelocity {
  stage: string;
  avgDaysInStage: number;
  dealsProcessed: number;
}

interface PipelineVelocity {
  current: VelocityPeriod;
  previous: VelocityPeriod;
  stageVelocity: StageVelocity[];
}

interface LostReason {
  reason: string;
  count: number;
  value: number;
}

interface WinLossBySource {
  source: string;
  won: number;
  lost: number;
  winRate: number;
  totalValue: number;
}

interface WinLossAnalysis {
  lostReasons: LostReason[];
  bySource: WinLossBySource[];
}

interface AgingBucket {
  label: string;
  count: number;
  value: number;
}

interface StaleDeal {
  id: string;
  name: string;
  amount: number;
  stage: string;
  daysSinceUpdate: number;
  isOverdue: boolean;
}

interface PipelineHealth {
  staleDealsCount: number;
  overdueDealsCount: number;
  aging: AgingBucket[];
  staleDeals: StaleDeal[];
}

// ---------------------------------------------------------------------------
// Inline Query Hooks
// ---------------------------------------------------------------------------

function usePipelineMetrics(workspaceId: string) {
  return useQuery<PipelineMetrics>({
    queryKey: ['pipeline', 'metrics', workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/crm/pipeline/metrics?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error('Failed to fetch pipeline metrics');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

function usePipelineForecast(workspaceId: string, months: number) {
  return useQuery<PipelineForecast>({
    queryKey: ['pipeline', 'forecast', workspaceId, months],
    queryFn: async () => {
      const res = await fetch(`/api/v1/crm/pipeline/forecast?workspaceId=${workspaceId}&months=${months}`);
      if (!res.ok) throw new Error('Failed to fetch pipeline forecast');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

function usePipelineVelocity(workspaceId: string, days: number) {
  return useQuery<PipelineVelocity>({
    queryKey: ['pipeline', 'velocity', workspaceId, days],
    queryFn: async () => {
      const res = await fetch(`/api/v1/crm/pipeline/velocity?workspaceId=${workspaceId}&days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch pipeline velocity');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

function usePipelineWinLoss(workspaceId: string, days: number) {
  return useQuery<WinLossAnalysis>({
    queryKey: ['pipeline', 'win-loss', workspaceId, days],
    queryFn: async () => {
      const res = await fetch(`/api/v1/crm/pipeline/win-loss?workspaceId=${workspaceId}&days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch win/loss analysis');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

function usePipelineHealth(workspaceId: string) {
  return useQuery<PipelineHealth>({
    queryKey: ['pipeline', 'health', workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/crm/pipeline/health?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error('Failed to fetch pipeline health');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>

      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChangeIndicator({ current, previous }: {
  current: number;
  previous: number;
}) {
  const change = percentChange(current, previous);
  const isPositive = change >= 0;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PipelineForecastPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const [days, setDays] = useState<number>(90);

  const { data: metrics, isLoading: metricsLoading, error: metricsError } = usePipelineMetrics(workspaceId);
  const { data: forecast, isLoading: forecastLoading } = usePipelineForecast(workspaceId, 6);
  const { data: velocity, isLoading: velocityLoading } = usePipelineVelocity(workspaceId, days);
  const { data: winLoss, isLoading: winLossLoading } = usePipelineWinLoss(workspaceId, days);
  const { data: health, isLoading: healthLoading } = usePipelineHealth(workspaceId);

  const isLoading = metricsLoading && forecastLoading && velocityLoading && winLossLoading && healthLoading;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (metricsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Error loading pipeline data: {String(metricsError)}</p>
        <Button variant="outline" onClick={() => navigate(`/dashboard/${workspaceId}/crm/opportunities`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Opportunities
        </Button>
      </div>
    );
  }

  const stages = metrics?.stages ?? [];
  const forecastMonths = forecast?.months ?? [];
  const forecastTotals = forecast?.totals;
  const lostReasons = winLoss?.lostReasons ?? [];
  const bySource = winLoss?.bySource ?? [];
  const staleDeals = health?.staleDeals ?? [];
  const agingBuckets = health?.aging ?? [];

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* 1. Header                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/dashboard/${workspaceId}/crm/opportunities`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8" />
              Pipeline Forecast &amp; Analytics
            </h1>
          </div>
          <p className="text-muted-foreground ml-12">
            Revenue forecasting, deal velocity, and pipeline health
          </p>
        </div>

        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 180 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. Pipeline Summary Cards                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.totalPipelineValue ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Weighted: {formatCurrency(metrics?.weightedPipelineValue ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(metrics?.winRate ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.wonCount ?? 0} won / {metrics?.totalClosedCount ?? 0} total closed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.avgDealSize ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(metrics?.totalDeals ?? 0)} open deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Sales Cycle</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.avgSalesCycleDays?.toFixed(0) ?? '0'} days
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From creation to close
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. Pipeline by Stage                                              */}
      {/* ----------------------------------------------------------------- */}
      {stages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Pipeline by Stage
            </CardTitle>
            <CardDescription>
              Breakdown of open deals across pipeline stages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">Weighted Value</TableHead>
                  <TableHead className="text-right">Avg Deal Size</TableHead>
                  <TableHead className="text-right">Avg Probability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((stage) => (
                  <TableRow key={stage.stage}>
                    <TableCell className="font-medium capitalize">
                      {stage.stage.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(stage.dealCount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stage.totalValue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stage.weightedValue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stage.avgDealSize)}</TableCell>
                    <TableCell className="text-right">{formatPercent(stage.avgProbability)}</TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(stages.reduce((s, r) => s + r.dealCount, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(stages.reduce((s, r) => s + r.totalValue, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(stages.reduce((s, r) => s + r.weightedValue, 0))}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. Revenue Forecast                                               */}
      {/* ----------------------------------------------------------------- */}
      {forecastMonths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue Forecast
            </CardTitle>
            <CardDescription>
              Projected revenue for the next 6 months based on pipeline data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Best Case</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Worst Case</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecastMonths.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell className="font-medium">
                      {new Date(month.month + '-01').toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">
                      {formatCurrency(month.bestCase)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(month.expected)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(month.worstCase)}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(month.dealsCount)}</TableCell>
                  </TableRow>
                ))}
                {/* Totals */}
                {forecastTotals && (
                  <TableRow className="border-t-2 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">
                      {formatCurrency(forecastTotals.bestCase)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(forecastTotals.expected)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(forecastTotals.worstCase)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(forecastTotals.dealsCount)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 5. Deal Velocity                                                  */}
      {/* ----------------------------------------------------------------- */}
      {velocity && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Deal Velocity</h2>

          {/* Current vs Previous period comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Deals Closed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(velocity.current.deals)}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    prev: {formatNumber(velocity.previous.deals)}
                  </span>
                  <ChangeIndicator current={velocity.current.deals} previous={velocity.previous.deals} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(velocity.current.value)}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    prev: {formatCurrency(velocity.previous.value)}
                  </span>
                  <ChangeIndicator current={velocity.current.value} previous={velocity.previous.value} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercent(velocity.current.winRate)}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    prev: {formatPercent(velocity.previous.winRate)}
                  </span>
                  <ChangeIndicator current={velocity.current.winRate} previous={velocity.previous.winRate} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(velocity.current.avgDealSize)}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    prev: {formatCurrency(velocity.previous.avgDealSize)}
                  </span>
                  <ChangeIndicator current={velocity.current.avgDealSize} previous={velocity.previous.avgDealSize} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Cycle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{velocity.current.avgCycleDays.toFixed(0)} days</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    prev: {velocity.previous.avgCycleDays.toFixed(0)} days
                  </span>
                  {/* For cycle days, lower is better so we invert the indicator */}
                  <ChangeIndicator current={velocity.previous.avgCycleDays} previous={velocity.current.avgCycleDays} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stage velocity table */}
          {velocity.stageVelocity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stage Velocity</CardTitle>
                <CardDescription>Average time deals spend in each stage</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Avg Days in Stage</TableHead>
                      <TableHead className="text-right">Deals Processed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {velocity.stageVelocity.map((sv) => (
                      <TableRow key={sv.stage}>
                        <TableCell className="font-medium capitalize">
                          {sv.stage.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="text-right">{sv.avgDaysInStage.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{formatNumber(sv.dealsProcessed)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 6. Win/Loss Analysis                                              */}
      {/* ----------------------------------------------------------------- */}
      {(lostReasons.length > 0 || bySource.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Win/Loss Analysis</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lost reasons breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Lost Reasons
                </CardTitle>
                <CardDescription>Why deals were lost in the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                {lostReasons.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No lost deal data available
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lostReasons.map((lr) => (
                        <TableRow key={lr.reason}>
                          <TableCell className="font-medium capitalize">
                            {lr.reason.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(lr.count)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(lr.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Win/Loss by source */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Win/Loss by Source
                </CardTitle>
                <CardDescription>Performance breakdown by lead source</CardDescription>
              </CardHeader>
              <CardContent>
                {bySource.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No source data available
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Lost</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bySource.map((src) => (
                        <TableRow key={src.source}>
                          <TableCell className="font-medium capitalize">
                            {src.source.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(src.won)}</TableCell>
                          <TableCell className="text-right">{formatNumber(src.lost)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPercent(src.winRate)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(src.totalValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 7. Pipeline Health                                                */}
      {/* ----------------------------------------------------------------- */}
      {health && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Pipeline Health</h2>

          {/* Alert cards for stale and overdue deals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Alert variant={health.staleDealsCount > 0 ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Stale Deals</AlertTitle>
              <AlertDescription>
                {health.staleDealsCount > 0
                  ? `${health.staleDealsCount} deal${health.staleDealsCount === 1 ? '' : 's'} with no activity in 14+ days`
                  : 'No stale deals detected'}
              </AlertDescription>
            </Alert>

            <Alert variant={health.overdueDealsCount > 0 ? 'destructive' : 'default'}>
              <Clock className="h-4 w-4" />
              <AlertTitle>Overdue Deals</AlertTitle>
              <AlertDescription>
                {health.overdueDealsCount > 0
                  ? `${health.overdueDealsCount} deal${health.overdueDealsCount === 1 ? '' : 's'} past their expected close date`
                  : 'No overdue deals detected'}
              </AlertDescription>
            </Alert>
          </div>

          {/* Aging distribution */}
          {agingBuckets.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {agingBuckets.map((bucket) => (
                <Card key={bucket.label}>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm font-medium text-muted-foreground">{bucket.label}</p>
                      <p className="text-2xl font-bold mt-1">{formatNumber(bucket.count)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(bucket.value)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Stale deals list */}
          {staleDeals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Stale Deals
                </CardTitle>
                <CardDescription>Deals that need attention</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal Name</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Days Since Update</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staleDeals.map((deal) => (
                      <TableRow
                        key={deal.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/dashboard/${workspaceId}/crm/opportunities/${deal.id}`)}
                      >
                        <TableCell className="font-medium">{deal.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(deal.amount)}</TableCell>
                        <TableCell className="capitalize">{deal.stage.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right">{deal.daysSinceUpdate}</TableCell>
                        <TableCell>
                          {deal.isOverdue ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : (
                            <Badge variant="secondary">Stale</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
