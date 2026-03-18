/**
 * EnrollmentCard Component
 * Display enrollment information with quick actions
 */

import { User, Calendar, X, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import type { WorkflowEnrollment } from '~/hooks/useWorkflowEnrollments';
import { format } from 'date-fns';

interface EnrollmentCardProps {
  enrollment: WorkflowEnrollment;
  leadName?: string;
  onView?: (enrollment: WorkflowEnrollment) => void;
  onCancel?: (enrollment: WorkflowEnrollment) => void;
  onComplete?: (enrollment: WorkflowEnrollment) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function EnrollmentCard({
  enrollment,
  leadName,
  onView,
  onCancel,
  onComplete,
}: EnrollmentCardProps) {
  const statusColor = STATUS_COLORS[enrollment.status] || STATUS_COLORS.active;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => onView?.(enrollment)}
                className="font-medium hover:text-primary hover:underline text-left"
              >
                {leadName || `Lead ${enrollment.leadId.slice(0, 8)}`}
              </button>
            </div>
            <Badge className={statusColor}>{enrollment.status}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Started {format(new Date(enrollment.createdAt), 'PPp')}</span>
          </div>

          {enrollment.lastExecutedAt && (
            <div className="text-xs text-muted-foreground">
              Last executed: {format(new Date(enrollment.lastExecutedAt), 'PPp')}
            </div>
          )}

          {enrollment.completedAt && (
            <div className="text-xs text-green-600">
              Completed: {format(new Date(enrollment.completedAt), 'PPp')}
            </div>
          )}

          {enrollment.retryCount > 0 && (
            <div className="text-xs text-orange-600">
              Retries: {enrollment.retryCount}
            </div>
          )}
        </div>

        {/* Current Step */}
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-1">Current Step</p>
          <p className="text-sm font-mono">{enrollment.currentStepId.slice(0, 12)}...</p>
        </div>

        {/* Actions */}
        {enrollment.status === 'active' && (
          <div className="flex items-center gap-2 pt-2">
            {onCancel && (
              <Button
                onClick={() => onCancel(enrollment)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
            {onComplete && (
              <Button
                onClick={() => onComplete(enrollment)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
