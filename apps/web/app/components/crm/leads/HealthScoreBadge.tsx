/**
 * HealthScoreBadge Component
 * Visual badge showing health score (0-100) with status indicator
 */

import { Badge } from '~/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { Heart, TrendingUp, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '~/lib/utils';
import {
  getHealthScoreColor,
  getHealthStatusLabel,
} from '~/hooks/useHealthScore';

interface HealthScoreBadgeProps {
  score: number;
  status?: 'critical' | 'at_risk' | 'healthy' | 'excellent';
  riskFactorCount?: number;
  lastCalculatedAt?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function HealthScoreBadge({
  score,
  status,
  riskFactorCount,
  lastCalculatedAt,
  size = 'md',
  showTooltip = true,
  className,
}: HealthScoreBadgeProps) {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-0.5';
      case 'lg':
        return 'text-lg px-4 py-1.5 font-bold';
      case 'md':
      default:
        return 'text-sm px-3 py-1 font-semibold';
    }
  };

  const getIcon = () => {
    if (score >= 76) return <Heart className="h-3 w-3 mr-1 fill-current" />;
    if (score >= 51) return <TrendingUp className="h-3 w-3 mr-1" />;
    if (score >= 26) return <AlertTriangle className="h-3 w-3 mr-1" />;
    return <XCircle className="h-3 w-3 mr-1" />;
  };

  const badge = (
    <Badge
      className={cn(
        'gap-1 border',
        getHealthScoreColor(score),
        getSizeClasses(),
        className
      )}
    >
      {getIcon()}
      <span>{score}</span>
      {size !== 'sm' && (
        <span className="text-xs opacity-75 ml-1">
          {getHealthStatusLabel(score)}
        </span>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-2">
            <div>
              <p className="font-semibold">Lead Health: {score}/100</p>
              <p className="text-sm text-muted-foreground">
                Status: {getHealthStatusLabel(score)}
              </p>
            </div>

            {riskFactorCount !== undefined && riskFactorCount > 0 && (
              <p className="text-sm text-orange-600 dark:text-orange-400">
                ⚠️ {riskFactorCount} risk factor{riskFactorCount !== 1 ? 's' : ''} detected
              </p>
            )}

            {lastCalculatedAt && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(lastCalculatedAt).toLocaleString()}
              </p>
            )}

            <div className="text-xs text-muted-foreground pt-1 border-t">
              {score >= 76 && (
                <p>Excellent health - lead is highly engaged and responsive</p>
              )}
              {score >= 51 && score < 76 && (
                <p>Healthy - lead shows good engagement levels</p>
              )}
              {score >= 26 && score < 51 && (
                <p>At risk - reduced engagement, intervention recommended</p>
              )}
              {score < 26 && (
                <p>Critical - immediate action required to prevent loss</p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
