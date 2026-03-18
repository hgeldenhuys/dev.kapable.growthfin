/**
 * Lead Create Page
 * Full-page creation experience for new leads
 */

import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { LeadForm } from '~/components/crm/LeadForm';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { useCreateLead } from '~/hooks/useLeads';
import { toast } from 'sonner';
import type { CreateLeadRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function LeadCreatePage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  const createLead = useCreateLead();
  const leadFormRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (data: Partial<CreateLeadRequest>) => {
    try {
      const newLead = await createLead.mutateAsync(data as CreateLeadRequest);
      toast.success('Lead created', { description: 'The new lead has been created successfully.' });
      navigate(`/dashboard/${workspaceId}/crm/leads/${newLead.id}`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCancel = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Lead</h1>
          <p className="text-muted-foreground">Add a new lead to your pipeline</p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardContent className="pt-6">
          <LeadForm
            ref={leadFormRef}
            lead={null}
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
              disabled={createLead.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                leadFormRef.current?.requestSubmit();
              }}
              disabled={createLead.isPending}
            >
              {createLead.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Lead'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
