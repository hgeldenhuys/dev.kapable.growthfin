/**
 * DeliveryRatesChart Component
 * Visualizations for delivery analytics dashboard (Phase H.2)
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DeliverySummaryData, CampaignDeliveryStats, DeliveryFailure } from '~/hooks/useDeliveryAnalytics';
import { Badge } from '~/components/ui/badge';
import { Mail, MessageSquare, Phone, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '~/lib/utils';

interface DeliveryRatesChartProps {
  data: DeliverySummaryData;
}

// Color based on delivery rate
function getDeliveryRateColor(rate: number): string {
  if (rate >= 90) return '#22c55e'; // green-500
  if (rate >= 70) return '#eab308'; // yellow-500
  return '#ef4444'; // red-500
}

// Channel icon
function getChannelIcon(channel: string) {
  switch (channel?.toLowerCase()) {
    case 'email':
      return <Mail className="h-4 w-4" />;
    case 'sms':
      return <MessageSquare className="h-4 w-4" />;
    case 'voice':
    case 'call':
      return <Phone className="h-4 w-4" />;
    default:
      return <Mail className="h-4 w-4" />;
  }
}

// Badge variant based on delivery rate
function getDeliveryBadgeVariant(rate: number): 'default' | 'secondary' | 'destructive' {
  if (rate >= 90) return 'default';
  if (rate >= 70) return 'secondary';
  return 'destructive';
}

/**
 * Overall Delivery Gauge Card
 */
function OverallDeliveryGauge({ rate, sent, delivered, bounced }: { rate: number; sent: number; delivered: number; bounced: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Overall Delivery Rate
        </CardTitle>
        <CardDescription>Aggregate across all campaigns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                className="text-muted-foreground/20"
                strokeWidth="10"
                stroke="currentColor"
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
              />
              {/* Progress circle */}
              <circle
                className="transition-all duration-500"
                strokeWidth="10"
                strokeLinecap="round"
                stroke={getDeliveryRateColor(rate)}
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
                strokeDasharray={`${rate * 2.51} 251`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{rate.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">Delivered</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 text-center">
          <div>
            <p className="text-2xl font-semibold">{sent.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-green-600">{delivered.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-red-600">{bounced.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Bounced</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Channel Breakdown Chart
 */
function ChannelBreakdownChart({ byChannel }: { byChannel: DeliverySummaryData['byChannel'] }) {
  const channelData = Object.entries(byChannel).map(([channel, stats]) => ({
    channel: channel.charAt(0).toUpperCase() + channel.slice(1),
    sent: stats.sent,
    delivered: stats.delivered,
    rate: stats.rate,
  }));

  if (channelData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delivery by Channel</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No channel data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery by Channel</CardTitle>
        <CardDescription>Compare delivery rates across communication channels</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={channelData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} unit="%" />
            <YAxis type="category" dataKey="channel" width={80} />
            <Tooltip
              formatter={(value: number, name: string) => [
                name === 'rate' ? `${value.toFixed(1)}%` : value.toLocaleString(),
                name === 'rate' ? 'Delivery Rate' : name.charAt(0).toUpperCase() + name.slice(1),
              ]}
            />
            <Legend />
            <Bar dataKey="rate" name="Delivery Rate (%)" fill="#8884d8">
              {channelData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getDeliveryRateColor(entry.rate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Stats below chart */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          {channelData.map((ch) => (
            <div key={ch.channel} className="flex items-center gap-2">
              {getChannelIcon(ch.channel)}
              <div>
                <p className="font-medium">{ch.channel}</p>
                <p className="text-xs text-muted-foreground">
                  {ch.delivered.toLocaleString()} / {ch.sent.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Campaign Comparison Table
 */
function CampaignComparisonTable({
  title,
  description,
  campaigns,
  isBottomPerformers = false,
}: {
  title: string;
  description: string;
  campaigns: CampaignDeliveryStats[];
  isBottomPerformers?: boolean;
}) {
  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No campaigns yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isBottomPerformers ? (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {campaigns.map((campaign, index) => (
            <div
              key={campaign.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg',
                isBottomPerformers ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-green-50 dark:bg-green-950/20'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm',
                    isBottomPerformers
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                  )}
                >
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{campaign.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {getChannelIcon(campaign.channel)}
                    <span>{campaign.channel}</span>
                    <span>|</span>
                    <span>
                      {campaign.delivered.toLocaleString()} / {campaign.sent.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <Badge variant={getDeliveryBadgeVariant(campaign.deliveryRate)}>
                {campaign.deliveryRate.toFixed(1)}%
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Recent Failures List
 */
function RecentFailuresList({ failures }: { failures: DeliveryFailure[] }) {
  if (failures.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Recent Delivery Failures
          </CardTitle>
          <CardDescription>Last 10 failed deliveries</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
          <p className="text-muted-foreground">No recent failures - great job!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-500" />
          Recent Delivery Failures
        </CardTitle>
        <CardDescription>Last 10 failed deliveries with error details</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {failures.map((failure) => (
            <div
              key={failure.id}
              className="flex items-start justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg"
            >
              <div className="flex items-start gap-3">
                {getChannelIcon(failure.channel)}
                <div>
                  <p className="font-medium">{failure.campaignName}</p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {failure.errorMessage || failure.errorCode || 'Unknown error'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {failure.sentAt
                      ? new Date(failure.sentAt).toLocaleString()
                      : 'Unknown time'}
                  </p>
                </div>
              </div>
              <Badge variant="destructive">{failure.status}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main DeliveryRatesChart Component
 */
export function DeliveryRatesChart({ data }: DeliveryRatesChartProps) {
  return (
    <div className="space-y-6">
      {/* Top Row: Gauge + Channel Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OverallDeliveryGauge
          rate={data.overallDeliveryRate}
          sent={data.totalSent}
          delivered={data.totalDelivered}
          bounced={data.totalBounced}
        />
        <ChannelBreakdownChart byChannel={data.byChannel} />
      </div>

      {/* Middle Row: Top and Bottom Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CampaignComparisonTable
          title="Top Performing Campaigns"
          description="Campaigns with highest delivery rates"
          campaigns={data.topCampaigns}
          isBottomPerformers={false}
        />
        <CampaignComparisonTable
          title="Needs Improvement"
          description="Campaigns with lowest delivery rates"
          campaigns={data.bottomCampaigns}
          isBottomPerformers={true}
        />
      </div>

      {/* Bottom Row: Recent Failures */}
      <RecentFailuresList failures={data.recentFailures} />
    </div>
  );
}

// Export individual components for flexibility
export { OverallDeliveryGauge, ChannelBreakdownChart, CampaignComparisonTable, RecentFailuresList };
