/**
 * AI Call Analytics Dashboard Page
 * Phase K: AI Call Analytics Dashboard
 *
 * Provides visibility into AI call performance with metrics, trends, and script comparisons.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { AiCallAnalyticsKPIs } from '~/components/analytics/AiCallAnalyticsKPIs';
import { AiCallTrendsChart } from '~/components/analytics/AiCallTrendsChart';
import { AiCallOutcomeChart } from '~/components/analytics/AiCallOutcomeChart';
import { AiCallScriptTable } from '~/components/analytics/AiCallScriptTable';
import {
  useAiCallMetrics,
  useAiCallTrends,
  useAiCallScriptPerformance,
  useAiCallOutcomes,
  type Period,
} from '~/hooks/useAiCallAnalytics';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { Bot, ArrowLeft, RefreshCw } from 'lucide-react';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'all', label: 'All Time' },
];

export default function AiCallAnalyticsDashboard() {
  const workspaceId = useWorkspaceId();
  const [period, setPeriod] = useState<Period>('30d');
  const [activeTab, setActiveTab] = useState('trends');

  // Fetch all analytics data
  const {
    data: metricsData,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useAiCallMetrics(workspaceId, period);

  const {
    data: trendsData,
    isLoading: trendsLoading,
  } = useAiCallTrends(workspaceId, period);

  const {
    data: scriptsData,
    isLoading: scriptsLoading,
  } = useAiCallScriptPerformance(workspaceId, period);

  const {
    data: outcomesData,
    isLoading: outcomesLoading,
  } = useAiCallOutcomes(workspaceId, period);

  const handleRefresh = () => {
    refetchMetrics();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/dashboard/${workspaceId}/crm/ai-calls`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-8 w-8" />
              AI Call Analytics
            </h1>
            <p className="text-muted-foreground">
              Track performance, trends, and script effectiveness
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={period === option.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {/* Refresh Button */}
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {metricsData ? (
        <AiCallAnalyticsKPIs data={metricsData} isLoading={metricsLoading} />
      ) : (
        <AiCallAnalyticsKPIs
          data={{
            period: '30d',
            metrics: {
              totalCalls: 0,
              successRate: 0,
              avgDuration: 0,
              avgDurationFormatted: '0:00',
              totalDuration: 0,
              totalDurationFormatted: '0:00',
              totalCost: '0.00',
            },
            outcomes: {
              interested: 0,
              notInterested: 0,
              callback: 0,
              voicemail: 0,
              noAnswer: 0,
              failed: 0,
            },
            sentiment: { positive: 0, neutral: 0, negative: 0 },
            leadQuality: { hot: 0, warm: 0, cold: 0 },
          }}
          isLoading={metricsLoading}
        />
      )}

      {/* Charts and Tables */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="trends">Call Trends</TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
          <TabsTrigger value="scripts">By Script</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="mt-4">
          <AiCallTrendsChart
            data={trendsData?.trends || []}
            isLoading={trendsLoading}
          />
        </TabsContent>

        <TabsContent value="outcomes" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AiCallOutcomeChart
              data={outcomesData?.distribution || []}
              total={outcomesData?.total || 0}
              isLoading={outcomesLoading}
            />
            {/* Outcome Breakdown List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Outcome Breakdown</h3>
              <div className="space-y-2">
                {outcomesData?.distribution.map((outcome) => (
                  <div
                    key={outcome.outcome}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            outcome.outcome === 'interested'
                              ? '#22c55e'
                              : outcome.outcome === 'not_interested'
                              ? '#ef4444'
                              : outcome.outcome === 'callback'
                              ? '#eab308'
                              : outcome.outcome === 'voicemail'
                              ? '#a855f7'
                              : outcome.outcome === 'no_answer'
                              ? '#6b7280'
                              : outcome.outcome === 'failed'
                              ? '#dc2626'
                              : '#94a3b8',
                        }}
                      />
                      <span className="capitalize">
                        {outcome.outcome.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{outcome.count}</span>
                      <span className="text-muted-foreground ml-2">
                        ({outcome.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scripts" className="mt-4">
          <AiCallScriptTable
            scripts={scriptsData?.scripts || []}
            isLoading={scriptsLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
