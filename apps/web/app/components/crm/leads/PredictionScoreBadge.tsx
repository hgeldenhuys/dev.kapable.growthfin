/**
 * PredictionScoreBadge Component
 * Visual score display (0-100) with color gradient and confidence indicator
 */

import { Badge } from '~/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '~/lib/utils';
import {
  getPredictionScoreBgColor,
  getPredictionScoreTextColor,
  type PredictionFactor,
} from '~/hooks/useLeadPrediction';

interface PredictionScoreBadgeProps {
  score: number;
  confidenceInterval?: number;
  category?: 'high_probability' | 'medium_probability' | 'low_probability';
  topFactors?: PredictionFactor[];
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function PredictionScoreBadge({
  score,
  confidenceInterval,
  category,
  topFactors,
  size = 'md',
  showTooltip = true,
  className,
}: PredictionScoreBadgeProps) {
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
    if (score >= 70) return <TrendingUp className="h-3 w-3 mr-1" />;
    if (score >= 40) return <Minus className="h-3 w-3 mr-1" />;
    return <TrendingDown className="h-3 w-3 mr-1" />;
  };

  const badge = (
    <Badge
      className={cn(
        'gap-1 border',
        getPredictionScoreBgColor(score),
        getPredictionScoreTextColor(score),
        getSizeClasses(),
        className
      )}
    >
      {getIcon()}
      <span>{score}</span>
      {confidenceInterval && size !== 'sm' && (
        <span className="text-xs opacity-75">±{confidenceInterval}</span>
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
              <p className="font-semibold">Conversion Prediction: {score}/100</p>
              {confidenceInterval && (
                <p className="text-xs text-muted-foreground">
                  Confidence: ±{confidenceInterval} points
                </p>
              )}
            </div>

            {category && (
              <p className="text-sm">
                Category:{' '}
                <span className="font-semibold capitalize">
                  {category.replace('_', ' ')}
                </span>
              </p>
            )}

            {topFactors && topFactors.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-1">Top Factors:</p>
                <ul className="text-xs space-y-1">
                  {topFactors.slice(0, 3).map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-muted-foreground">{idx + 1}.</span>
                      <span>{factor.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
