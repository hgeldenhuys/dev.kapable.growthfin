/**
 * Account Detail Page
 * Detailed view of a single account
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { useState } from 'react';
import { useNavigate, useLoaderData, Link } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import {
  ArrowLeft,
  Loader2,
  Edit,
  Trash2,
  Building2,
  Users,
  DollarSign,
  Globe,
  Calendar,
  TrendingUp,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { AccountStatusBadge } from '~/components/crm/AccountStatusBadge';
import { AccountForm } from '~/components/crm/AccountForm';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { useUpdateAccount, useDeleteAccount } from '~/hooks/useAccounts';
import { toast } from 'sonner';
import { WorkItemsPanel } from '~/components/crm/work-items';
import type { UpdateAccountRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for account detail page
 * Fetches account from database for server-side rendering
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { db, crmAccounts, crmContacts, crmOpportunities, eq, and, desc } = await import('~/lib/db.server');

  const { workspaceId, accountId } = params;

  if (!workspaceId || !accountId) {
    throw new Response('Workspace ID and Account ID are required', { status: 400 });
  }

  const [[account], relatedContacts, relatedOpportunities] = await Promise.all([
    db
      .select()
      .from(crmAccounts)
      .where(and(eq(crmAccounts.id, accountId), eq(crmAccounts.workspaceId, workspaceId)))
      .limit(1),
    db
      .select()
      .from(crmContacts)
      .where(and(eq(crmContacts.accountId, accountId), eq(crmContacts.workspaceId, workspaceId)))
      .orderBy(desc(crmContacts.createdAt)),
    db
      .select()
      .from(crmOpportunities)
      .where(and(eq(crmOpportunities.accountId, accountId), eq(crmOpportunities.workspaceId, workspaceId)))
      .orderBy(desc(crmOpportunities.createdAt)),
  ]);

  if (!account) {
    throw new Response('Account not found', { status: 404 });
  }

  return { account, relatedContacts, relatedOpportunities };
}

export default function AccountDetailPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Get data from loader
  const { account, relatedContacts, relatedOpportunities } = useLoaderData<typeof loader>();
  const accountId = account.id;

  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/accounts`);
  };

  const handleEdit = () => {
    setEditDialogOpen(true);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (data: Partial<UpdateAccountRequest>) => {
    if (!account) return;

    try {
      await updateAccount.mutateAsync({
        accountId: account.id,
        workspaceId,
        data: data as UpdateAccountRequest,
      });
      toast.success('Account updated', { description: 'The account has been updated successfully.' });
      setEditDialogOpen(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!account) return;

    try {
      await deleteAccount.mutateAsync({
        accountId: account.id,
        workspaceId,
      });
      toast.success('Account deleted', { description: 'The account has been deleted successfully.' });
      navigate(`/dashboard/${workspaceId}/crm/accounts`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Loading and error states are handled by React Router's loader pattern
  // If we reach this point, account is guaranteed to exist

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{account.name}</h1>
            <p className="text-muted-foreground">Account Details</p>
          </div>
        </div>
        <div className="flex gap-2">
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

      {/* Account Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status */}
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-2">
                  <AccountStatusBadge status={account.status} />
                </div>
              </div>

              {/* Industry */}
              {account.industry && (
                <div>
                  <Label className="text-muted-foreground">Industry</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{account.industry}</span>
                  </div>
                </div>
              )}

              {/* Employee Count */}
              {account.employeeCount !== null && (
                <div>
                  <Label className="text-muted-foreground">Employee Count</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{account.employeeCount.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Annual Revenue */}
              {account.annualRevenue && (
                <div>
                  <Label className="text-muted-foreground">Annual Revenue</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      ${parseFloat(account.annualRevenue).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Website */}
              {account.website && (
                <div>
                  <Label className="text-muted-foreground">Website</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={account.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline"
                    >
                      {account.website}
                    </a>
                  </div>
                </div>
              )}

              {/* Created */}
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(account.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" variant="outline" onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Account
            </Button>
            {account.website && (
              <Button className="w-full" variant="outline" asChild>
                <a href={account.website} target="_blank" rel="noopener noreferrer">
                  <Globe className="mr-2 h-4 w-4" />
                  Visit Website
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Related Contacts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Related Contacts ({relatedContacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {relatedContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts linked to this account.</p>
          ) : (
            <div className="space-y-2">
              {relatedContacts.map((contact) => (
                <Link
                  key={contact.id}
                  to={`/dashboard/${workspaceId}/crm/contacts/${contact.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{contact.firstName} {contact.lastName}</div>
                      {contact.email && (
                        <div className="text-xs text-muted-foreground">{contact.email}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {contact.title && (
                      <span className="text-xs text-muted-foreground">{contact.title}</span>
                    )}
                    <Badge variant={contact.status === 'active' ? 'default' : 'secondary'}>
                      {contact.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Related Opportunities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Related Opportunities ({relatedOpportunities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {relatedOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opportunities linked to this account.</p>
          ) : (
            <div className="space-y-2">
              {relatedOpportunities.map((opp) => (
                <Link
                  key={opp.id}
                  to={`/dashboard/${workspaceId}/crm/opportunities/${opp.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{opp.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {opp.stage.replace(/_/g, ' ')} &middot; {opp.probability}% probability
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      ${parseFloat(opp.amount || '0').toLocaleString()}
                    </span>
                    <Badge variant={opp.status === 'won' ? 'default' : opp.status === 'lost' ? 'destructive' : 'secondary'}>
                      {opp.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work Items Panel (UI-001) */}
      <WorkItemsPanel
        entityType="account"
        entityId={accountId}
        workspaceId={workspaceId}
        title="Work Items"
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update account information</DialogDescription>
          </DialogHeader>
          <AccountForm
            account={account}
            onSubmit={handleSubmit}
            workspaceId={workspaceId}
            userId={userId}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={updateAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="account-form"
              disabled={updateAccount.isPending}
            >
              {updateAccount.isPending ? (
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
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{account.name}"? This action cannot be undone.
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
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
