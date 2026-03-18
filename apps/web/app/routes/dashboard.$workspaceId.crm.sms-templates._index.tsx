import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Plus, MessageSquare, Edit, Trash2, Loader2 } from 'lucide-react';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

type SmsTemplate = {
  id: string;
  name: string;
  body: string;
  variables: string[];
  category?: string;
  maxSegments: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function getCharacterCount(text: string): number {
  return text.length;
}

function getSegmentCount(text: string): number {
  const length = text.length;
  if (length <= 160) return 1;
  return Math.ceil(length / 153);
}

export default function SmsTemplatesIndex() {
  const { workspaceId } = useParams();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['sms-templates', workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/sms-templates?workspaceId=${workspaceId}`
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

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SMS Templates</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage reusable SMS templates with variable substitution
          </p>
        </div>
        <Button asChild>
          <Link to={`/dashboard/${workspaceId}/crm/sms-templates/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No SMS templates yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first SMS template to streamline your messaging
            </p>
            <Button asChild>
              <Link to={`/dashboard/${workspaceId}/crm/sms-templates/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template: SmsTemplate) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {getCharacterCount(template.body)} chars · {getSegmentCount(template.body)} segment(s)
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

                {template.variables && template.variables.length > 0 && (
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
                  <p className="line-clamp-3">{template.body}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <span>Max segments: {template.maxSegments}</span>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link to={`/dashboard/${workspaceId}/crm/sms-templates/${template.id}`}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/dashboard/${workspaceId}/crm/sms-templates/${template.id}/delete`}>
                      <Trash2 className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
