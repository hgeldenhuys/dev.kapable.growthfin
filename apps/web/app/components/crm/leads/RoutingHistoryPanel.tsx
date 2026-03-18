/**
 * RoutingHistoryPanel Component
 * Timeline display of routing/assignment history for a lead
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Loader2, UserCheck, Clock } from 'lucide-react';
import { useLeadRouting, getRoutingStatusColor } from '~/hooks/useLeadRouting';
import { cn } from '~/lib/utils';

interface RoutingHistoryPanelProps {
  leadId: string;
  workspaceId: string;
}

export function RoutingHistoryPanel({ leadId, workspaceId }: RoutingHistoryPanelProps) {
  const { data: history, isLoading, error } = useLeadRouting(leadId, workspaceId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">Failed to load routing history</p>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No routing history yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Routing History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'relative pl-6 pb-4',
                index !== history.length - 1 && 'border-l-2 border-muted'
              )}
            >
              {/* Timeline dot */}
              <div className="absolute left-0 top-1 -translate-x-1/2 h-3 w-3 rounded-full bg-primary border-2 border-background" />

              <div className="space-y-2">
                {/* Status and timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <Badge className={getRoutingStatusColor(item.status as any)}>
                    {item.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.routed_at).toLocaleString()}
                  </span>
                </div>

                {/* Assigned to */}
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{item.assigned_to}</span>
                </div>

                {/* Routing reason */}
                {item.routing_reason && (
                  <p className="text-sm text-muted-foreground">
                    {item.routing_reason}
                  </p>
                )}

                {/* Assignment reason (if manually assigned) */}
                {item.assignment_reason && (
                  <p className="text-xs text-muted-foreground italic">
                    Manual: {item.assignment_reason}
                  </p>
                )}

                {/* Assigned by (if manual) */}
                {item.assigned_by && (
                  <p className="text-xs text-muted-foreground">
                    Assigned by: {item.assigned_by}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
