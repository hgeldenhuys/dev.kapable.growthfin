/**
 * Delete Email Template Confirmation Route
 * Confirm deletion of an email template
 */

import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { toast } from 'sonner';
import { useEmailTemplate, useDeleteEmailTemplate } from '~/hooks/useEmailTemplates';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function DeleteEmailTemplate() {
  const { workspaceId, id: templateId } = useParams();
  const navigate = useNavigate();
  const deleteMutation = useDeleteEmailTemplate();

  const { data: template, isLoading, error } = useEmailTemplate(
    workspaceId || '',
    templateId || ''
  );

  if (!workspaceId || !templateId) {
    return <div>Workspace ID and Template ID required</div>;
  }

  const handleCancel = () => {
    navigate(`/dashboard/${workspaceId}/crm/email-templates`);
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ templateId, workspaceId });
      toast.success('Template Deleted', { description: `${template?.name || 'Template'} has been deleted` });
      navigate(`/dashboard/${workspaceId}/crm/email-templates`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Delete Failed', { description: message });
    }
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
    <div className="container mx-auto py-8 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Delete Email Template</h1>
          <p className="text-muted-foreground mt-1">Confirm deletion</p>
        </div>
      </div>

      {/* Confirmation Card */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle>Are you sure?</CardTitle>
              <CardDescription>
                This action cannot be undone.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{template.name}</span>
              <Badge variant={template.isActive ? 'default' : 'secondary'}>
                {template.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{template.subject}</p>
            {template.category && (
              <Badge variant="outline">{template.category}</Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Deleting this template will remove it from your workspace. Any campaigns
            using this template will not be affected, but you won't be able to use
            this template for new campaigns.
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Template'}
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
