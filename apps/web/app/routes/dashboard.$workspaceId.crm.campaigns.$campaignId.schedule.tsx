/**
 * Campaign Schedule Page
 * Schedule a campaign for one-time execution at a specific date/time
 */

import { useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { ScheduleForm } from '~/components/crm/campaigns/ScheduleForm';
import { ScheduledCampaignsList } from '~/components/crm/campaigns/ScheduledCampaignsList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  useScheduleCampaign,
  useCancelSchedule,
  useRescheduleCampaign,
  useScheduledCampaigns,
} from '~/hooks/useCampaignScheduling';
import { useCampaign } from '~/hooks/useCampaigns';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CampaignSchedulePage() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Fetch campaign details
  const { data: campaign, isLoading: campaignLoading } = useCampaign(
    campaignId || '',
    workspaceId
  );

  // Fetch all scheduled campaigns for this workspace
  const { data: schedules = [], isLoading: schedulesLoading } =
    useScheduledCampaigns(workspaceId);

  // Get current campaign's schedule if exists (filter from all schedules)
  const currentSchedule = schedules.find((s) => s.campaignId === campaignId) || null;

  // Mutations
  const scheduleCampaign = useScheduleCampaign();
  const rescheduleCampaign = useRescheduleCampaign();
  const cancelSchedule = useCancelSchedule();

  const handleSchedule = async (scheduledAt: string, timezone: string) => {
    if (!campaignId) return;

    try {
      await scheduleCampaign.mutateAsync({
        campaignId,
        workspaceId,
        userId,
        scheduledAt,
        timezone,
        sendNotification: true,
      });

      toast.success('Campaign Scheduled', { description: `Campaign will execute at the scheduled time in ${timezone}` });

      navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`);
    } catch (error: any) {
      toast.error('Schedule Failed', { description: error.message || 'Failed to schedule campaign' });
    }
  };

  const handleCancel = (scheduleId: string) => {
    if (!campaignId) return;

    cancelSchedule.mutate(
      { scheduleId, workspaceId, userId },
      {
        onSuccess: () => {
          toast.success('Schedule Cancelled', { description: 'Campaign schedule has been cancelled' });
        },
        onError: (error: any) => {
          toast.error('Cancel Failed', { description: error.message || 'Failed to cancel schedule' });
        },
      }
    );
  };

  const handleReschedule = (scheduleId: string) => {
    // Navigate to reschedule interface (could be same page with edit mode)
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
          <h1 className="text-3xl font-bold tracking-tight">Schedule Campaign</h1>
          <p className="text-muted-foreground">
            Schedule {campaign.name} for future execution
          </p>
        </div>
      </div>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="all-schedules">All Scheduled Campaigns</TabsTrigger>
        </TabsList>

        {/* Schedule Form Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule One-Time Execution</CardTitle>
              <CardDescription>
                Select a date, time, and timezone for campaign execution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduleForm
                campaignId={campaignId || ''}
                onSchedule={handleSchedule}
                onCancel={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`)}
                isSubmitting={scheduleCampaign.isPending}
              />
            </CardContent>
          </Card>

          {/* Current Schedule (if exists) */}
          {currentSchedule && (
            <Card>
              <CardHeader>
                <CardTitle>Current Schedule</CardTitle>
                <CardDescription>This campaign is already scheduled</CardDescription>
              </CardHeader>
              <CardContent>
                <ScheduledCampaignsList
                  schedules={[currentSchedule]}
                  onCancel={handleCancel}
                  onReschedule={handleReschedule}
                  isLoading={false}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* All Schedules Tab */}
        <TabsContent value="all-schedules">
          <Card>
            <CardHeader>
              <CardTitle>All Scheduled Campaigns</CardTitle>
              <CardDescription>
                View and manage all scheduled campaigns in this workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduledCampaignsList
                schedules={schedules}
                onCancel={handleCancel}
                onReschedule={handleReschedule}
                isLoading={schedulesLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
