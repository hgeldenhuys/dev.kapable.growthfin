/**
 * PerformanceCharts Component
 * Recharts visualizations for performance dashboard
 */

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

interface DailyCallData {
  date: string;
  calls: number;
  connected: number;
}

interface ConversionTrendData {
  date: string;
  conversionRate: number;
  contactRate: number;
}

interface PerformanceChartsProps {
  dailyCalls: DailyCallData[];
  conversionTrend: ConversionTrendData[];
}

export function PerformanceCharts({ dailyCalls, conversionTrend }: PerformanceChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Daily Calls Bar Chart */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Daily Call Activity (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyCalls}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Bar
                dataKey="calls"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="Total Calls"
              />
              <Bar
                dataKey="connected"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
                name="Connected"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion Rate Line Chart */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={conversionTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => `${value}%`}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey="contactRate"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-1))', r: 4 }}
                name="Contact Rate"
              />
              <Line
                type="monotone"
                dataKey="conversionRate"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-3))', r: 4 }}
                name="Conversion Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
