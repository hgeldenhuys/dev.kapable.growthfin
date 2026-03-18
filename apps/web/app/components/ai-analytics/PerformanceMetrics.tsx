/**
 * Performance Metrics Component
 * Table showing latency metrics per tool with color-coded performance
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Badge } from '~/components/ui/badge';
import type { PerformanceMetric } from '~/hooks/useAIAnalytics';

interface PerformanceMetricsProps {
  metrics: PerformanceMetric[];
  isLoading?: boolean;
}

function getLatencyColor(latency: number): string {
  if (latency < 100) return 'bg-green-500';
  if (latency < 500) return 'bg-yellow-500';
  return 'bg-red-500';
}

function formatLatency(ms: number): string {
  return `${ms.toFixed(0)}ms`;
}

function formatErrorRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function PerformanceMetrics({ metrics, isLoading }: PerformanceMetricsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading performance metrics...</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No performance data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool Name</TableHead>
              <TableHead className="text-right">p50</TableHead>
              <TableHead className="text-right">p95</TableHead>
              <TableHead className="text-right">p99</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead className="text-right">Error Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((metric) => (
              <TableRow key={metric.toolName}>
                <TableCell className="font-medium">{metric.toolName}</TableCell>
                <TableCell className="text-right">
                  <Badge className={getLatencyColor(metric.latency.p50)}>
                    {formatLatency(metric.latency.p50)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge className={getLatencyColor(metric.latency.p95)}>
                    {formatLatency(metric.latency.p95)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge className={getLatencyColor(metric.latency.p99)}>
                    {formatLatency(metric.latency.p99)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatLatency(metric.latency.avg)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={metric.errorRate > 0.05 ? 'text-red-600 font-semibold' : ''}>
                    {formatErrorRate(metric.errorRate)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
