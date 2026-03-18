/**
 * Analytics Dashboard Route
 * Comprehensive analytics for Campaigns and Research
 */

import { useState, useMemo } from 'react';
import {
  Download,
  Megaphone,
  Search,
  CheckCircle2,
  Clock,
  TrendingUp,
  Target,
  Activity as ActivityIcon,
  Users,
  Send,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { KPICard } from '~/components/crm/KPICard';
import { CampaignCharts } from '~/components/analytics/CampaignCharts';
import { ResearchCharts } from '~/components/analytics/ResearchCharts';
import { ActivityTimeline } from '~/components/analytics/ActivityTimeline';
import { CampaignFunnelChart } from '~/components/crm/analytics/CampaignFunnelChart';
import { ChannelPerformanceTable } from '~/components/crm/analytics/ChannelPerformanceTable';
import { CostROICard } from '~/components/crm/analytics/CostROICard';
import { useCampaignAnalytics } from '~/hooks/useCampaignAnalytics';
import { useResearchAnalytics } from '~/hooks/useResearchAnalytics';
import { useActivityTimeline } from '~/hooks/useActivityTimeline';
import { useCampaignFunnel } from '~/hooks/useCampaignFunnel';
import { useChannelPerformance } from '~/hooks/useChannelPerformance';
import { useCampaignCostROI } from '~/hooks/useCampaignCostROI';
import { useCampaigns } from '~/hooks/useCampaigns';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { ExportDialog } from '~/components/crm/analytics/ExportDialog';
import { useAnalyticsExport } from '~/hooks/useAnalyticsExport';
import { useAnalyticsMetricsStream } from '~/hooks/useAnalyticsMetricsStream';
import { subDays, format } from 'date-fns';
import type { DateRange } from '~/types/crm';
import type { DateRangeFilter } from '~/hooks/useChannelPerformance';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

type DateRangePreset = '7d' | '30d' | '90d' | '1y';

const DATE_RANGE_DAYS: Record<DateRangePreset, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

export default function AnalyticsPage() {
  const workspaceId = useWorkspaceId();
  const { initiateExport, pollExportStatus } = useAnalyticsExport(workspaceId);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('30d');
  const [channelDateRange, setChannelDateRange] = useState<DateRangeFilter>('30d');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  const days = DATE_RANGE_DAYS[dateRangePreset];

  // Memoize date range to prevent infinite re-renders
  // Only recalculate when dateRangePreset changes, not on every render
  const dateRange = useMemo(() => {
    const to = new Date();
    const from = subDays(to, DATE_RANGE_DAYS[dateRangePreset]);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }, [dateRangePreset]);

  // Fetch analytics data
  const {
    data: campaignData,
    isLoading: campaignLoading,
    error: campaignError,
  } = useCampaignAnalytics(workspaceId, dateRange, days);

  const {
    data: researchData,
    isLoading: researchLoading,
    error: researchError,
  } = useResearchAnalytics(workspaceId, dateRange, days);

  const {
    data: activities = [],
    isLoading: activityLoading,
  } = useActivityTimeline(workspaceId, 10);

  // Fetch campaigns for funnel selector
  const { data: campaigns = [] } = useCampaigns({ workspaceId });

  // Fetch funnel data for selected campaign
  const {
    data: funnelData,
    isLoading: funnelLoading,
  } = useCampaignFunnel(workspaceId, selectedCampaignId);

  // Fetch channel performance data
  const {
    data: channelData,
    isLoading: channelLoading,
  } = useChannelPerformance(workspaceId, channelDateRange);

  // Fetch cost & ROI data for selected campaign
  const {
    data: costROIData,
    isLoading: costROILoading,
  } = useCampaignCostROI(workspaceId, selectedCampaignId);

  // Enable real-time updates for selected campaign
  useAnalyticsMetricsStream({
    workspaceId,
    campaignId: selectedCampaignId,
    enabled: !!selectedCampaignId,
  });

  const isLoading = campaignLoading || researchLoading;
  const hasError = campaignError || researchError;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Campaign and Research performance insights</p>
        </div>
        <div className="flex gap-2 items-center">
          <ExportDialog
            workspaceId={workspaceId}
            onExport={initiateExport}
            onPollStatus={pollExportStatus}
          >
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          </ExportDialog>
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
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date Range Display */}
      <div className="text-sm text-muted-foreground">
        Showing data from {format(new Date(dateRange.from), 'MMM d, yyyy')} to{' '}
        {format(new Date(dateRange.to), 'MMM d, yyyy')}
      </div>

      {/* Error State */}
      {hasError && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive">
              Error loading analytics: {String(campaignError || researchError)}
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

      {/* Analytics Content */}
      {!isLoading && !hasError && campaignData && researchData && (
        <>
          {/* Campaign KPIs */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Campaign Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Total Campaigns"
                value={campaignData.metrics.total.toLocaleString()}
                icon={<Megaphone className="h-4 w-4" />}
                subtitle={`${campaignData.metrics.active} active`}
              />
              <KPICard
                title="Messages Sent"
                value={campaignData.metrics.totalSent.toLocaleString()}
                icon={<Send className="h-4 w-4" />}
                subtitle={`${campaignData.metrics.totalRecipients.toLocaleString()} recipients`}
              />
              <KPICard
                title="Open Rate"
                value={`${campaignData.metrics.openRate}%`}
                icon={<Target className="h-4 w-4" />}
                subtitle={`${campaignData.metrics.totalOpened.toLocaleString()} opened`}
              />
              <KPICard
                title="Click Rate"
                value={`${campaignData.metrics.clickRate}%`}
                icon={<ActivityIcon className="h-4 w-4" />}
                subtitle={`${campaignData.metrics.totalClicked.toLocaleString()} clicked`}
              />
            </div>
          </div>

          {/* Research KPIs */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Search className="h-5 w-5" />
              Research Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Research Sessions"
                value={researchData.sessions.total.toLocaleString()}
                icon={<Search className="h-4 w-4" />}
                subtitle={`${researchData.sessions.running} running`}
              />
              <KPICard
                title="Total Findings"
                value={researchData.findings.total.toLocaleString()}
                icon={<TrendingUp className="h-4 w-4" />}
                subtitle={`${researchData.findings.applied} applied`}
              />
              <KPICard
                title="Approval Rate"
                value={`${researchData.findings.approvalRate}%`}
                icon={<CheckCircle2 className="h-4 w-4" />}
                subtitle={`${researchData.findings.approved} approved`}
              />
              <KPICard
                title="Avg Confidence"
                value={`${researchData.findings.avgConfidence.toFixed(0)}%`}
                icon={<Target className="h-4 w-4" />}
                subtitle={`${researchData.findings.pending} pending review`}
              />
            </div>
          </div>

          {/* Additional KPIs Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Delivery Rate"
              value={`${campaignData.metrics.deliveryRate}%`}
              icon={<CheckCircle2 className="h-4 w-4" />}
              subtitle={`${campaignData.metrics.totalDelivered.toLocaleString()} delivered`}
            />
            <KPICard
              title="Avg Execution Time"
              value={`${campaignData.execution.avgExecutionTimeHours.toFixed(1)}h`}
              icon={<Clock className="h-4 w-4" />}
              subtitle={`${campaignData.execution.completedCount} completed`}
            />
            <KPICard
              title="Completion Rate"
              value={`${researchData.sessions.completionRate}%`}
              icon={<CheckCircle2 className="h-4 w-4" />}
              subtitle={`${researchData.sessions.completed} completed`}
            />
            <KPICard
              title="Research Cost"
              value={`$${researchData.sessions.totalCostDollars.toFixed(2)}`}
              icon={<TrendingUp className="h-4 w-4" />}
              subtitle={`${researchData.sessions.totalQueries} queries`}
            />
          </div>

          {/* Charts Tabs */}
          <Tabs defaultValue="campaigns" className="space-y-4">
            <TabsList>
              <TabsTrigger value="campaigns">Campaign Analytics</TabsTrigger>
              <TabsTrigger value="funnel">Campaign Funnel</TabsTrigger>
              <TabsTrigger value="channels">Channel Performance</TabsTrigger>
              <TabsTrigger value="research">Research Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="campaigns" className="space-y-4">
              <CampaignCharts data={campaignData} />
            </TabsContent>

            <TabsContent value="funnel" className="space-y-4">
              {/* Campaign Selector */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium">Select Campaign:</label>
                    <Select
                      value={selectedCampaignId}
                      onValueChange={setSelectedCampaignId}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Choose a campaign..." />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Funnel Chart */}
              {selectedCampaignId && (
                <>
                  {funnelLoading ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Loading funnel data...</p>
                      </CardContent>
                    </Card>
                  ) : funnelData ? (
                    <CampaignFunnelChart
                      stages={funnelData.stages}
                      conversionRates={funnelData.conversionRates}
                    />
                  ) : null}

                  {/* Cost & ROI Card */}
                  <CostROICard
                    data={costROIData || null}
                    isLoading={costROILoading}
                    currency="ZAR"
                  />
                </>
              )}

              {!selectedCampaignId && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      Select a campaign to view its conversion funnel
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="channels" className="space-y-4">
              {channelLoading ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Loading channel performance...</p>
                  </CardContent>
                </Card>
              ) : channelData ? (
                <ChannelPerformanceTable
                  channels={channelData.channels}
                  dateRange={channelDateRange}
                  onDateRangeChange={setChannelDateRange}
                />
              ) : null}
            </TabsContent>

            <TabsContent value="research" className="space-y-4">
              <ResearchCharts data={researchData} />
            </TabsContent>
          </Tabs>

          {/* Recent Activity Timeline */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ActivityIcon className="h-5 w-5" />
              Recent Activity
            </h2>
            {activityLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Loading activity...</p>
                </CardContent>
              </Card>
            ) : (
              <ActivityTimeline activities={activities} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
