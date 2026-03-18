/**
 * AiCallOutcomeChart Component
 * Phase K: AI Call Analytics Dashboard
 *
 * Pie chart showing outcome distribution.
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { OutcomeDistribution } from '~/hooks/useAiCallAnalytics';

interface AiCallOutcomeChartProps {
  data: OutcomeDistribution[];
  total: number;
  isLoading?: boolean;
}

// Colors for each outcome type
const OUTCOME_COLORS: Record<string, string> = {
  interested: '#22c55e',     // green
  not_interested: '#ef4444', // red
  callback: '#eab308',       // yellow
  voicemail: '#a855f7',      // purple
  no_answer: '#6b7280',      // gray
  failed: '#dc2626',         // dark red
  pending: '#94a3b8',        // slate
};

// Friendly labels for outcomes
const OUTCOME_LABELS: Record<string, string> = {
  interested: 'Interested',
  not_interested: 'Not Interested',
  callback: 'Callback',
  voicemail: 'Voicemail',
  no_answer: 'No Answer',
  failed: 'Failed',
  pending: 'Pending',
};

export function AiCallOutcomeChart({ data, total, isLoading }: AiCallOutcomeChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outcome Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter out zero counts for cleaner chart
  const chartData = data
    .filter(d => d.count > 0)
    .map(d => ({
      ...d,
      name: OUTCOME_LABELS[d.outcome] || d.outcome,
      color: OUTCOME_COLORS[d.outcome] || '#6b7280',
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outcome Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No data available for this period</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outcome Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name}: ${percentage}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="count"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} calls (${Math.round(value / total * 100)}%)`,
                name,
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
