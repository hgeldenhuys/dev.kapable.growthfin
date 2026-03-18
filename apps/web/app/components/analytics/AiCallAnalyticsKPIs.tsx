/**
 * AiCallAnalyticsKPIs Component
 * Phase K: AI Call Analytics Dashboard
 *
 * Displays key performance indicators for AI calls.
 */

import { Card, CardContent } from '~/components/ui/card';
import { Phone, Percent, Clock, DollarSign, Flame, Sun, Snowflake, PhoneIncoming, PhoneOutgoing, UserCheck } from 'lucide-react';
import type { AiCallMetrics } from '~/hooks/useAiCallAnalytics';

interface AiCallAnalyticsKPIsProps {
  data: AiCallMetrics;
  isLoading?: boolean;
}

export function AiCallAnalyticsKPIs({ data, isLoading }: AiCallAnalyticsKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-8 bg-muted rounded w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Calls',
      value: data.metrics.totalCalls.toString(),
      icon: Phone,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Success Rate',
      value: `${data.metrics.successRate}%`,
      icon: Percent,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Avg Duration',
      value: data.metrics.avgDurationFormatted,
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      label: 'Total Cost',
      value: `$${data.metrics.totalCost}`,
      icon: DollarSign,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                </div>
                <div className={`p-3 rounded-full ${kpi.bgColor}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Call Direction */}
        {data.direction && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Call Direction</p>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <PhoneOutgoing className="h-5 w-5 text-green-500" />
                  </div>
                  <p className="text-lg font-bold">{data.direction.outbound}</p>
                  <p className="text-xs text-muted-foreground">Outbound</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <PhoneIncoming className="h-5 w-5 text-blue-500" />
                  </div>
                  <p className="text-lg font-bold">{data.direction.inbound}</p>
                  <p className="text-xs text-muted-foreground">Inbound</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <UserCheck className="h-5 w-5 text-purple-500" />
                  </div>
                  <p className="text-lg font-bold">{data.direction.identificationRate}%</p>
                  <p className="text-xs text-muted-foreground">ID Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lead Quality */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Lead Quality</p>
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Flame className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-lg font-bold">{data.leadQuality.hot}</p>
                <p className="text-xs text-muted-foreground">Hot</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Sun className="h-5 w-5 text-yellow-500" />
                </div>
                <p className="text-lg font-bold">{data.leadQuality.warm}</p>
                <p className="text-xs text-muted-foreground">Warm</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Snowflake className="h-5 w-5 text-blue-400" />
                </div>
                <p className="text-lg font-bold">{data.leadQuality.cold}</p>
                <p className="text-xs text-muted-foreground">Cold</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sentiment */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Sentiment</p>
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className="h-3 w-3 rounded-full bg-green-500 mx-auto mb-1" />
                <p className="text-lg font-bold">{data.sentiment.positive}</p>
                <p className="text-xs text-muted-foreground">Positive</p>
              </div>
              <div className="text-center">
                <div className="h-3 w-3 rounded-full bg-gray-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{data.sentiment.neutral}</p>
                <p className="text-xs text-muted-foreground">Neutral</p>
              </div>
              <div className="text-center">
                <div className="h-3 w-3 rounded-full bg-red-500 mx-auto mb-1" />
                <p className="text-lg font-bold">{data.sentiment.negative}</p>
                <p className="text-xs text-muted-foreground">Negative</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Outcomes */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Top Outcomes</p>
            <div className="flex items-center justify-around">
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">{data.outcomes.interested}</p>
                <p className="text-xs text-muted-foreground">Interested</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-600">{data.outcomes.callback}</p>
                <p className="text-xs text-muted-foreground">Callback</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-500">{data.outcomes.voicemail}</p>
                <p className="text-xs text-muted-foreground">Voicemail</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
