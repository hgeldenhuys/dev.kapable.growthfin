/**
 * PredictionTrendChart Component
 * Line chart showing prediction score over time with 30-day trend view
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Download, TrendingUp } from 'lucide-react';
import { cn } from '~/lib/utils';

interface PredictionDataPoint {
  date: string;
  score: number;
  event?: string;
}

interface PredictionTrendChartProps {
  data: PredictionDataPoint[];
  className?: string;
  onExport?: () => void;
}

export function PredictionTrendChart({
  data,
  className,
  onExport,
}: PredictionTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Prediction Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No prediction history available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate min and max for scaling
  const scores = data.map((d) => d.score);
  const minScore = Math.min(...scores, 0);
  const maxScore = Math.max(...scores, 100);

  // Simple line chart rendering (using SVG)
  const chartHeight = 200;
  const chartWidth = 600;
  const padding = 40;

  const xScale = (index: number) =>
    padding + (index / (data.length - 1)) * (chartWidth - 2 * padding);
  const yScale = (score: number) =>
    chartHeight -
    padding -
    ((score - minScore) / (maxScore - minScore)) * (chartHeight - 2 * padding);

  const pathData = data
    .map((d, i) => {
      const x = xScale(i);
      const y = yScale(d.score);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Prediction Trend (30 Days)
          </CardTitle>
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <svg
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="overflow-visible"
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((score) => (
              <g key={score}>
                <line
                  x1={padding}
                  y1={yScale(score)}
                  x2={chartWidth - padding}
                  y2={yScale(score)}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground/20"
                  strokeDasharray="2,2"
                />
                <text
                  x={padding - 10}
                  y={yScale(score) + 4}
                  textAnchor="end"
                  className="text-xs text-muted-foreground"
                >
                  {score}
                </text>
              </g>
            ))}

            {/* Line */}
            <path
              d={pathData}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
            />

            {/* Data points */}
            {data.map((d, i) => {
              const x = xScale(i);
              const y = yScale(d.score);
              const hasEvent = !!d.event;

              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r={hasEvent ? 6 : 4}
                    fill="currentColor"
                    className={cn(
                      hasEvent ? 'text-orange-500' : 'text-primary'
                    )}
                  />
                  {hasEvent && (
                    <circle
                      cx={x}
                      cy={y}
                      r={8}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-orange-500 opacity-50"
                    />
                  )}
                </g>
              );
            })}

            {/* X-axis labels (first, middle, last) */}
            {[0, Math.floor(data.length / 2), data.length - 1].map((i) => {
              if (i >= data.length) return null;
              const d = data[i];
              return (
                <text
                  key={i}
                  x={xScale(i)}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className="text-xs text-muted-foreground"
                >
                  {new Date(d.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </text>
              );
            })}
          </svg>

          {/* Event annotations */}
          {data.some((d) => d.event) && (
            <div className="mt-4 space-y-1">
              {data
                .filter((d) => d.event)
                .map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                    <span className="text-muted-foreground">
                      {new Date(d.date).toLocaleDateString()}: {d.event}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
