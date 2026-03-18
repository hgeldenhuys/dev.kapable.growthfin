/**
 * New Email Template Route
 * Create a new email template
 */

import { useNavigate, useParams, useLoaderData } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { EmailTemplateForm } from '~/components/crm/email-templates/EmailTemplateForm';
import { getSession } from '~/lib/auth';
import type { Route } from './+types/dashboard.$workspaceId.crm.email-templates.new';
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

export default function NewEmailTemplate() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userId } = useLoaderData<typeof loader>();

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  const handleSuccess = () => {
    navigate(`/dashboard/${workspaceId}/crm/email-templates`);
  };

  const handleCancel = () => {
    navigate(`/dashboard/${workspaceId}/crm/email-templates`);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Email Template</h1>
          <p className="text-muted-foreground mt-1">
            Create a reusable email template with variable substitution
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <CardDescription>
            Define your email template content. Use {'{{variableName}}'} syntax for dynamic content
            that will be replaced with contact data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailTemplateForm
            workspaceId={workspaceId}
            userId={userId}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
