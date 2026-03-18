/**
 * IntentScoreBadge Component
 * Visual badge showing intent score (0-100) with level indicator
 */

import { Badge } from '~/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { Zap, TrendingUp, Activity, Minus } from 'lucide-react';
import { cn } from '~/lib/utils';
import {
  getIntentScoreColor,
  getIntentLevelLabel,
} from '~/hooks/useIntentScore';

interface IntentScoreBadgeProps {
  score: number;
  level?: 'low' | 'medium' | 'high' | 'very_high';
  signalCount?: number;
  lastSignalAt?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function IntentScoreBadge({
  score,
  level,
  signalCount,
  lastSignalAt,
  size = 'md',
  showTooltip = true,
  className,
}: IntentScoreBadgeProps) {
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
    if (score >= 76) return <Zap className="h-3 w-3 mr-1" />;
    if (score >= 51) return <TrendingUp className="h-3 w-3 mr-1" />;
    if (score >= 26) return <Activity className="h-3 w-3 mr-1" />;
    return <Minus className="h-3 w-3 mr-1" />;
  };

  const badge = (
    <Badge
      className={cn(
        'gap-1 border',
        getIntentScoreColor(score),
        getSizeClasses(),
        className
      )}
    >
      {getIcon()}
      <span>{score}</span>
      {size !== 'sm' && (
        <span className="text-xs opacity-75 ml-1">
          {getIntentLevelLabel(score)}
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
              <p className="font-semibold">Buying Intent: {score}/100</p>
              <p className="text-sm text-muted-foreground">
                Level: {getIntentLevelLabel(score)}
              </p>
            </div>

            {signalCount !== undefined && signalCount > 0 && (
              <p className="text-sm">
                {signalCount} signal{signalCount !== 1 ? 's' : ''} detected
              </p>
            )}

            {lastSignalAt && (
              <p className="text-xs text-muted-foreground">
                Last signal: {new Date(lastSignalAt).toLocaleString()}
              </p>
            )}

            <div className="text-xs text-muted-foreground pt-1 border-t">
              {score >= 76 && (
                <p>Very high buying intent - prioritize immediate follow-up</p>
              )}
              {score >= 51 && score < 76 && (
                <p>High buying intent - schedule follow-up soon</p>
              )}
              {score >= 26 && score < 51 && (
                <p>Medium buying intent - monitor for increased signals</p>
              )}
              {score < 26 && <p>Low buying intent - nurture with content</p>}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
