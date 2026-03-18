/**
 * TemplateDeleteDialog Component
 * Confirmation dialog for soft-deleting a template
 */

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
import { useDeleteTemplate, type Template } from '~/hooks/useTemplates';
import { Loader2 } from 'lucide-react';

interface TemplateDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template;
  workspaceId: string;
  onSuccess?: () => void;
}

export function TemplateDeleteDialog({
  open,
  onOpenChange,
  template,
  workspaceId,
  onSuccess,
}: TemplateDeleteDialogProps) {
  const deleteTemplate = useDeleteTemplate();

  const handleDelete = async () => {
    try {
      await deleteTemplate.mutateAsync({
        templateId: template.id,
        workspaceId,
      });

      toast.success('Template deleted', { description: `${template.name} has been deleted successfully` });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Template</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete <strong>{template.name}</strong>?
            </p>
            <p className="text-destructive font-medium">
              This action cannot be undone. Tasks using this template will be affected.
            </p>
            {template.usageCount && template.usageCount > 0 && (
              <p className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 rounded-md text-sm">
                <strong>Warning:</strong> This template is used by {template.usageCount}{' '}
                {template.usageCount === 1 ? 'task' : 'tasks'}. They will show this template as
                deleted.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTemplate.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteTemplate.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleteTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
