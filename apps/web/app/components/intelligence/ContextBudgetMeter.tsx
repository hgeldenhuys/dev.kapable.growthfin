/**
 * Context Budget Meter
 * Shows current conversation's token usage
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { MessageSquare, TrendingUp } from 'lucide-react';
import type { ContextBudget } from '../../lib/api/intelligence';

interface ContextBudgetMeterProps {
  budget: ContextBudget | null;
  isLoading: boolean;
}

export function ContextBudgetMeter({
  budget,
  isLoading,
}: ContextBudgetMeterProps) {
  if (!budget && !isLoading) {
    return null;
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Context Budget
        </CardTitle>
        {budget && budget.shouldCompress && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            Compression Recommended
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-12 bg-muted animate-pulse rounded" />
        ) : budget ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Usage</span>
                <span className="font-medium">
                  {budget.used.toLocaleString()} / {budget.limit.toLocaleString()} tokens
                </span>
              </div>
              <div className="relative">
                <Progress
                  value={budget.percentage}
                  className="h-2"
                />
                <div
                  className={`absolute inset-0 h-2 rounded-full transition-all ${getProgressColor(
                    budget.percentage
                  )}`}
                  style={{ width: `${budget.percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{budget.percentage.toFixed(1)}% used</span>
                {budget.shouldCompress && (
                  <span className="text-amber-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    High usage
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Messages</span>
                <span className="font-medium">{budget.breakdown.messages}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Files</span>
                <span className="font-medium">{budget.breakdown.files}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Tools</span>
                <span className="font-medium">{budget.breakdown.tools}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Other</span>
                <span className="font-medium">{budget.breakdown.other}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            No active conversation
          </div>
        )}
      </CardContent>
    </Card>
  );
}
