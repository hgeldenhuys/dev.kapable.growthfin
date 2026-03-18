/**
 * CSV Import Wizard Route for Contacts
 * Multi-step fullscreen wizard for importing contacts from CSV files
 */

import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { ImportCSVWizard } from '~/components/crm/contacts/ImportCSVWizard';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { toast } from 'sonner';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ContactImportPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/contacts`);
  };

  const handleComplete = () => {
    toast.success('Import complete', { description: 'Your contacts have been imported successfully' });
    // Navigate back to contacts list after a brief delay
    setTimeout(() => {
      navigate(`/dashboard/${workspaceId}/crm/contacts`);
    }, 1500);
  };

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Import Contacts from CSV</h1>
          <p className="text-muted-foreground">
            Upload a CSV file and map columns to contact fields
          </p>
        </div>
      </div>

      {/* Import Wizard - Fullscreen (no dialog wrapper) */}
      <ImportCSVWizard
        workspaceId={workspaceId}
        onComplete={handleComplete}
        onCancel={handleBack}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
