/**
 * Edit Email Template Route
 * View and edit an existing email template
 */

import { useNavigate, useParams, useLoaderData } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { EmailTemplateForm } from '~/components/crm/email-templates/EmailTemplateForm';
import { useEmailTemplate } from '~/hooks/useEmailTemplates';
import { getSession } from '~/lib/auth';
import type { Route } from './+types/dashboard.$workspaceId.crm.email-templates.$id';
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

export default function EditEmailTemplate() {
  const { workspaceId, id: templateId } = useParams();
  const navigate = useNavigate();
  const { userId } = useLoaderData<typeof loader>();

  const { data: template, isLoading, error } = useEmailTemplate(
    workspaceId || '',
    templateId || ''
  );

  if (!workspaceId || !templateId) {
    return <div>Workspace ID and Template ID required</div>;
  }

  const handleSuccess = () => {
    navigate(`/dashboard/${workspaceId}/crm/templates`);
  };

  const handleCancel = () => {
    navigate(`/dashboard/${workspaceId}/crm/templates`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Template Not Found</h1>
            <p className="text-muted-foreground mt-1">
              The email template you're looking for doesn't exist or has been deleted.
            </p>
          </div>
        </div>
        <Button onClick={handleCancel}>Back to Templates</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Email Template</h1>
          <p className="text-muted-foreground mt-1">
            Update "{template.name}"
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <CardDescription>
            Modify your email template content. Use {'{{variableName}}'} syntax for dynamic content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailTemplateForm
            workspaceId={workspaceId}
            userId={userId}
            template={template}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
