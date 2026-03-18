/**
 * Agent Performance Dashboard Route
 * Display key metrics, charts, and performance analytics
 */

import { useParams } from 'react-router';
import { Phone, Target, TrendingUp, Users } from 'lucide-react';
import { MetricCard } from '~/components/crm/agent/MetricCard';
import { PerformanceCharts } from '~/components/crm/agent/PerformanceCharts';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function AgentPerformanceDashboard() {
  const { workspaceId } = useParams();

  // Mock data - replace with real API calls
  const metrics = {
    totalCalls: {
      value: 156,
      trend: { value: 12, direction: 'up' as const, label: 'vs last week' },
      goal: { current: 156, target: 200, label: 'Weekly Goal' },
    },
    contactRate: {
      value: '68%',
      trend: { value: 5, direction: 'up' as const, label: 'vs last week' },
      teamComparison: { rank: 3, total: 12, label: 'on team' },
    },
    conversionRate: {
      value: '24%',
      trend: { value: -2, direction: 'down' as const, label: 'vs last week' },
      goal: { current: 24, target: 30, label: 'Target: 30%' },
    },
    teamRanking: {
      value: '#3',
      trend: { value: 1, direction: 'up' as const, label: 'moved up' },
      teamComparison: { rank: 3, total: 12, label: 'team members' },
    },
  };

  const dailyCalls = [
    { date: 'Mon', calls: 28, connected: 19 },
    { date: 'Tue', calls: 32, connected: 22 },
    { date: 'Wed', calls: 25, connected: 17 },
    { date: 'Thu', calls: 30, connected: 21 },
    { date: 'Fri', calls: 27, connected: 18 },
    { date: 'Sat', calls: 8, connected: 5 },
    { date: 'Sun', calls: 6, connected: 4 },
  ];

  const conversionTrend = [
    { date: 'Mon', conversionRate: 26, contactRate: 68 },
    { date: 'Tue', conversionRate: 28, contactRate: 69 },
    { date: 'Wed', conversionRate: 24, contactRate: 68 },
    { date: 'Thu', conversionRate: 22, contactRate: 70 },
    { date: 'Fri', conversionRate: 25, contactRate: 67 },
    { date: 'Sat', conversionRate: 20, contactRate: 63 },
    { date: 'Sun', conversionRate: 23, contactRate: 67 },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track your call metrics and performance trends
          </p>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Calls"
          value={metrics.totalCalls.value}
          icon={Phone}
          trend={metrics.totalCalls.trend}
          goal={metrics.totalCalls.goal}
        />
        <MetricCard
          title="Contact Rate"
          value={metrics.contactRate.value}
          icon={Target}
          trend={metrics.contactRate.trend}
          teamComparison={metrics.contactRate.teamComparison}
        />
        <MetricCard
          title="Conversion Rate"
          value={metrics.conversionRate.value}
          icon={TrendingUp}
          trend={metrics.conversionRate.trend}
          goal={metrics.conversionRate.goal}
        />
        <MetricCard
          title="Team Ranking"
          value={metrics.teamRanking.value}
          icon={Users}
          trend={metrics.teamRanking.trend}
          teamComparison={metrics.teamRanking.teamComparison}
        />
      </div>

      {/* Performance Charts */}
      <PerformanceCharts
        dailyCalls={dailyCalls}
        conversionTrend={conversionTrend}
      />

      {/* Additional Insights Section */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 border rounded-lg bg-card">
          <div className="text-sm font-medium text-muted-foreground mb-1">Best Time</div>
          <div className="text-2xl font-bold">2-4 PM</div>
          <div className="text-xs text-muted-foreground mt-1">Highest contact rate</div>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <div className="text-sm font-medium text-muted-foreground mb-1">Avg Call Duration</div>
          <div className="text-2xl font-bold">4m 32s</div>
          <div className="text-xs text-muted-foreground mt-1">Connected calls only</div>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <div className="text-sm font-medium text-muted-foreground mb-1">Follow-ups Pending</div>
          <div className="text-2xl font-bold">18</div>
          <div className="text-xs text-muted-foreground mt-1">Scheduled callbacks</div>
        </div>
      </div>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
