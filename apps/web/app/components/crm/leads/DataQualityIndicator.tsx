/**
 * DataQualityIndicator Component
 * Color-coded badge showing lead data quality with popover details
 */

import { CheckCircle2, AlertCircle, XCircle, Info } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/lib/utils';

interface DataQualityIndicatorProps {
  score: number;
  completenessScore?: number;
  validityScore?: number;
  criticalIssues?: string[];
  issueCount?: number;
  showPopover?: boolean;
  className?: string;
}

export function DataQualityIndicator({
  score,
  completenessScore,
  validityScore,
  criticalIssues = [],
  issueCount = 0,
  showPopover = true,
  className,
}: DataQualityIndicatorProps) {
  // Get quality tier and styling
  const getQualityInfo = () => {
    if (score >= 80) {
      return {
        tier: 'Good',
        icon: CheckCircle2,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/20',
        borderColor: 'border-green-300 dark:border-green-700',
        variant: 'default' as const,
      };
    }
    if (score >= 50) {
      return {
        tier: 'Fair',
        icon: AlertCircle,
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-300 dark:border-yellow-700',
        variant: 'secondary' as const,
      };
    }
    return {
      tier: 'Poor',
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
      borderColor: 'border-red-300 dark:border-red-700',
      variant: 'destructive' as const,
    };
  };

  const qualityInfo = getQualityInfo();
  const Icon = qualityInfo.icon;

  const badgeContent = (
    <Badge variant={qualityInfo.variant} className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      <span>{score}</span>
    </Badge>
  );

  if (!showPopover) {
    return badgeContent;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="cursor-pointer">{badgeContent}</button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold">Data Quality</h4>
              <p className="text-sm text-muted-foreground">Overall health score</p>
            </div>
            <div className={cn('text-2xl font-bold', qualityInfo.color)}>
              {score}
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>

          {/* Score Breakdown */}
          {(completenessScore !== undefined || validityScore !== undefined) && (
            <div className="space-y-3">
              <h5 className="text-sm font-medium">Score Breakdown</h5>

              {completenessScore !== undefined && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completeness</span>
                    <span className="font-medium">{completenessScore}%</span>
                  </div>
                  <Progress value={completenessScore} />
                </div>
              )}

              {validityScore !== undefined && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Validity</span>
                    <span className="font-medium">{validityScore}%</span>
                  </div>
                  <Progress value={validityScore} />
                </div>
              )}
            </div>
          )}

          {/* Issues */}
          {(criticalIssues.length > 0 || issueCount > 0) && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium">Issues</h5>
              {criticalIssues.length > 0 ? (
                <ul className="space-y-1">
                  {criticalIssues.map((issue, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {issueCount} {issueCount === 1 ? 'issue' : 'issues'} found
                </p>
              )}
            </div>
          )}

          {/* Quality Tier Info */}
          <div className={cn('rounded-md p-3 border', qualityInfo.bgColor, qualityInfo.borderColor)}>
            <div className="flex items-start gap-2">
              <Info className={cn('h-4 w-4 mt-0.5', qualityInfo.color)} />
              <div className="space-y-1">
                <p className={cn('text-sm font-medium', qualityInfo.color)}>
                  {qualityInfo.tier} Quality
                </p>
                <p className="text-xs text-muted-foreground">
                  {score >= 80 && 'This lead has complete and valid data.'}
                  {score >= 50 && score < 80 && 'Some data is missing or needs validation.'}
                  {score < 50 && 'Critical data issues need immediate attention.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
