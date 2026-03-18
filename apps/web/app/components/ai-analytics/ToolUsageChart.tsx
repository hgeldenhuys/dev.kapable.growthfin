/**
 * Tool Usage Chart Component
 * Bar chart showing tool invocations with success vs error breakdown
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { ToolUsageStat } from '~/hooks/useAIAnalytics';

interface ToolUsageChartProps {
  tools: ToolUsageStat[];
  isLoading?: boolean;
}

export function ToolUsageChart({ tools, isLoading }: ToolUsageChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tool Usage</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">Loading tool usage data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!tools || tools.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tool Usage</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">No tool usage data available</p>
        </CardContent>
      </Card>
    );
  }

  // Transform data for chart
  const chartData = tools.map((tool) => ({
    name: tool.toolName,
    success: tool.invocations - tool.errorCount,
    errors: tool.errorCount,
    total: tool.invocations,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tool Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="success" fill="#10b981" name="Success" stackId="a" />
            <Bar dataKey="errors" fill="#ef4444" name="Errors" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
