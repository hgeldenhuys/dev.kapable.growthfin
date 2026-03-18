/**
 * Contact Create Page
 * Full-page creation experience for new contacts
 */

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
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
import { ContactForm } from '~/components/crm/ContactForm';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { useCreateContact } from '~/hooks/useContacts';
import { toast } from 'sonner';
import { useUnsavedChanges } from '~/hooks/useUnsavedChanges';
import type { CreateContactRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ContactCreatePage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  const createContact = useCreateContact();
  const contactFormRef = useRef<HTMLFormElement>(null);

  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChanges(isDirty);

  const handleSubmit = async (data: Partial<CreateContactRequest>) => {
    try {
      setIsDirty(false); // Clear dirty before navigation
      const newContact = await createContact.mutateAsync(data as CreateContactRequest);
      toast.success('Contact created', { description: 'The new contact has been created successfully.' });
      navigate(`/dashboard/${workspaceId}/crm/contacts/${newContact.id}`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCancel = () => {
    navigate(`/dashboard/${workspaceId}/crm/contacts`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/contacts`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Contact</h1>
          <p className="text-muted-foreground">Add a new contact to your CRM</p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardContent className="pt-6">
          <ContactForm
            ref={contactFormRef}
            contact={null}
            onSubmit={handleSubmit}
            onChange={() => setIsDirty(true)}
            workspaceId={workspaceId}
            userId={userId}
          />

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createContact.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                contactFormRef.current?.requestSubmit();
              }}
              disabled={createContact.isPending}
            >
              {createContact.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Contact'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Unsaved Changes Dialog */}
      {blocker.state === 'blocked' && (
        <AlertDialog open={true}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Are you sure you want to leave?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset()}>
                Stay
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => blocker.proceed()}>
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
