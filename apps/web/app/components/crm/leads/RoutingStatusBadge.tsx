/**
 * RoutingStatusBadge Component
 * Visual badge showing lead routing/assignment status
 */

import { Badge } from '~/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { Loader2, CheckCircle2, XCircle, Clock, UserCheck, RefreshCw } from 'lucide-react';
import { cn } from '~/lib/utils';
import { getRoutingStatusColor } from '~/hooks/useLeadRouting';

interface RoutingStatusBadgeProps {
  status: 'pending' | 'routed' | 'accepted' | 'reassigned' | 'failed';
  assignedTo?: string;
  routingReason?: string;
  routedAt?: string;
  className?: string;
  showTooltip?: boolean;
}

export function RoutingStatusBadge({
  status,
  assignedTo,
  routingReason,
  routedAt,
  className,
  showTooltip = true,
}: RoutingStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pending',
          icon: Clock,
          color: getRoutingStatusColor('pending'),
        };
      case 'routed':
        return {
          label: 'Routed',
          icon: Loader2,
          color: getRoutingStatusColor('routed'),
          animate: true,
        };
      case 'accepted':
        return {
          label: 'Accepted',
          icon: CheckCircle2,
          color: getRoutingStatusColor('accepted'),
        };
      case 'reassigned':
        return {
          label: 'Reassigned',
          icon: RefreshCw,
          color: getRoutingStatusColor('reassigned'),
        };
      case 'failed':
        return {
          label: 'Failed',
          icon: XCircle,
          color: getRoutingStatusColor('failed'),
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const badge = (
    <Badge className={cn('gap-1.5', config.color, className)}>
      <Icon
        className={cn('h-3 w-3', config.animate && 'animate-spin')}
      />
      {config.label}
      {assignedTo && status !== 'failed' && (
        <span className="ml-1 opacity-75">→ {assignedTo}</span>
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
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">{config.label}</p>

            {assignedTo && status !== 'failed' && (
              <p className="text-sm">
                <UserCheck className="inline h-3 w-3 mr-1" />
                Assigned to: <span className="font-semibold">{assignedTo}</span>
              </p>
            )}

            {routingReason && (
              <p className="text-sm text-muted-foreground">
                Reason: {routingReason}
              </p>
            )}

            {routedAt && (
              <p className="text-xs text-muted-foreground">
                {new Date(routedAt).toLocaleString()}
              </p>
            )}

            {status === 'pending' && (
              <p className="text-sm">Waiting for routing assignment</p>
            )}

            {status === 'failed' && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Routing failed - manual assignment may be required
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
