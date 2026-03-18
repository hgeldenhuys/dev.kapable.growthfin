/**
 * Contact Edit Page
 * Full-page editing experience for contacts
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { useRef, useState } from 'react';
import { useNavigate, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
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
import { useUpdateContact } from '~/hooks/useContacts';
import { toast } from 'sonner';
import { useUnsavedChanges } from '~/hooks/useUnsavedChanges';
import type { UpdateContactRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for contact edit page
 * Fetches contact from database for server-side rendering
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { db, crmContacts, eq, and } = await import('~/lib/db.server');

  const { workspaceId, contactId } = params;

  if (!workspaceId || !contactId) {
    throw new Response('Workspace ID and Contact ID are required', { status: 400 });
  }

  const [contact] = await db
    .select()
    .from(crmContacts)
    .where(and(eq(crmContacts.id, contactId), eq(crmContacts.workspaceId, workspaceId)))
    .limit(1);

  if (!contact) {
    throw new Response('Contact not found', { status: 404 });
  }

  return { contact };
}

export default function ContactEditPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Get data from loader
  const { contact } = useLoaderData<typeof loader>();
  const contactId = contact.id;

  const updateContact = useUpdateContact();
  const contactFormRef = useRef<HTMLFormElement>(null);

  const [isDirty, setIsDirty] = useState(false);
  const blocker = useUnsavedChanges(isDirty);

  const handleSubmit = async (data: Partial<UpdateContactRequest>) => {
    try {
      setIsDirty(false); // Clear dirty before navigation
      await updateContact.mutateAsync({
        contactId: contact.id,
        workspaceId,
        data: data as UpdateContactRequest,
      });
      toast.success('Contact updated', { description: 'The contact has been updated successfully.' });
      navigate(`/dashboard/${workspaceId}/crm/contacts/${contactId}`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCancel = () => {
    navigate(`/dashboard/${workspaceId}/crm/contacts/${contactId}`);
  };

  // Loading and error states are handled by React Router's loader pattern
  // If we reach this point, contact is guaranteed to exist

  const fullName = `${contact.firstName} ${contact.lastName}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/contacts/${contactId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Contact</h1>
          <p className="text-muted-foreground">{fullName}</p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardContent className="pt-6">
          <ContactForm
            ref={contactFormRef}
            contact={contact}
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
              disabled={updateContact.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                contactFormRef.current?.requestSubmit();
              }}
              disabled={updateContact.isPending}
            >
              {updateContact.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
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
