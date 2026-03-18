/**
 * Contact Delete Confirmation Page
 * Full-page delete confirmation for contacts
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { useNavigate, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { ArrowLeft, Loader2, AlertTriangle, Mail, Phone, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useDeleteContact } from '~/hooks/useContacts';
import { toast } from 'sonner';
import { ContactStatusBadge } from '~/components/crm/ContactStatusBadge';
import { ContactLifecycleBadge } from '~/components/crm/ContactLifecycleBadge';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for contact delete page
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

export default function ContactDeletePage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  // Get data from loader
  const { contact } = useLoaderData<typeof loader>();
  const contactId = contact.id;

  const deleteContact = useDeleteContact();

  const handleDelete = async () => {
    try {
      await deleteContact.mutateAsync({
        contactId: contact.id,
        workspaceId,
      });
      toast.success('Contact deleted', { description: 'The contact has been deleted successfully.' });
      navigate(`/dashboard/${workspaceId}/crm/contacts`);
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Delete Contact?</h1>
          <p className="text-muted-foreground">This action cannot be undone</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Confirm Deletion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              You are about to permanently delete this contact. This action cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h3 className="font-semibold">Contact Details:</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Name:</dt>
                <dd className="font-semibold">{fullName}</dd>
              </div>
              {contact.email && (
                <div className="flex gap-2">
                  <dt className="font-medium min-w-32">Email:</dt>
                  <dd className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {contact.email}
                  </dd>
                </div>
              )}
              {contact.phone && (
                <div className="flex gap-2">
                  <dt className="font-medium min-w-32">Phone:</dt>
                  <dd className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {contact.phone}
                  </dd>
                </div>
              )}
              {contact.title && (
                <div className="flex gap-2">
                  <dt className="font-medium min-w-32">Title:</dt>
                  <dd>{contact.title}</dd>
                </div>
              )}
              {contact.department && (
                <div className="flex gap-2">
                  <dt className="font-medium min-w-32">Department:</dt>
                  <dd className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    {contact.department}
                  </dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Status:</dt>
                <dd><ContactStatusBadge status={contact.status} /></dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium min-w-32">Lifecycle Stage:</dt>
                <dd><ContactLifecycleBadge lifecycleStage={contact.lifecycleStage} /></dd>
              </div>
            </dl>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={deleteContact.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteContact.isPending}
            >
              {deleteContact.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Contact'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
