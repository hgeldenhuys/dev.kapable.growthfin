/**
 * Campaign Recurrence Page
 * Configure recurring campaign execution (daily, weekly, monthly)
 */

import { useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  RecurrenceConfig,
  type RecurrenceConfiguration,
} from '~/components/crm/campaigns/RecurrenceConfig';
import {
  useCreateRecurrence,
  usePauseRecurrence,
  useResumeRecurrence,
  useCancelSchedule,
  useScheduledCampaigns,
} from '~/hooks/useCampaignScheduling';
import { useCampaign } from '~/hooks/useCampaigns';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { ScheduledCampaignsList } from '~/components/crm/campaigns/ScheduledCampaignsList';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CampaignRecurrencePage() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Fetch campaign details
  const { data: campaign, isLoading: campaignLoading } = useCampaign(
    campaignId || '',
    workspaceId
  );

  // Fetch all scheduled campaigns to show existing recurring schedules
  const { data: schedules = [], isLoading: schedulesLoading } =
    useScheduledCampaigns(workspaceId);

  // Filter for recurring schedules only
  const recurringSchedules = schedules.filter((s) => s.scheduleType === 'recurring');

  // Mutations
  const createRecurrence = useCreateRecurrence();
  const pauseRecurrence = usePauseRecurrence();
  const resumeRecurrence = useResumeRecurrence();
  const cancelSchedule = useCancelSchedule();

  const handleSave = async (config: RecurrenceConfiguration) => {
    if (!campaignId) return;

    try {
      await createRecurrence.mutateAsync({
        campaignId,
        workspaceId,
        userId,
        pattern: config.pattern,
        time: config.time,
        timezone: config.timezone,
        daysOfWeek: config.daysOfWeek,
        dayOfMonth: config.dayOfMonth,
        endCondition: config.endCondition,
        maxExecutions: config.maxExecutions,
        endDate: config.endDate,
      });

      toast.success('Recurrence Created', { description: `Campaign will execute ${config.pattern} at ${config.time} ${config.timezone}` });

      navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`);
    } catch (error: any) {
      toast.error('Failed to Create Recurrence', { description: error.message || 'Failed to create recurring schedule' });
    }
  };

  const handleCancel = (scheduleId: string) => {
    if (!campaignId) return;

    cancelSchedule.mutate(
      { scheduleId, workspaceId, userId },
      {
        onSuccess: () => {
          toast.success('Recurrence Cancelled', { description: 'Recurring schedule has been cancelled' });
        },
        onError: (error: any) => {
          toast.error('Cancel Failed', { description: error.message || 'Failed to cancel recurrence' });
        },
      }
    );
  };

  const handlePause = (scheduleId: string) => {
    if (!campaignId) return;

    pauseRecurrence.mutate(
      { recurrenceId: scheduleId, workspaceId },
      {
        onSuccess: () => {
          toast.success('Recurrence Paused', { description: 'Recurring schedule has been paused' });
        },
        onError: (error: any) => {
          toast.error('Pause Failed', { description: error.message || 'Failed to pause recurrence' });
        },
      }
    );
  };

  const handleResume = (scheduleId: string) => {
    if (!campaignId) return;

    resumeRecurrence.mutate(
      { recurrenceId: scheduleId, workspaceId },
      {
        onSuccess: () => {
          toast.success('Recurrence Resumed', { description: 'Recurring schedule has been resumed' });
        },
        onError: (error: any) => {
          toast.error('Resume Failed', { description: error.message || 'Failed to resume recurrence' });
        },
      }
    );
  };

  const handleReschedule = (scheduleId: string) => {
    toast.success('Reschedule', { description: 'Reschedule functionality coming soon' });
  };

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Campaign not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recurring Campaign</h1>
          <p className="text-muted-foreground">
            Configure {campaign.name} to execute on a recurring schedule
          </p>
        </div>
      </div>

      {/* Recurrence Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Recurrence Pattern</CardTitle>
          <CardDescription>
            Set up daily, weekly, or monthly recurring execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecurrenceConfig
            campaignId={campaignId || ''}
            onSave={handleSave}
            onCancel={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`)}
            isSubmitting={createRecurrence.isPending}
          />
        </CardContent>
      </Card>

      {/* Existing Recurring Schedules */}
      {recurringSchedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recurring Schedules</CardTitle>
            <CardDescription>
              Active and paused recurring schedules across all campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScheduledCampaignsList
              schedules={recurringSchedules}
              onCancel={handleCancel}
              onReschedule={handleReschedule}
              onPause={handlePause}
              onResume={handleResume}
              isLoading={schedulesLoading}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
