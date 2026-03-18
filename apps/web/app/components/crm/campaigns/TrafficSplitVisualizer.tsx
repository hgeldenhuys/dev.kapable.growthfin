/**
 * TrafficSplitVisualizer Component
 * Visual representation of traffic allocation across variants
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Variant {
  name: string;
  trafficPct: number;
  color?: string;
}

interface TrafficSplitVisualizerProps {
  variants: Variant[];
  controlGroupPct?: number;
  className?: string;
}

const VARIANT_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-orange-500',
];

const CONTROL_GROUP_COLOR = 'bg-gray-400';

export function TrafficSplitVisualizer({
  variants,
  controlGroupPct = 0,
  className,
}: TrafficSplitVisualizerProps) {
  const totalAllocated = useMemo(() => {
    const variantTotal = variants.reduce((sum, v) => sum + v.trafficPct, 0);
    return variantTotal + controlGroupPct;
  }, [variants, controlGroupPct]);

  const isValid = totalAllocated === 100;
  const hasControlGroup = controlGroupPct > 0;

  // Calculate bar segments
  const segments = useMemo(() => {
    const result = variants.map((variant, index) => ({
      label: variant.name,
      percentage: variant.trafficPct,
      color: variant.color || VARIANT_COLORS[index % VARIANT_COLORS.length],
    }));

    if (hasControlGroup) {
      result.push({
        label: 'Control Group',
        percentage: controlGroupPct,
        color: CONTROL_GROUP_COLOR,
      });
    }

    return result;
  }, [variants, controlGroupPct, hasControlGroup]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Traffic Allocation
          </CardTitle>
          <div className="flex items-center space-x-2">
            {isValid ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-600">
                  {totalAllocated}%
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">
                  {totalAllocated}%
                </span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bar Chart */}
        <div className="relative h-12 w-full overflow-hidden rounded-lg bg-muted">
          <div className="flex h-full">
            {segments.map((segment, index) => (
              segment.percentage > 0 && (
                <div
                  key={index}
                  className={cn('h-full transition-all duration-300', segment.color)}
                  style={{ width: `${segment.percentage}%` }}
                  title={`${segment.label}: ${segment.percentage}%`}
                />
              )
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div className={cn('h-3 w-3 rounded-sm', segment.color)} />
                <span className="font-medium">{segment.label}</span>
              </div>
              <span className="tabular-nums text-muted-foreground">
                {segment.percentage}%
              </span>
            </div>
          ))}
        </div>

        {/* Validation Message */}
        {!isValid && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="flex items-start space-x-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Invalid traffic allocation</p>
                <p className="mt-1 text-xs">
                  Total must equal 100%. Currently at {totalAllocated}%.
                  {totalAllocated < 100 && ` Add ${100 - totalAllocated}% more.`}
                  {totalAllocated > 100 && ` Reduce by ${totalAllocated - 100}%.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {isValid && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <div className="flex items-start space-x-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Traffic allocation valid</p>
                <p className="mt-1 text-xs">
                  All recipients will be assigned to a variant
                  {hasControlGroup && ' or control group'}.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
