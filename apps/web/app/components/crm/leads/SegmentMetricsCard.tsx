/**
 * SegmentMetricsCard Component
 * Display comprehensive metrics for a segment
 */

import { Users, TrendingUp, Activity, Target, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { useSegmentMetrics } from '~/hooks/useSegments';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface SegmentMetricsCardProps {
  segmentId: string;
  workspaceId: string;
  timeframe?: '7d' | '30d' | '90d';
}

export function SegmentMetricsCard({
  segmentId,
  workspaceId,
  timeframe = '30d',
}: SegmentMetricsCardProps) {
  const { data: metrics, isLoading, error } = useSegmentMetrics(segmentId, workspaceId, timeframe);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12 text-destructive">
            <p>Error loading metrics: {String(error)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.metrics.total_leads.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className={metrics.metrics.new_leads_7d > 0 ? 'text-green-600' : ''}>
                +{metrics.metrics.new_leads_7d}
              </span>
              {' '}in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.metrics.conversion_rate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Qualified → Won
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(metrics.metrics.avg_composite_score)}
            </div>
            <p className="text-xs text-muted-foreground">
              Composite score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Volume</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.metrics.activity_volume_30d.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {metrics.trend && metrics.trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lead Count Trend ({timeframe})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  formatter={(value: number) => [value.toLocaleString(), 'Leads']}
                />
                <Line
                  type="monotone"
                  dataKey="lead_count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Conversion Funnel */}
      {metrics.funnel && metrics.funnel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.funnel.map((stage: any, index: number) => {
                const percentage = (stage.percentage * 100).toFixed(1);
                const isLast = index === metrics.funnel.length - 1;

                return (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium capitalize">
                        {stage.stage.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{stage.count.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">({percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          isLast ? 'bg-green-500' : 'bg-primary'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Average Lead Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Propensity Score</span>
                <span className="text-sm font-bold">
                  {Math.round(metrics.metrics.avg_propensity_score)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 bg-blue-500 rounded-full"
                  style={{ width: `${metrics.metrics.avg_propensity_score}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Engagement Score</span>
                <span className="text-sm font-bold">
                  {Math.round(metrics.metrics.avg_engagement_score)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 bg-purple-500 rounded-full"
                  style={{ width: `${metrics.metrics.avg_engagement_score}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Fit Score</span>
                <span className="text-sm font-bold">
                  {Math.round(metrics.metrics.avg_fit_score)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 bg-green-500 rounded-full"
                  style={{ width: `${metrics.metrics.avg_fit_score}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Composite Score</span>
                <span className="text-sm font-bold">
                  {Math.round(metrics.metrics.avg_composite_score)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 bg-primary rounded-full"
                  style={{ width: `${metrics.metrics.avg_composite_score}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(metrics.last_updated).toLocaleString()}
      </div>
    </div>
  );
}
