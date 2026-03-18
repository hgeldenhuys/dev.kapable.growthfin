/**
 * ScheduledCampaignsList Component
 * List view of scheduled campaigns with countdown timers
 */

import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
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
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { Calendar, Clock, Repeat, Pause, Play, X, Edit } from 'lucide-react';

export interface ScheduledCampaign {
  id: string;
  campaignId: string;
  campaignName: string;
  scheduleType: 'once' | 'recurring';
  scheduledAt?: string; // ISO timestamp for one-time
  nextExecutionAt?: string; // ISO timestamp for next execution
  timezone: string;
  status: 'scheduled' | 'executing' | 'completed' | 'cancelled' | 'paused';
  executionCount?: number;
  recurrencePattern?: string;
  createdAt: string;
}

interface ScheduledCampaignsListProps {
  schedules: ScheduledCampaign[];
  onCancel: (scheduleId: string) => void;
  onReschedule: (scheduleId: string) => void;
  onPause?: (scheduleId: string) => void;
  onResume?: (scheduleId: string) => void;
  isLoading?: boolean;
}

export function ScheduledCampaignsList({
  schedules,
  onCancel,
  onReschedule,
  onPause,
  onResume,
  isLoading = false,
}: ScheduledCampaignsListProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleCancelClick = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    if (selectedScheduleId) {
      onCancel(selectedScheduleId);
    }
    setCancelDialogOpen(false);
    setSelectedScheduleId(null);
  };

  const getCountdown = (nextExecutionAt: string): string => {
    const date = new Date(nextExecutionAt);
    if (isPast(date)) {
      return 'Executing now...';
    }
    return `in ${formatDistanceToNow(date)}`;
  };

  const getStatusBadge = (status: ScheduledCampaign['status']) => {
    const variants: Record<string, { variant: any; label: string }> = {
      scheduled: { variant: 'default', label: 'Scheduled' },
      executing: { variant: 'secondary', label: 'Executing' },
      completed: { variant: 'outline', label: 'Completed' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
      paused: { variant: 'secondary', label: 'Paused' },
    };

    const config = variants[status] || variants.scheduled;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading schedules...</p>
        </div>
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border rounded-md bg-muted/30">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Scheduled Campaigns</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Schedule a campaign to execute at a specific date and time, or set up recurring campaigns
          to run automatically.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Next Execution</TableHead>
              <TableHead>Countdown</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => {
              const nextExecution = schedule.nextExecutionAt || schedule.scheduledAt;
              const countdown = nextExecution ? getCountdown(nextExecution) : 'N/A';

              return (
                <TableRow key={schedule.id}>
                  <TableCell className="font-medium">{schedule.campaignName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {schedule.scheduleType === 'recurring' ? (
                        <Repeat className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-500" />
                      )}
                      <span className="capitalize">{schedule.scheduleType}</span>
                    </div>
                    {schedule.scheduleType === 'recurring' && schedule.recurrencePattern && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {schedule.recurrencePattern}
                        {schedule.executionCount !== undefined &&
                          ` (${schedule.executionCount} runs)`}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {nextExecution ? (
                      <div className="text-sm">
                        <div>{format(new Date(nextExecution), 'PPP')}</div>
                        <div className="text-muted-foreground">
                          {format(new Date(nextExecution), 'p')}
                        </div>
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>
                    <div
                      className={
                        countdown.startsWith('Executing')
                          ? 'text-green-600 font-medium'
                          : 'text-muted-foreground'
                      }
                    >
                      {countdown}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">{schedule.timezone}</code>
                  </TableCell>
                  <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Reschedule */}
                      {schedule.status === 'scheduled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onReschedule(schedule.id)}
                          title="Reschedule"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Pause/Resume (for recurring) */}
                      {schedule.scheduleType === 'recurring' &&
                        schedule.status === 'scheduled' &&
                        onPause && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPause(schedule.id)}
                            title="Pause"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                      {schedule.scheduleType === 'recurring' &&
                        schedule.status === 'paused' &&
                        onResume && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onResume(schedule.id)}
                            title="Resume"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}

                      {/* Cancel */}
                      {(schedule.status === 'scheduled' || schedule.status === 'paused') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelClick(schedule.id)}
                          title="Cancel"
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Scheduled Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the scheduled execution. For recurring campaigns, all future
              executions will be stopped. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Schedule</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-red-600 hover:bg-red-700">
              Cancel Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
