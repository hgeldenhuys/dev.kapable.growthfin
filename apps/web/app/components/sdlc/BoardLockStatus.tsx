/**
 * BoardLockStatus Component
 * Displays lock status badge with tooltip showing lock details
 */

import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Lock, Unlock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BoardLockStatusProps {
  locked: boolean;
  lock_owner: string | null;
  locked_at: string | null;
  last_heartbeat: string | null;
  is_stale: boolean;
}

export function BoardLockStatus({
  locked,
  lock_owner,
  locked_at,
  last_heartbeat,
  is_stale,
}: BoardLockStatusProps) {
  if (!locked) {
    return (
      <div className="flex items-center gap-2">
        <Unlock className="h-4 w-4 text-green-600" />
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          Available
        </Badge>
      </div>
    );
  }

  const lockIcon = is_stale ? (
    <AlertTriangle className="h-4 w-4 text-orange-600" />
  ) : (
    <Lock className="h-4 w-4 text-red-600" />
  );

  const badgeVariant = is_stale ? "outline" : "destructive";
  const badgeClass = is_stale
    ? "bg-orange-50 text-orange-700 border-orange-300"
    : "bg-red-50 text-red-700 border-red-300";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            {lockIcon}
            <Badge variant={badgeVariant} className={badgeClass}>
              {is_stale ? "Stale Lock" : `Locked by ${lock_owner?.slice(0, 8)}`}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-semibold">Lock Owner:</span> {lock_owner}
            </div>
            <div>
              <span className="font-semibold">Locked:</span>{" "}
              {locked_at ? formatDistanceToNow(new Date(locked_at), { addSuffix: true }) : "-"}
            </div>
            <div>
              <span className="font-semibold">Last Heartbeat:</span>{" "}
              {last_heartbeat
                ? formatDistanceToNow(new Date(last_heartbeat), { addSuffix: true })
                : "-"}
            </div>
            {is_stale && (
              <div className="text-orange-600 font-medium">
                ⚠️ Lock is stale (no heartbeat &gt; 5 minutes)
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
