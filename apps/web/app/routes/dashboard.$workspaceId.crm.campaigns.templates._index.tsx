/**
 * Campaign Templates Gallery Route
 * Browse, create, and manage campaign templates
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { TemplateGallery } from '~/components/crm/templates/TemplateGallery';
import { TemplateDetails } from '~/components/crm/templates/TemplateDetails';
import { TemplateForm } from '~/components/crm/templates/TemplateForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
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
import {
  useDeleteTemplate,
  useTemplateUsed,
  type CampaignTemplate,
} from '~/hooks/useCampaignTemplates';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CampaignTemplatesRoute() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const deleteMutation = useDeleteTemplate();
  const useTemplateMutation = useTemplateUsed();

  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<CampaignTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<CampaignTemplate | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Check URL parameter to open create form (triggered from side panel)
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateForm(true);
      // Remove the param after opening
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  const handleUseTemplate = async (template: CampaignTemplate) => {
    try {
      // Mark template as used
      await useTemplateMutation.mutateAsync({
        templateId: template.id,
        workspaceId,
      });

      // Navigate to campaign creation with template data
      navigate(`/dashboard/${workspaceId}/crm/campaigns/new`, {
        state: { templateData: template.templateData },
      });

      toast.success('Template Selected', { description: 'Creating campaign from template...' });
    } catch (error: any) {
      toast.error('Error', { description: error.message });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;

    try {
      await deleteMutation.mutateAsync({
        templateId: deletingTemplate.id,
        workspaceId,
      });

      toast.success('Template Deleted', { description: `${deletingTemplate.name} has been deleted` });

      setDeletingTemplate(null);
    } catch (error: any) {
      toast.error('Delete Failed', { description: error.message });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <TemplateGallery
        workspaceId={workspaceId}
        onUseTemplate={handleUseTemplate}
        onPreviewTemplate={(template) => setPreviewTemplate(template.id)}
        onEditTemplate={(template) => setEditingTemplate(template)}
        onDeleteTemplate={(template) => setDeletingTemplate(template)}
        onCreateNew={() => setShowCreateForm(true)}
      />

      {/* Preview Dialog */}
      {previewTemplate && (
        <TemplateDetails
          templateId={previewTemplate}
          workspaceId={workspaceId}
          open={!!previewTemplate}
          onOpenChange={(open) => !open && setPreviewTemplate(null)}
          onUse={handleUseTemplate}
          onEdit={(template) => {
            setPreviewTemplate(null);
            setEditingTemplate(template);
          }}
        />
      )}

      {/* Create/Edit Form Dialog */}
      <Dialog
        open={showCreateForm || !!editingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateForm(false);
            setEditingTemplate(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update template details and configuration'
                : 'Create a reusable campaign template'}
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            workspaceId={workspaceId}
            template={editingTemplate || undefined}
            onSuccess={() => {
              setShowCreateForm(false);
              setEditingTemplate(null);
            }}
            onCancel={() => {
              setShowCreateForm(false);
              setEditingTemplate(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingTemplate}
        onOpenChange={(open) => !open && setDeletingTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTemplate?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
