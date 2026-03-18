/**
 * Activity Detail Route
 * View and edit individual activity
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { useNavigate, Link, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { useState } from 'react';
import { ArrowLeft, Edit, Trash2, Check, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { ActivityTypeBadge } from '~/components/crm/ActivityTypeBadge';
import { ActivityPriorityBadge } from '~/components/crm/ActivityPriorityBadge';
import { ActivityStatusBadge } from '~/components/crm/ActivityStatusBadge';
import { ActivityForm } from '~/components/crm/ActivityForm';
import {
  useUpdateActivity,
  useCompleteActivity,
  useCancelActivity,
  useDeleteActivity,
} from '~/hooks/useActivities';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { format } from 'date-fns';
import type { UpdateActivityRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for activity detail page
 * Fetches activity from database for server-side rendering
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { db, crmActivities, eq, and, isNull } = await import('~/lib/db.server');

  const { workspaceId, activityId } = params;

  if (!workspaceId || !activityId) {
    throw new Response('Workspace ID and Activity ID are required', { status: 400 });
  }

  const [activity] = await db
    .select()
    .from(crmActivities)
    .where(and(eq(crmActivities.id, activityId), eq(crmActivities.workspaceId, workspaceId), isNull(crmActivities.deletedAt)))
    .limit(1);

  if (!activity) {
    throw new Response('Activity not found', { status: 404 });
  }

  return { activity };
}

export default function ActivityDetailPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Get data from loader
  const { activity } = useLoaderData<typeof loader>();
  const activityId = activity.id;

  const updateActivity = useUpdateActivity();
  const completeActivity = useCompleteActivity();
  const cancelActivity = useCancelActivity();
  const deleteActivity = useDeleteActivity();

  const handleUpdate = (data: any) => {
    updateActivity.mutate(
      {
        activityId: activityId!,
        workspaceId,
        data: data as UpdateActivityRequest,
      },
      {
        onSuccess: () => {
          setShowEditDialog(false);
        },
      }
    );
  };

  const handleComplete = () => {
    completeActivity.mutate({ activityId: activityId!, workspaceId, userId });
  };

  const handleCancel = () => {
    cancelActivity.mutate({ activityId: activityId!, workspaceId, userId });
  };

  const handleDelete = () => {
    deleteActivity.mutate(
      { activityId: activityId!, workspaceId },
      {
        onSuccess: () => {
          navigate(`/dashboard/${workspaceId}/crm/activities`);
        },
      }
    );
  };

  // Loading and error states are handled by React Router's loader pattern
  // If we reach this point, activity is guaranteed to exist

  const canComplete = activity.status === 'planned' || activity.status === 'in_progress';
  const canCancel = activity.status !== 'completed' && activity.status !== 'cancelled';

  // Call/meeting fields may be stored in metadata JSONB (ActivityForm stores them there)
  // Fall back to metadata when top-level fields are null
  const meta = (activity.metadata || {}) as Record<string, any>;
  const callDirection = activity.callDirection || meta.callDirection || null;
  const callDuration = activity.callDuration || meta.callDuration || null;
  const meetingLocation = activity.meetingLocation || meta.meetingLocation || null;
  const meetingStartTime = activity.meetingStartTime || meta.meetingStartTime || null;
  const meetingEndTime = activity.meetingEndTime || meta.meetingEndTime || null;

  // Derive related entity from specific FK fields, falling back to legacy relatedToType/relatedToId
  let relatedEntityType: string | null = null;
  let relatedEntityId: string | null = null;
  if (activity.leadId) { relatedEntityType = 'lead'; relatedEntityId = activity.leadId; }
  else if (activity.contactId) { relatedEntityType = 'contact'; relatedEntityId = activity.contactId; }
  else if (activity.accountId) { relatedEntityType = 'account'; relatedEntityId = activity.accountId; }
  else if (activity.opportunityId) { relatedEntityType = 'opportunity'; relatedEntityId = activity.opportunityId; }
  else if (activity.relatedToType && activity.relatedToId) { relatedEntityType = activity.relatedToType; relatedEntityId = activity.relatedToId; }

  const entityPathMap: Record<string, string> = { lead: 'leads', contact: 'contacts', account: 'accounts', opportunity: 'opportunities' };
  const relatedEntityUrl = relatedEntityType && relatedEntityId
    ? `/dashboard/${workspaceId}/crm/${entityPathMap[relatedEntityType] || relatedEntityType + 's'}/${relatedEntityId}`
    : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/${workspaceId}/crm/activities`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Activities
        </Button>
      </div>

      {/* Activity Details */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{activity.subject}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <ActivityTypeBadge type={activity.type} />
                <ActivityStatusBadge status={activity.status} />
                <ActivityPriorityBadge priority={activity.priority} />
              </div>
            </div>
            <div className="flex gap-2">
              {canComplete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleComplete}
                  disabled={completeActivity.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              )}
              {canCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={cancelActivity.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowEditDialog(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Description */}
          {activity.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{activity.description}</p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activity.dueDate && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Due Date</h4>
                <p>{format(new Date(activity.dueDate), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}

            {(activity.completedDate || activity.completedAt) && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Completed At</h4>
                <p>{format(new Date((activity.completedDate || activity.completedAt)!), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}

            {activity.type === 'call' && (
              <>
                {callDirection && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Call Direction</h4>
                    <p className="capitalize">{callDirection}</p>
                  </div>
                )}
                {callDuration && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Duration</h4>
                    <p>
                      {Math.floor(Number(callDuration) / 60)}m {Number(callDuration) % 60}s
                    </p>
                  </div>
                )}
              </>
            )}

            {activity.type === 'meeting' && (
              <>
                {meetingLocation && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Location</h4>
                    <p>{meetingLocation}</p>
                  </div>
                )}
                {meetingStartTime && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Start Time</h4>
                    <p>{format(new Date(meetingStartTime), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                )}
                {meetingEndTime && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">End Time</h4>
                    <p>{format(new Date(meetingEndTime), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Related Entity */}
          {relatedEntityUrl && relatedEntityType && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Related To</h4>
              <Link to={relatedEntityUrl} className="text-primary hover:underline capitalize">
                View {relatedEntityType} details
              </Link>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
              <p className="text-sm">{format(new Date(activity.createdAt), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Last Updated</h4>
              <p className="text-sm">{format(new Date(activity.updatedAt), 'MMM d, yyyy h:mm a')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
          </DialogHeader>
          <ActivityForm
            activity={activity}
            workspaceId={workspaceId}
            assignedToId={activity.assigneeId || activity.assignedToId || userId}
            onSubmit={handleUpdate}
            onCancel={() => setShowEditDialog(false)}
            isSubmitting={updateActivity.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
