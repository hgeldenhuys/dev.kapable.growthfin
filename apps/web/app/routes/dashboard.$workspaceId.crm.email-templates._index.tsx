import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
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
import { toast } from 'sonner';
import { useDeleteEmailTemplate } from '~/hooks/useEmailTemplates';
import { Plus, Mail, Edit, Trash2, Loader2 } from 'lucide-react';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function EmailTemplatesIndex() {
  const { workspaceId } = useParams();
  const deleteMutation = useDeleteEmailTemplate();
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates', workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/email-templates?workspaceId=${workspaceId}`
      );
      if (!response.ok) {
        throw new Error('Failed to load templates');
      }
      return response.json();
    },
    enabled: !!workspaceId,
  });

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ templateId: deleteTarget.id, workspaceId });
      toast.success('Template Deleted', { description: `${deleteTarget.name} has been deleted` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Delete Failed', { description: message });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage reusable email templates with variable substitution
          </p>
        </div>
        <Button asChild>
          <Link to={`/dashboard/${workspaceId}/crm/email-templates/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No email templates yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first email template to streamline your communication
            </p>
            <Button asChild>
              <Link to={`/dashboard/${workspaceId}/crm/email-templates/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template: EmailTemplate) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {template.subject}
                    </CardDescription>
                  </div>
                  <Badge variant={template.isActive ? 'default' : 'secondary'}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {template.category && (
                  <Badge variant="outline" className="mb-3">
                    {template.category}
                  </Badge>
                )}

                {template.variables.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Variables:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map((variable) => (
                        <Badge key={variable} variant="secondary" className="text-xs">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-sm text-muted-foreground mb-4">
                  <div
                    className="line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: template.body }}
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link to={`/dashboard/${workspaceId}/crm/email-templates/${template.id}`}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(template);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
