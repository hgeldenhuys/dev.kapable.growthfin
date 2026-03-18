/**
 * Campaign Analytics Dashboard
 * Aggregate campaign performance metrics, channel breakdown, top performers, and time series
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  BarChart3,
  Mail,
  MessageSquare,
  Phone,
  TrendingUp,
  Users,
  Target,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
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
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useCampaignAnalytics } from '~/hooks/useCampaignAnalytics';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-5 w-5" />,
  sms: <MessageSquare className="h-5 w-5" />,
  voice: <Phone className="h-5 w-5" />,
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Channel breakdown skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table skeletons */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function CampaignAnalyticsPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const [days, setDays] = useState<number>(30);

  const { data: analytics, isLoading, error } = useCampaignAnalytics(workspaceId, undefined, days);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Error loading analytics: {String(error)}</p>
        <Button variant="outline" onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const metrics = analytics?.metrics;
  const channelBreakdown = analytics?.channelBreakdown ?? [];
  const objectiveBreakdown = analytics?.objectiveBreakdown ?? [];
  const timeSeries = analytics?.timeSeries ?? [];
  const topPerformers = analytics?.topPerformers ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8" />
              Campaign Analytics
            </h1>
          </div>
          <p className="text-muted-foreground ml-12">
            Aggregate performance across all campaigns
          </p>
        </div>

        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Campaigns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics?.total ?? 0)}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                {metrics?.active ?? 0} active
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {metrics?.completed ?? 0} completed
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {metrics?.draft ?? 0} draft
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Sent / Delivered */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent / Delivered</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(metrics?.totalSent ?? 0)}{' '}
              <span className="text-base font-normal text-muted-foreground">
                / {formatNumber(metrics?.totalDelivered ?? 0)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercent(metrics?.deliveryRate ?? 0)} delivery rate
            </p>
          </CardContent>
        </Card>

        {/* Open Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(metrics?.openRate ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(metrics?.totalOpened ?? 0)} of {formatNumber(metrics?.totalDelivered ?? 0)} delivered
            </p>
          </CardContent>
        </Card>

        {/* Click Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(metrics?.clickRate ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(metrics?.totalClicked ?? 0)} of {formatNumber(metrics?.totalOpened ?? 0)} opened
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Channel Breakdown */}
      {channelBreakdown.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Channel Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {channelBreakdown.map((ch) => (
              <Card key={ch.channel}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      {CHANNEL_ICONS[ch.channel] ?? <Mail className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{ch.channel}</p>
                      <p className="text-2xl font-bold">{formatNumber(ch.count)}</p>
                      <p className="text-xs text-muted-foreground">campaigns</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Objective</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Clicked</TableHead>
                  <TableHead className="text-right">Open Rate</TableHead>
                  <TableHead className="text-right">Click Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPerformers.slice(0, 5).map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaign.id}`)
                    }
                  >
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">
                      {campaign.objective.replace('_', ' ')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          campaign.status === 'completed'
                            ? 'success'
                            : campaign.status === 'active'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(campaign.totalSent)}</TableCell>
                    <TableCell className="text-right">{formatNumber(campaign.totalOpened)}</TableCell>
                    <TableCell className="text-right">{formatNumber(campaign.totalClicked)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercent(campaign.openRate)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercent(campaign.clickRate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Objective Breakdown */}
      {objectiveBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance by Objective
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Objective</TableHead>
                  <TableHead className="text-right">Campaigns</TableHead>
                  <TableHead className="text-right">Total Sent</TableHead>
                  <TableHead className="text-right">Total Opened</TableHead>
                  <TableHead className="text-right">Total Clicked</TableHead>
                  <TableHead className="text-right">Avg Open Rate</TableHead>
                  <TableHead className="text-right">Avg Click Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objectiveBreakdown.map((obj) => (
                  <TableRow key={obj.objective}>
                    <TableCell className="font-medium capitalize">
                      {obj.objective.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(obj.count)}</TableCell>
                    <TableCell className="text-right">{formatNumber(obj.totalSent)}</TableCell>
                    <TableCell className="text-right">{formatNumber(obj.totalOpened)}</TableCell>
                    <TableCell className="text-right">{formatNumber(obj.totalClicked)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercent(obj.avgOpenRate)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercent(obj.avgClickRate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Time Series */}
      {timeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Activity Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Campaigns Created</TableHead>
                  <TableHead className="text-right">Recipients Added</TableHead>
                  <TableHead className="text-right">Messages Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeSeries.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">
                      {new Date(row.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.campaignsCreated)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.recipientsAdded)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.messagesSent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Execution Stats */}
      {analytics?.execution && analytics.execution.completedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Execution Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold">
                  {analytics.execution.avgExecutionTimeHours.toFixed(1)}h
                </p>
                <p className="text-xs text-muted-foreground">Avg execution time</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatNumber(analytics.execution.completedCount)}
                </p>
                <p className="text-xs text-muted-foreground">Completed campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
