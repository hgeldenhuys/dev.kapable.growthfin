/**
 * Campaign Triggers Page
 * Configure event-based triggers for automatic campaign execution
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  TriggerBuilder,
  type TriggerConfiguration,
} from '~/components/crm/campaigns/TriggerBuilder';
import {
  useCreateTrigger,
  useDeleteTrigger,
  useCampaignTriggers,
  usePreviewTrigger,
} from '~/hooks/useCampaignScheduling';
import { useCampaign } from '~/hooks/useCampaigns';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CampaignTriggersPage() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | undefined>();

  // Fetch campaign details
  const { data: campaign, isLoading: campaignLoading } = useCampaign(
    campaignId || '',
    workspaceId
  );

  // Fetch triggers
  const { data: triggers = [], isLoading: triggersLoading } = useCampaignTriggers(
    campaignId || '',
    workspaceId
  );

  // Mutations
  const createTrigger = useCreateTrigger();
  const deleteTrigger = useDeleteTrigger();
  const previewTrigger = usePreviewTrigger();

  const handleSave = async (config: TriggerConfiguration) => {
    if (!campaignId) return;

    try {
      await createTrigger.mutateAsync({
        campaignId,
        workspaceId,
        userId,
        name: config.name,
        description: config.description,
        triggerEvent: config.triggerEvent,
        conditions: {
          logic: config.logic,
          conditions: config.conditions,
        },
        maxTriggersPerDay: config.maxTriggersPerDay,
      });

      toast.success('Trigger Created', { description: `Trigger "${config.name}" has been created successfully` });

      setCreateDialogOpen(false);
      setPreviewCount(undefined);
    } catch (error: any) {
      toast.error('Failed to Create Trigger', { description: error.message || 'Failed to create trigger' });
    }
  };

  const handleDeleteClick = (triggerId: string) => {
    setSelectedTriggerId(triggerId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedTriggerId || !campaignId) return;

    deleteTrigger.mutate(
      {
        triggerId: selectedTriggerId,
        campaignId,
        workspaceId,
      },
      {
        onSuccess: () => {
          toast.success('Trigger Deleted', { description: 'Trigger has been deleted successfully' });
          setDeleteDialogOpen(false);
          setSelectedTriggerId(null);
        },
        onError: (error: any) => {
          toast.error('Delete Failed', { description: error.message || 'Failed to delete trigger' });
        },
      }
    );
  };

  const handlePreview = async () => {
    if (!campaignId) return;

    // This would typically be called from the TriggerBuilder component
    // but we're showing the pattern here
    toast.success('Preview', { description: 'Preview functionality coming soon' });
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
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Campaign Triggers</h1>
          <p className="text-muted-foreground">
            Configure event-based triggers for {campaign.name}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Trigger
        </Button>
      </div>

      {/* Triggers List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Triggers</CardTitle>
          <CardDescription>
            Triggers will automatically execute this campaign when conditions are met
          </CardDescription>
        </CardHeader>
        <CardContent>
          {triggersLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : triggers.length === 0 ? (
            <div className="text-center p-12 border rounded-md bg-muted/30">
              <p className="text-muted-foreground mb-4">No triggers configured</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Trigger
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Max/Day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Executions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggers.map((trigger: any) => (
                  <TableRow key={trigger.id}>
                    <TableCell className="font-medium">
                      {trigger.name}
                      {trigger.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {trigger.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{trigger.triggerEvent}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {trigger.conditions?.conditions?.length || 0} condition(s)
                        <div className="text-xs text-muted-foreground">
                          Logic: {trigger.conditions?.logic?.toUpperCase() || 'ALL'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{trigger.maxTriggersPerDay || 1}</TableCell>
                    <TableCell>
                      <Badge variant={trigger.status === 'active' ? 'default' : 'secondary'}>
                        {trigger.status || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell>{trigger.triggerCount || 0}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(trigger.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Trigger Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Campaign Trigger</DialogTitle>
            <DialogDescription>
              Configure conditions to automatically trigger this campaign
            </DialogDescription>
          </DialogHeader>
          <TriggerBuilder
            campaignId={campaignId || ''}
            onSave={handleSave}
            onCancel={() => {
              setCreateDialogOpen(false);
              setPreviewCount(undefined);
            }}
            onPreview={handlePreview}
            isSubmitting={createTrigger.isPending}
            previewCount={previewCount}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trigger?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the trigger. The campaign will no longer execute
              automatically when this trigger's conditions are met. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Trigger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
