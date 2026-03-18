/**
 * CSV Import Wizard Route
 * Multi-step wizard for importing leads from CSV files
 */

import { useState } from 'react';
import { useNavigate, useLoaderData } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { ImportCSVWizard } from '~/components/crm/leads/ImportCSVWizard';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { getSession } from '~/lib/auth';
import type { Route } from './+types/dashboard.$workspaceId.crm.leads.import._index';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  return {
    userId: session.user.id,
  };
}

export default function LeadImportPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const { userId } = useLoaderData<typeof loader>();

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads`);
  };

  const handleComplete = (importId: string, listId?: string) => {
    // Navigate to the list page if a list was created, otherwise go to leads page
    if (listId) {
      navigate(`/dashboard/${workspaceId}/crm/lists/${listId}`);
    } else {
      navigate(`/dashboard/${workspaceId}/crm/leads?import=${importId}`);
    }
  };

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Import Leads from CSV</h1>
          <p className="text-muted-foreground">
            Upload a CSV file and map columns to lead fields
          </p>
        </div>
      </div>

      {/* Import Wizard */}
      <Card>
        <CardHeader>
          <CardTitle>CSV Import Wizard</CardTitle>
          <CardDescription>
            Follow the steps to upload, validate, and import your leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportCSVWizard
            workspaceId={workspaceId}
            userId={userId}
            onComplete={handleComplete}
            onCancel={handleBack}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
