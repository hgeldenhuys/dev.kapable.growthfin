/**
 * Lead Edit Page
 * Full-page editing experience for leads
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { useRef } from 'react';
import { useNavigate, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { LeadForm } from '~/components/crm/LeadForm';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { useUpdateLead } from '~/hooks/useLeads';
import { toast } from 'sonner';
import type { UpdateLeadRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for lead edit page
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

export default function LeadEditPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Get data from loader
  const { lead } = useLoaderData<typeof loader>();
  const leadId = lead.id;

  const updateLead = useUpdateLead();
  const leadFormRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (data: Partial<UpdateLeadRequest>) => {
    if (!lead) return;

    try {
      await updateLead.mutateAsync({
        leadId: lead.id,
        workspaceId,
        data: data as UpdateLeadRequest,
      });
      toast.success('Lead updated', { description: 'The lead has been updated successfully.' });
      navigate(`/dashboard/${workspaceId}/crm/leads/${leadId}`);
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads/${leadId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Lead</h1>
          <p className="text-muted-foreground">{lead.firstName} {lead.lastName}</p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardContent className="pt-6">
          <LeadForm
            ref={leadFormRef}
            lead={lead}
            onSubmit={handleSubmit}
            workspaceId={workspaceId}
            userId={userId}
          />

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={updateLead.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                leadFormRef.current?.requestSubmit();
              }}
              disabled={updateLead.isPending}
            >
              {updateLead.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
