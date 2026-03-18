/**
 * Campaign Delete Confirmation Page
 * Full-page delete confirmation for campaigns
 */

import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Loader2, AlertTriangle, Users, Calendar, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Label } from '~/components/ui/label';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useCampaign, useDeleteCampaign, useCampaignStats } from '~/hooks/useCampaigns';
import { toast } from 'sonner';
import { CampaignStatusBadge } from '~/components/campaigns/CampaignStatusBadge';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CampaignDeletePage() {
  const params = useParams();
  const navigate = useNavigate();
  const campaignId = params.campaignId!;
  const workspaceId = useWorkspaceId();

  const { data: campaign, isLoading } = useCampaign(campaignId, workspaceId);
  const { data: stats } = useCampaignStats(campaignId, workspaceId);
  const deleteCampaign = useDeleteCampaign();

  const handleDelete = async () => {
    if (!campaign) return;

    try {
      await deleteCampaign.mutateAsync({
        campaignId: campaign.id,
        workspaceId,
      });
      toast.success('Campaign deleted', { description: 'The campaign has been deleted successfully.' });
      navigate(`/dashboard/${workspaceId}/crm/campaigns`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCancel = () => {
    navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`);
  };

  if (isLoading || !campaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Prevent deletion of active campaigns
  if (campaign.status === 'active' || campaign.status === 'paused') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Cannot Delete Campaign</h1>
            <p className="text-muted-foreground">Active campaigns must be cancelled first</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                This campaign is currently {campaign.status}. You must cancel or complete the campaign before deleting it.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                onClick={handleCancel}
              >
                Back to Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Delete Campaign?</h1>
          <p className="text-muted-foreground">This action cannot be undone</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Confirm Deletion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              You are about to permanently delete this campaign{stats && stats.totalRecipients > 0 ? ' and all associated recipient data' : ''}. This action cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h3 className="font-semibold">Campaign Details:</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Name:</dt>
                <dd className="font-semibold">{campaign.name}</dd>
              </div>
              {campaign.description && (
                <div className="flex gap-2">
                  <dt className="font-medium min-w-32">Description:</dt>
                  <dd>{campaign.description}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Type:</dt>
                <dd className="capitalize">{campaign.type.replace('_', ' ')}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Objective:</dt>
                <dd className="capitalize">{campaign.objective.replace('_', ' ')}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Status:</dt>
                <dd><CampaignStatusBadge status={campaign.status} /></dd>
              </div>
              {stats && (
                <>
                  <div className="flex gap-2">
                    <dt className="font-medium min-w-32">Recipients:</dt>
                    <dd className="flex items-center gap-2">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {stats.totalRecipients}
                    </dd>
                  </div>
                  {stats.sent > 0 && (
                    <>
                      <div className="flex gap-2">
                        <dt className="font-medium min-w-32">Sent:</dt>
                        <dd className="flex items-center gap-2">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          {stats.sent} ({((stats.sent / stats.totalRecipients) * 100).toFixed(1)}%)
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="font-medium min-w-32">Open Rate:</dt>
                        <dd>{stats.openRate.toFixed(1)}%</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="font-medium min-w-32">Click Rate:</dt>
                        <dd>{stats.clickRate.toFixed(1)}%</dd>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Created:</dt>
                <dd className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {new Date(campaign.createdAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {stats && stats.sent > 0 && (
            <Alert>
              <AlertDescription>
                This campaign has sent {stats.sent} message{stats.sent === 1 ? '' : 's'}. Deleting it will remove all performance data and recipient history.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={deleteCampaign.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteCampaign.isPending}
            >
              {deleteCampaign.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Campaign'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
