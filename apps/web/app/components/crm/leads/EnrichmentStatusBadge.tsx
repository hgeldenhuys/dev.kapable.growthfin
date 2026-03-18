/**
 * EnrichmentStatusBadge Component
 * Visual badge showing lead enrichment status with color coding
 */

import { Badge } from '~/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '~/lib/utils';
import type { EnrichmentData } from '~/hooks/useLeadEnrichment';
import { getConfidenceLabel } from '~/hooks/useLeadEnrichment';

interface EnrichmentStatusBadgeProps {
  status: EnrichmentData['status'] | 'not_enriched';
  enrichedFields?: Record<string, any>;
  confidenceScores?: Record<string, number>;
  errorMessage?: string;
  className?: string;
  showTooltip?: boolean;
}

export function EnrichmentStatusBadge({
  status,
  enrichedFields,
  confidenceScores,
  errorMessage,
  className,
  showTooltip = true,
}: EnrichmentStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pending',
          icon: Clock,
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        };
      case 'in_progress':
        return {
          label: 'Enriching',
          icon: Loader2,
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
          animate: true,
        };
      case 'completed':
        return {
          label: 'Enriched',
          icon: CheckCircle2,
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        };
      case 'failed':
        return {
          label: 'Failed',
          icon: XCircle,
          color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        };
      default:
        return {
          label: 'Not Enriched',
          icon: null,
          color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Calculate average confidence if available
  const avgConfidence =
    confidenceScores && Object.keys(confidenceScores).length > 0
      ? Object.values(confidenceScores).reduce((sum, score) => sum + score, 0) /
        Object.keys(confidenceScores).length
      : null;

  const badge = (
    <Badge className={cn('gap-1.5', config.color, className)}>
      {Icon && (
        <Icon
          className={cn('h-3 w-3', config.animate && 'animate-spin')}
        />
      )}
      {config.label}
    </Badge>
  );

  if (!showTooltip || status === 'not_enriched') {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">{config.label}</p>

            {status === 'completed' && enrichedFields && (
              <>
                <p className="text-sm">
                  Enriched {Object.keys(enrichedFields).length} field
                  {Object.keys(enrichedFields).length !== 1 ? 's' : ''}
                </p>
                {avgConfidence !== null && (
                  <p className="text-sm">
                    Average confidence:{' '}
                    <span className="font-semibold">
                      {getConfidenceLabel(avgConfidence)} (
                      {Math.round(avgConfidence * 100)}%)
                    </span>
                  </p>
                )}
                <div className="text-xs text-muted-foreground">
                  {Object.keys(enrichedFields)
                    .slice(0, 3)
                    .map((field) => (
                      <div key={field}>
                        {field}: {getConfidenceLabel(confidenceScores?.[field] || 0)}
                      </div>
                    ))}
                  {Object.keys(enrichedFields).length > 3 && (
                    <div>+ {Object.keys(enrichedFields).length - 3} more</div>
                  )}
                </div>
              </>
            )}

            {status === 'failed' && errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            )}

            {status === 'in_progress' && (
              <p className="text-sm">Fetching enrichment data...</p>
            )}

            {status === 'pending' && (
              <p className="text-sm">Enrichment queued for processing</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
