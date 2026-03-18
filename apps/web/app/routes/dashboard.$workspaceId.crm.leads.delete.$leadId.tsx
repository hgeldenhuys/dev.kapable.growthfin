/**
 * Lead Delete Confirmation Page
 * Full-page delete confirmation for leads
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { useNavigate, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { ArrowLeft, Loader2, AlertTriangle, Mail, Phone, Building2, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useDeleteLead } from '~/hooks/useLeads';
import { toast } from 'sonner';
import { LeadStatusBadge } from '~/components/crm/LeadStatusBadge';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for lead delete page
 * Fetches lead from database for server-side rendering
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { db, crmLeads, eq, and } = await import('~/lib/db.server');

  const { workspaceId, leadId } = params;

  if (!workspaceId || !leadId) {
    throw new Response('Workspace ID and Lead ID are required', { status: 400 });
  }

  const [lead] = await db
    .select()
    .from(crmLeads)
    .where(and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)))
    .limit(1);

  if (!lead) {
    throw new Response('Lead not found', { status: 404 });
  }

  return { lead };
}

export default function LeadDeletePage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  // Get data from loader
  const { lead } = useLoaderData<typeof loader>();
  const leadId = lead.id;

  const deleteLead = useDeleteLead();

  const handleDelete = async () => {
    if (!lead) return;

    try {
      await deleteLead.mutateAsync({
        leadId: lead.id,
        workspaceId,
      });
      toast.success('Lead deleted', { description: 'The lead has been deleted successfully.' });
      navigate(`/dashboard/${workspaceId}/crm/leads`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCancel = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads/${leadId}`);
  };

  // Loading and error states are handled by React Router's loader pattern
  // If we reach this point, lead is guaranteed to exist

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Delete Lead?</h1>
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
              You are about to permanently delete this lead. This action cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h3 className="font-semibold">Lead Details:</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Name:</dt>
                <dd className="font-semibold">{lead.firstName} {lead.lastName}</dd>
              </div>
              {lead.email && (
                <div className="flex gap-2">
                  <dt className="font-medium min-w-32">Email:</dt>
                  <dd className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {lead.email}
                  </dd>
                </div>
              )}
              {lead.phone && (
                <div className="flex gap-2">
                  <dt className="font-medium min-w-32">Phone:</dt>
                  <dd className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {lead.phone}
                  </dd>
                </div>
              )}
              {lead.company && (
                <div className="flex gap-2">
                  <dt className="font-medium min-w-32">Company:</dt>
                  <dd className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    {lead.company}
                  </dd>
                </div>
              )}
              {lead.title && (
                <div className="flex gap-2">
                  <dt className="font-medium min-w-32">Title:</dt>
                  <dd>{lead.title}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Source:</dt>
                <dd className="capitalize">{lead.source.replace('_', ' ')}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Status:</dt>
                <dd><LeadStatusBadge status={lead.status} /></dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Score:</dt>
                <dd className="flex items-center gap-2">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{lead.leadScore}</span> / 100
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={deleteLead.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLead.isPending}
            >
              {deleteLead.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Lead'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
