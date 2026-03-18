/**
 * UsageGraph Component
 * US-CTX-009: Time-Series Usage Graph
 *
 * Displays token usage trends over time using Recharts
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface SessionMetrics {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  percentageUsed: number;
}

interface Session {
  sessionId: string;
  projectId: string;
  lastActivity: string;
  metrics: SessionMetrics;
  conversationTurns: number;
}

interface UsageGraphProps {
  sessions: Session[];
}

interface TimeSeriesDataPoint {
  time: string;
  timestamp: number;
  cached: number;
  input: number;
  output: number;
  total: number;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

function transformSessionsToTimeSeries(sessions: Session[]): TimeSeriesDataPoint[] {
  // Sort sessions by lastActivity (oldest to newest)
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
  );

  // Transform into time-series data points
  const dataPoints: TimeSeriesDataPoint[] = sortedSessions.map((session) => ({
    time: format(new Date(session.lastActivity), "MMM dd, HH:mm"),
    timestamp: new Date(session.lastActivity).getTime(),
    cached: session.metrics.cachedTokens,
    input: session.metrics.inputTokens,
    output: session.metrics.outputTokens,
    total: session.metrics.totalTokens
  }));

  return dataPoints;
}

export function UsageGraph({ sessions }: UsageGraphProps) {
  const data = transformSessionsToTimeSeries(sessions);

  // Filter to last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filteredData = data.filter((point) => point.timestamp >= sevenDaysAgo);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-sm mb-2">{data.time}</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#8884d8]" />
            <span className="text-muted-foreground">Cached:</span>
            <span className="font-mono font-medium">{formatTokens(data.cached)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#82ca9d]" />
            <span className="text-muted-foreground">Input:</span>
            <span className="font-mono font-medium">{formatTokens(data.input)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#ffc658]" />
            <span className="text-muted-foreground">Output:</span>
            <span className="font-mono font-medium">{formatTokens(data.output)}</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-mono font-semibold">{formatTokens(data.total)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Usage Trends (Last 7 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            No data available for the last 7 days
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart
              data={filteredData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="time"
                stroke="currentColor"
                className="text-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="currentColor"
                className="text-muted-foreground"
                tick={{ fontSize: 12 }}
                tickFormatter={formatTokens}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "14px" }}
                iconType="square"
              />
              <Area
                type="monotone"
                dataKey="cached"
                stackId="1"
                stroke="#8884d8"
                fill="#8884d8"
                name="Cached"
              />
              <Area
                type="monotone"
                dataKey="input"
                stackId="1"
                stroke="#82ca9d"
                fill="#82ca9d"
                name="Input"
              />
              <Area
                type="monotone"
                dataKey="output"
                stackId="1"
                stroke="#ffc658"
                fill="#ffc658"
                name="Output"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
