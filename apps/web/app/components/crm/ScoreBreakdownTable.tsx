/**
 * ScoreBreakdownTable Component
 * Display detailed breakdown of propensity score components
 *
 * Shows:
 * - Contact Quality (25 points)
 * - Company Fit (25 points)
 * - Engagement (25 points)
 * - Timing/Readiness (25 points)
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/lib/utils';

interface ComponentScore {
  score: number;
  max: number;
  details: {
    [key: string]: {
      points: number;
      maxPoints: number;
      value?: any;
      reason: string;
    };
  };
}

interface ScoreBreakdown {
  total: number;
  components: {
    contactQuality: ComponentScore;
    companyFit: ComponentScore;
    engagement: ComponentScore;
    timing: ComponentScore;
  };
}

interface ScoreBreakdownTableProps {
  breakdown: ScoreBreakdown;
  className?: string;
}

const COMPONENT_LABELS = {
  contactQuality: 'Contact Quality',
  companyFit: 'Company Fit',
  engagement: 'Engagement',
  timing: 'Timing & Readiness',
};

const COMPONENT_DESCRIPTIONS = {
  contactQuality: 'Quality and completeness of contact information',
  companyFit: 'How well the company matches ideal customer profile',
  engagement: 'Level of interaction and response to outreach',
  timing: 'Readiness to buy based on recent activity',
};

export function ScoreBreakdownTable({ breakdown, className }: ScoreBreakdownTableProps) {
  const getComponentPercentage = (component: ComponentScore) => {
    return (component.score / component.max) * 100;
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground">Total Score</h3>
          <p className="text-2xl font-bold">{breakdown.total}/100</p>
        </div>
        <Progress value={breakdown.total} className="w-1/2 h-3" />
      </div>

      {/* Components Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Component</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead className="w-[200px]">Performance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(breakdown.components).map(([key, component]) => {
            const percentage = getComponentPercentage(component);
            const componentKey = key as keyof typeof COMPONENT_LABELS;

            return (
              <TableRow key={key}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{COMPONENT_LABELS[componentKey]}</div>
                    <div className="text-xs text-muted-foreground">
                      {COMPONENT_DESCRIPTIONS[componentKey]}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn('font-semibold', getPerformanceColor(percentage))}>
                    {component.score}
                  </span>
                  <span className="text-muted-foreground"> / {component.max}</span>
                </TableCell>
                <TableCell>
                  <Progress value={percentage} className="h-2" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Detailed Breakdown (Expandable sections could be added here) */}
      <div className="space-y-3 pt-2">
        <h4 className="text-sm font-medium text-muted-foreground">Component Details</h4>
        {Object.entries(breakdown.components).map(([key, component]) => {
          const componentKey = key as keyof typeof COMPONENT_LABELS;
          const hasDetails = Object.keys(component.details).length > 0;

          if (!hasDetails) return null;

          return (
            <details key={key} className="group">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors">
                  <span className="font-medium text-sm">{COMPONENT_LABELS[componentKey]}</span>
                  <span className="text-xs text-muted-foreground group-open:hidden">
                    Show details
                  </span>
                  <span className="text-xs text-muted-foreground hidden group-open:inline">
                    Hide details
                  </span>
                </div>
              </summary>
              <div className="mt-2 ml-4 space-y-2">
                {Object.entries(component.details).map(([detailKey, detail]) => (
                  <div
                    key={detailKey}
                    className="flex items-start justify-between text-sm p-2 border-l-2 border-muted"
                  >
                    <div className="flex-1">
                      <p className="text-muted-foreground">{detail.reason}</p>
                      {detail.value !== undefined && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Value: {JSON.stringify(detail.value)}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <span className="font-medium">
                        {detail.points}/{detail.maxPoints}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
