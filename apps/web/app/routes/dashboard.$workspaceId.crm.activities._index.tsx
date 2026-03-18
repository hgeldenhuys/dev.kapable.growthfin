/**
 * Activities Management Route
 * List and manage CRM activities
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { useState } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { Calendar, Plus, MessageSquare, MessageCircle, Search, Filter, Eye, AlertCircle, Clock } from 'lucide-react';
import { EmptyState } from '~/components/crm/EmptyState';
import { Card, CardContent } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { ActivityTypeBadge } from '~/components/crm/ActivityTypeBadge';
import { ActivityPriorityBadge } from '~/components/crm/ActivityPriorityBadge';
import { ActivityStatusBadge } from '~/components/crm/ActivityStatusBadge';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { ActivityForm } from '~/components/crm/ActivityForm';
import { useCreateActivity } from '~/hooks/useActivities';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';
import { format } from 'date-fns';
import { cn } from '~/lib/utils';

/**
 * Loader for activities list page
 * Fetches all activities from database for server-side rendering
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { db, crmActivities, eq, and, isNull, desc } = await import('~/lib/db.server');

  const { workspaceId } = params;

  if (!workspaceId) {
    throw new Response('Workspace ID is required', { status: 400 });
  }

  const activities = await db
    .select()
    .from(crmActivities)
    .where(and(eq(crmActivities.workspaceId, workspaceId), isNull(crmActivities.deletedAt)))
    .orderBy(desc(crmActivities.createdAt));

  return { activities };
}

export default function ActivitiesPage() {
  const workspaceId = useWorkspaceId();
  const userId = useUserId();
  const [activityType, setActivityType] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [priority, setPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const createActivity = useCreateActivity();
  const revalidator = useRevalidator();
  // Get data from loader
  const { activities: allActivities } = useLoaderData<typeof loader>();

  // Apply client-side filters
  const activities = allActivities.filter((activity) => {
    const matchesType = activityType === 'all' || activity.type === activityType;
    const matchesStatus = status === 'all' || activity.status === status;
    const matchesPriority = priority === 'all' || activity.priority === priority;
    const matchesSearch =
      searchQuery === '' ||
      activity.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesPriority && matchesSearch;
  });

  return (
    <div className="space-y-6" data-tour="activities-list">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activities</h1>
          <p className="text-muted-foreground">
            Manage tasks, calls, emails, and meetings
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Activity
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activity Type Tabs */}
      <Tabs value={activityType} onValueChange={setActivityType}>
        <TabsList>
          <TabsTrigger value="all">All Activities</TabsTrigger>
          <TabsTrigger value="task">Tasks</TabsTrigger>
          <TabsTrigger value="call">Calls</TabsTrigger>
          <TabsTrigger value="email">Emails</TabsTrigger>
          <TabsTrigger value="sms">
            <MessageSquare className="h-3 w-3 mr-1" /> SMS
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageCircle className="h-3 w-3 mr-1 text-emerald-500" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="meeting">Meetings</TabsTrigger>
        </TabsList>

        <TabsContent value={activityType} className="mt-6">
          {activities.length === 0 ? (
            <EmptyState
              icon={<Calendar />}
              title="No activities scheduled"
              description="Create a task, call, or meeting to start tracking interactions with your leads and contacts."
              workspaceId={workspaceId}
              guideStep={5}
              guideLabel="Learn about activities"
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => {
                    const isOverdue = activity.dueDate &&
                      activity.status !== 'completed' &&
                      activity.status !== 'cancelled' &&
                      new Date(activity.dueDate) < new Date();

                    return (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium max-w-[300px]">
                          <Link
                            to={`/dashboard/${workspaceId}/crm/activities/${activity.id}`}
                            className="hover:underline"
                          >
                            {activity.subject}
                          </Link>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {activity.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <ActivityTypeBadge type={activity.type} />
                        </TableCell>
                        <TableCell>
                          <ActivityStatusBadge status={activity.status} />
                        </TableCell>
                        <TableCell>
                          <ActivityPriorityBadge priority={activity.priority} />
                        </TableCell>
                        <TableCell>
                          {activity.dueDate ? (
                            <span className={cn(
                              'text-sm flex items-center gap-1',
                              isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'
                            )}>
                              {isOverdue && <AlertCircle className="h-3 w-3" />}
                              {format(new Date(activity.dueDate), 'MMM d, yyyy')}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(activity.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" asChild>
                                  <Link to={`/dashboard/${workspaceId}/crm/activities/${activity.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Activity</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      {/* Create Activity Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Activity</DialogTitle>
          </DialogHeader>
          <ActivityForm
            workspaceId={workspaceId}
            assignedToId={userId}
            onSubmit={async (data) => {
              try {
                await createActivity.mutateAsync(data);
                setShowCreateDialog(false);
                revalidator.revalidate();
              } catch {
                // Hook already shows error toast
              }
            }}
            onCancel={() => setShowCreateDialog(false)}
            isSubmitting={createActivity.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
