/**
 * QualityIssuesList Component
 * Displays list of data quality issues with severity indicators
 */

import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

export interface QualityIssue {
  field: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
}

interface QualityIssuesListProps {
  issues: QualityIssue[];
  onFixIssue?: (issue: QualityIssue) => void;
  className?: string;
}

export function QualityIssuesList({
  issues,
  onFixIssue,
  className,
}: QualityIssuesListProps) {
  const getSeverityInfo = (severity: QualityIssue['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          icon: AlertCircle,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/20',
          label: 'Critical',
          variant: 'destructive' as const,
        };
      case 'high':
        return {
          icon: AlertTriangle,
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-100 dark:bg-orange-900/20',
          label: 'High',
          variant: 'secondary' as const,
        };
      case 'medium':
        return {
          icon: Info,
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
          label: 'Medium',
          variant: 'secondary' as const,
        };
      case 'low':
        return {
          icon: Info,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/20',
          label: 'Low',
          variant: 'outline' as const,
        };
    }
  };

  // Group issues by severity
  const groupedIssues = issues.reduce((acc, issue) => {
    const key = issue.severity;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key]!.push(issue);
    return acc;
  }, {} as Record<string, QualityIssue[]>);

  const severityOrder: Array<QualityIssue['severity']> = ['critical', 'high', 'medium', 'low'];

  if (issues.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Issues Found</h3>
          <p className="text-sm text-muted-foreground text-center">
            This lead has no data quality issues.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Data Quality Issues</CardTitle>
          <Badge variant="secondary">
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {severityOrder.map((severity) => {
          const severityIssues = groupedIssues[severity];
          if (!severityIssues || severityIssues.length === 0) return null;

          const severityInfo = getSeverityInfo(severity);
          const Icon = severityInfo.icon;

          return (
            <div key={severity} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', severityInfo.color)} />
                <h4 className="text-sm font-semibold capitalize">{severityInfo.label}</h4>
                <Badge variant={severityInfo.variant} className="ml-auto">
                  {severityIssues.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {severityIssues.map((issue, index) => (
                  <div
                    key={`${severity}-${index}`}
                    className={cn(
                      'rounded-lg border p-4 space-y-2',
                      severityInfo.bgColor
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{issue.field}</span>
                          <Badge variant="outline" className="text-xs">
                            {issue.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{issue.issue}</p>
                      </div>
                    </div>

                    {issue.suggestion && (
                      <div className="flex items-start gap-2 pt-2 border-t">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <p className="text-xs text-muted-foreground">{issue.suggestion}</p>
                          {onFixIssue && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onFixIssue(issue)}
                              className="h-7 text-xs"
                            >
                              Fix Issue
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
