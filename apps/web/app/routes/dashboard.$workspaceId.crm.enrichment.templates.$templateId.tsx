/**
 * Template Detail Page
 * View and manage a single enrichment template
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Loader2, Wand2, Edit, Trash2, Copy, TestTube2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useTemplate, useDuplicateTemplate } from '~/hooks/useTemplates';
import { toast } from 'sonner';
import { TemplateFormModal } from '~/components/crm/enrichment/templates/TemplateFormModal';
import { TemplateDeleteDialog } from '~/components/crm/enrichment/templates/TemplateDeleteDialog';
import { TemplateDryRunModal } from '~/components/crm/enrichment/templates/TemplateDryRunModal';
import { formatDistanceToNow } from 'date-fns';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function TemplateDetailPage() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const workspaceId = useWorkspaceId();
  const { data: template, isLoading } = useTemplate(templateId!, workspaceId);
  const duplicateTemplate = useDuplicateTemplate();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDryRunDialog, setShowDryRunDialog] = useState(false);

  const handleDuplicate = async () => {
    if (!template) return;

    try {
      const newTemplate = await duplicateTemplate.mutateAsync({
        templateId: template.id,
        workspaceId,
      });

      toast.success('Template duplicated', { description: 'A copy of the template has been created' });

      navigate(`/dashboard/${workspaceId}/crm/enrichment/templates/${newTemplate.id}`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleDeleteSuccess = () => {
    navigate(`/dashboard/${workspaceId}/crm/enrichment/templates`);
  };

  const formatCost = (cost: number | null) => {
    if (cost === null || cost === undefined) return 'No cost data';
    if (cost < 0.001) return `$${cost.toFixed(5)}`;
    if (cost < 1) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Template not found</h2>
        <p className="text-muted-foreground mb-4">
          The template you're looking for doesn't exist or has been deleted
        </p>
        <Button onClick={() => navigate(`/dashboard/${workspaceId}/crm/enrichment/templates`)}>
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/enrichment/templates`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Templates
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{template.name}</h1>
              <Badge variant="outline">{template.type}</Badge>
            </div>
            <p className="text-muted-foreground">
              {template.description || 'No description provided'}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDryRunDialog(true)}>
              <TestTube2 className="mr-2 h-4 w-4" />
              Test
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              disabled={duplicateTemplate.isPending}
            >
              {duplicateTemplate.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Model</span>
              <p className="font-medium">{template.model}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Temperature</span>
              <p className="font-medium">{template.temperature}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Max Tokens</span>
              <p className="font-medium">{template.maxTokens || 'Default'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Est. Cost / Contact</span>
              <p className="font-medium">{formatCost(template.estimatedCostPerContact)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Card */}
      <Card>
        <CardHeader>
          <CardTitle>AI Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-md font-mono text-sm whitespace-pre-wrap">
            {template.prompt}
          </div>
        </CardContent>
      </Card>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Usage Count</span>
              <p className="font-medium">
                {template.usageCount || 0} {(template.usageCount || 0) === 1 ? 'time' : 'times'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Last Used</span>
              <p className="font-medium">
                {template.lastUsedAt
                  ? formatDistanceToNow(new Date(template.lastUsedAt), { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Last Tested</span>
              <p className="font-medium">
                {template.lastTestedAt
                  ? formatDistanceToNow(new Date(template.lastTestedAt), { addSuffix: true })
                  : 'Never tested'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Created</span>
              <p className="font-medium">
                {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <span className="text-sm text-muted-foreground block mb-2">Template ID</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">{template.id}</code>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <TemplateFormModal
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        workspaceId={workspaceId}
        template={template}
      />

      {/* Delete Dialog */}
      <TemplateDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        template={template}
        workspaceId={workspaceId}
        onSuccess={handleDeleteSuccess}
      />

      {/* Dry Run Dialog */}
      <TemplateDryRunModal
        open={showDryRunDialog}
        onOpenChange={setShowDryRunDialog}
        template={template}
        workspaceId={workspaceId}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
