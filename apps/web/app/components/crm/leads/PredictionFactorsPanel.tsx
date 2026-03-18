/**
 * PredictionFactorsPanel Component
 * Display top contributing factors with bar chart and explanations
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Progress } from '~/components/ui/progress';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '~/lib/utils';
import { formatFactorName, type PredictionFactor } from '~/hooks/useLeadPrediction';

interface PredictionFactorsPanelProps {
  factors: PredictionFactor[];
  className?: string;
}

export function PredictionFactorsPanel({
  factors,
  className,
}: PredictionFactorsPanelProps) {
  if (!factors || factors.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Contributing Factors</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No prediction factors available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort by contribution (descending) and take top 3
  const topFactors = [...factors]
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Contributing Factors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {topFactors.map((factor, idx) => {
          const isPositive = factor.contribution > 0;
          const maxContribution = Math.max(...topFactors.map((f) => Math.abs(f.contribution)));
          const percentage = (Math.abs(factor.contribution) / maxContribution) * 100;

          return (
            <div key={idx} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <div
                    className={cn(
                      'mt-0.5',
                      isPositive
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {formatFactorName(factor.factor)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {factor.description}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-sm font-semibold whitespace-nowrap',
                    isPositive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {isPositive ? '+' : ''}
                  {factor.contribution}
                </span>
              </div>

              <div className="space-y-1">
                <Progress
                  value={percentage}
                  className={cn(
                    'h-2',
                    isPositive
                      ? 'bg-green-100 dark:bg-green-900'
                      : 'bg-red-100 dark:bg-red-900'
                  )}
                />
              </div>
            </div>
          );
        })}

        {factors.length > 3 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            + {factors.length - 3} more factor{factors.length - 3 !== 1 ? 's' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
