/**
 * Cost Trend Chart Component
 * Line chart showing daily cost trends over time
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { CostBreakdown } from '~/hooks/useAIAnalytics';
import { format } from 'date-fns';

interface CostTrendChartProps {
  breakdown: CostBreakdown[];
  totalCost: number;
  isLoading?: boolean;
}

export function CostTrendChart({ breakdown, totalCost, isLoading }: CostTrendChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Trends</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">Loading cost data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!breakdown || breakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Trends</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">No cost data available</p>
        </CardContent>
      </Card>
    );
  }

  // Transform data for chart with formatted dates
  const chartData = breakdown.map((item) => ({
    date: format(new Date(item.date), 'MMM d'),
    cost: item.totalCost,
    inputTokens: Math.round(item.inputTokens / 1000), // Convert to K
    outputTokens: Math.round(item.outputTokens / 1000), // Convert to K
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Trends (Total: ${totalCost.toFixed(2)})</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cost"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="Cost ($)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="inputTokens"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Input Tokens (K)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="outputTokens"
              stroke="#10b981"
              strokeWidth={2}
              name="Output Tokens (K)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
