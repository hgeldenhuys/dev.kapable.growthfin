/**
 * Opportunity Detail Page
 * View and manage a single opportunity
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { useState } from 'react';
import { useNavigate, useLoaderData, Link } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import {
  Loader2,
  ArrowLeft,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  Building2,
  User,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { OpportunityStageBadge } from '~/components/crm/OpportunityStageBadge';
import { OpportunityStatusBadge } from '~/components/crm/OpportunityStatusBadge';
import { OpportunityForm } from '~/components/crm/OpportunityForm';
import { OpportunityOutcomePanel } from '~/components/crm/opportunities/OpportunityOutcomePanel';
import { WorkItemsPanel } from '~/components/crm/work-items';
import {
  useUpdateOpportunity,
  useDeleteOpportunity,
  useCloseOpportunity,
} from '~/hooks/useOpportunities';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { OPPORTUNITY_STAGES, WIN_REASONS, LOSS_REASONS, type UpdateOpportunityRequest } from '~/types/crm';
import { format } from 'date-fns';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for opportunity detail page
 * Fetches opportunity from database for server-side rendering
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { db, crmOpportunities, eq, and } = await import('~/lib/db.server');

  const { workspaceId, opportunityId } = params;

  if (!workspaceId || !opportunityId) {
    throw new Response('Workspace ID and Opportunity ID are required', { status: 400 });
  }

  const [opportunity] = await db
    .select()
    .from(crmOpportunities)
    .where(and(eq(crmOpportunities.id, opportunityId), eq(crmOpportunities.workspaceId, workspaceId)))
    .limit(1);

  if (!opportunity) {
    throw new Response('Opportunity not found', { status: 404 });
  }

  return { opportunity };
}

export default function OpportunityDetailPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Get data from loader
  const { opportunity } = useLoaderData<typeof loader>();

  const updateOpportunity = useUpdateOpportunity();
  const deleteOpportunity = useDeleteOpportunity();
  const closeOpportunity = useCloseOpportunity();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeType, setCloseType] = useState<'won' | 'lost'>('won');
  const [closeData, setCloseData] = useState({
    reason: '',
    actualCloseDate: new Date().toISOString().split('T')[0],
    amount: '',
  });

  const handleEdit = () => {
    setEditDialogOpen(true);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleClose = (type: 'won' | 'lost') => {
    setCloseType(type);
    setCloseData({
      reason: '',
      actualCloseDate: new Date().toISOString().split('T')[0],
      amount: opportunity?.amount || '0',
    });
    setCloseDialogOpen(true);
  };

  const handleEditSubmit = async (data: Partial<UpdateOpportunityRequest>) => {
    if (!opportunity) return;

    try {
      await updateOpportunity.mutateAsync({
        opportunityId: opportunity.id,
        workspaceId,
        data: data as UpdateOpportunityRequest,
      });
      toast.success('Opportunity updated', { description: 'The opportunity has been updated successfully.' });
      setEditDialogOpen(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!opportunity) return;

    try {
      await deleteOpportunity.mutateAsync({
        opportunityId: opportunity.id,
        workspaceId,
      });
      toast.success('Opportunity deleted', { description: 'The opportunity has been deleted successfully.' });
      navigate(`/dashboard/${workspaceId}/crm/opportunities`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCloseConfirm = async () => {
    if (!opportunity) return;

    try {
      await closeOpportunity.mutateAsync({
        opportunityId: opportunity.id,
        data: {
          workspaceId,
          status: closeType,
          winLossReason: closeData.reason,
          actualCloseDate: closeData.actualCloseDate,
          amount: closeData.amount,
        },
      });
      toast.success(`Opportunity ${closeType === 'won' ? 'won' : 'lost'}`, { description: `The opportunity has been marked as ${closeType}.` });
      setCloseDialogOpen(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(num);
  };

  // Loading and error states are handled by React Router's loader pattern
  // If we reach this point, opportunity is guaranteed to exist

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/opportunities`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{opportunity.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <OpportunityStageBadge stage={opportunity.stage} />
              <OpportunityStatusBadge status={opportunity.status} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {opportunity.status === 'open' && (
            <>
              <Button variant="outline" onClick={() => handleClose('won')}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark as Won
              </Button>
              <Button variant="outline" onClick={() => handleClose('lost')}>
                <XCircle className="mr-2 h-4 w-4" />
                Mark as Lost
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(opportunity.amount || '0')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Probability</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{opportunity.probability}%</div>
            <p className="text-xs text-muted-foreground">
              Weighted: {formatCurrency((parseFloat(opportunity.amount || '0') * opportunity.probability / 100).toString())}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expected Close</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {opportunity.expectedCloseDate
                ? format(new Date(opportunity.expectedCloseDate), 'MMM d, yyyy')
                : 'Not set'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {format(new Date(opportunity.createdAt), 'MMM d, yyyy')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Opportunity Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Stage</Label>
              <div>
                <OpportunityStageBadge stage={opportunity.stage} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Status</Label>
              <div>
                <OpportunityStatusBadge status={opportunity.status} />
              </div>
            </div>

            {opportunity.leadSource && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Lead Source</Label>
                <p className="capitalize">{opportunity.leadSource.replace('_', ' ')}</p>
              </div>
            )}

            {opportunity.actualCloseDate && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Actual Close Date</Label>
                <p>{format(new Date(opportunity.actualCloseDate), 'MMM d, yyyy')}</p>
              </div>
            )}

            {opportunity.winLossReason && (
              <div className="space-y-2 md:col-span-2">
                <Label className="text-muted-foreground">
                  {opportunity.status === 'won' ? 'Win' : 'Loss'} Reason
                </Label>
                <p>{opportunity.winLossReason}</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-muted-foreground">Related Records</Label>
            <div className="flex gap-4">
              {opportunity.accountId ? (
                <Link
                  to={`/dashboard/${workspaceId}/crm/accounts/${opportunity.accountId}`}
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Account linked</span>
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">No account linked</span>
              )}
              {opportunity.contactId ? (
                <Link
                  to={`/dashboard/${workspaceId}/crm/contacts/${opportunity.contactId}`}
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <User className="h-4 w-4" />
                  <span>Contact linked</span>
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">No contact linked</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outcome Panel - State Machine UI */}
      <OpportunityOutcomePanel
        opportunity={opportunity}
        workspaceId={workspaceId}
        userId={userId}
      />

      {/* Work Items Panel (UI-001) */}
      <WorkItemsPanel
        entityType="opportunity"
        entityId={opportunity.id}
        workspaceId={workspaceId}
        title="Work Items"
      />

      {/* Stage Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Stage Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {OPPORTUNITY_STAGES.filter(s => s.value !== 'closed_lost').map((stage, index) => {
              const isActive = stage.value === opportunity.stage;
              const isPast = OPPORTUNITY_STAGES.findIndex(s => s.value === opportunity.stage) > index;

              return (
                <div key={stage.value} className="flex-1">
                  <div className="flex items-center">
                    <div
                      className={`h-2 flex-1 rounded-full ${
                        isPast || isActive ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  </div>
                  <div className="text-xs text-center mt-2">
                    <div className={isActive ? 'font-bold text-primary' : 'text-muted-foreground'}>
                      {stage.label}
                    </div>
                    <div className="text-muted-foreground">{stage.probability}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Opportunity</DialogTitle>
            <DialogDescription>Update opportunity information</DialogDescription>
          </DialogHeader>
          <OpportunityForm
            opportunity={opportunity}
            onSubmit={handleEditSubmit}
            workspaceId={workspaceId}
            userId={userId}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={updateOpportunity.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="opportunity-form"
              disabled={updateOpportunity.isPending}
            >
              {updateOpportunity.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opportunity?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{opportunity.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark as {closeType === 'won' ? 'Won' : 'Lost'}
            </DialogTitle>
            <DialogDescription>
              {closeType === 'won'
                ? 'Congratulations! Close this opportunity as won.'
                : 'Close this opportunity as lost and record the reason.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">
                {closeType === 'won' ? 'Win' : 'Loss'} Reason
              </Label>
              <Select
                value={closeData.reason}
                onValueChange={(value) => setCloseData(prev => ({ ...prev, reason: value }))}
              >
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {(closeType === 'won' ? WIN_REASONS : LOSS_REASONS).map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="actualCloseDate">Actual Close Date</Label>
              <Input
                id="actualCloseDate"
                type="date"
                value={closeData.actualCloseDate}
                onChange={(e) => setCloseData(prev => ({ ...prev, actualCloseDate: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Final Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={closeData.amount}
                onChange={(e) => setCloseData(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseDialogOpen(false)}
              disabled={closeOpportunity.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCloseConfirm}
              disabled={closeOpportunity.isPending || !closeData.reason}
              className={closeType === 'won' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {closeOpportunity.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                `Mark as ${closeType === 'won' ? 'Won' : 'Lost'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
