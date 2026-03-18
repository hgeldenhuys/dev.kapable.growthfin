/**
 * Contact Detail Page
 * Detailed view of a single contact
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { useState } from 'react';
import { Link, useNavigate, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Mail,
  Phone,
  Building2,
  User,
  Calendar,
  Smartphone,
  Activity,
  FileText,
  Sparkles,
  MessageSquare,
  MessageCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Label } from '~/components/ui/label';
import { EnrichmentHistoryCard } from '~/components/crm/enrichment/history';
import { EmailAttemptsCard } from '~/components/crm/email-verification';
import { WorkItemsPanel } from '~/components/crm/work-items';
import { ContactStatusBadge } from '~/components/crm/ContactStatusBadge';
import { ContactLifecycleBadge } from '~/components/crm/ContactLifecycleBadge';
import { TimelineView } from '~/components/crm/TimelineView';
import { ContactDispositionPanel } from '~/components/crm/contacts/ContactDispositionPanel';
import { CreateResearchDialog } from '~/components/research/CreateResearchDialog';
import { CustomFieldsDisplay, CustomFieldsEditor } from '~/components/crm/custom-fields';
import { CallWidget, AiCallButton } from '~/components/crm/voice';
import { AiCallsTab } from '~/components/crm/ai-calls';
import { EmailComposer } from '~/components/crm/leads/EmailComposer';
import { SMSComposer } from '~/components/crm/leads/SMSComposer';
import { WhatsAppComposer } from '~/components/crm/leads/WhatsAppComposer';
import { Bot } from 'lucide-react';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { useUpdateContact } from '~/hooks/useContacts';
import { toast } from 'sonner';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for contact detail page
 * Fetches contact from database for server-side rendering
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { db, crmContacts, crmAccounts, eq, and } = await import('~/lib/db.server');

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

  // Fetch linked account name if accountId exists
  let accountName: string | null = null;
  if (contact.accountId) {
    const [account] = await db
      .select({ name: crmAccounts.name })
      .from(crmAccounts)
      .where(eq(crmAccounts.id, contact.accountId))
      .limit(1);
    accountName = account?.name || null;
  }

  return { contact, accountName };
}

export default function ContactDetailPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Get data from loader
  const { contact, accountName } = useLoaderData<typeof loader>();
  const contactId = contact.id;

  const updateContact = useUpdateContact();

  const [researchDialogOpen, setResearchDialogOpen] = useState(false);
  const [isEditingCustomFields, setIsEditingCustomFields] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/contacts`);
  };

  const handleEdit = () => {
    navigate(`/dashboard/${workspaceId}/crm/contacts/edit/${contactId}`);
  };

  const handleDelete = () => {
    navigate(`/dashboard/${workspaceId}/crm/contacts/delete/${contactId}`);
  };

  const handleSaveCustomFields = async (fields: Record<string, any>) => {
    try {
      await updateContact.mutateAsync({
        contactId,
        workspaceId,
        data: {
          customFields: fields,
        },
      });

      toast.success('Success', { description: 'Custom fields updated successfully' });

      setIsEditingCustomFields(false);
    } catch (error) {
      toast.error('Error', { description: `Failed to update custom fields: ${String(error)}` });
    }
  };

  // Loading and error states are handled by React Router's loader pattern
  // If we reach this point, contact is guaranteed to exist

  const fullName = `${contact.firstName} ${contact.lastName}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{fullName}</h1>
            <p className="text-muted-foreground">Contact Details</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {/* Communication Actions - Voice Call (H.1) and AI Voice Call (Phase I) */}
          <CallWidget
            workspaceId={workspaceId}
            contactId={contactId}
            userId={userId}
            phoneNumber={contact.phone || contact.mobile || null}
            entityName={fullName}
          />
          <AiCallButton
            workspaceId={workspaceId}
            contactId={contactId}
            userId={userId}
            phoneNumber={contact.phone || contact.mobile || null}
            entityName={fullName}
          />
          <Button
            variant="outline"
            onClick={() => setSmsDialogOpen(true)}
            disabled={!contact.phone && !contact.mobile}
            title={contact.phone || contact.mobile ? `SMS ${contact.phone || contact.mobile}` : 'No phone number'}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            SMS
          </Button>
          <Button
            variant="outline"
            onClick={() => setWhatsappDialogOpen(true)}
            disabled={!contact.phone && !contact.mobile}
            title={contact.phone || contact.mobile ? `WhatsApp ${contact.phone || contact.mobile}` : 'No phone number'}
          >
            <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={() => setEmailDialogOpen(true)}
            disabled={!contact.email}
            title={contact.email ? `Email ${contact.email}` : 'No email address'}
          >
            <Mail className="mr-2 h-4 w-4" />
            Email
          </Button>
          <Button variant="default" onClick={() => setResearchDialogOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Enrich with AI
          </Button>
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">
            <FileText className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="ai-calls">
            <Bot className="mr-2 h-4 w-4" />
            AI Calls
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Activity className="mr-2 h-4 w-4" />
            Timeline
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="space-y-6">
            {/* Main Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Status */}
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-2">
                      <ContactStatusBadge status={contact.status} />
                    </div>
                  </div>

                  {/* Lifecycle Stage */}
                  <div>
                    <Label className="text-muted-foreground">Lifecycle Stage</Label>
                    <div className="mt-2">
                      <ContactLifecycleBadge lifecycleStage={contact.lifecycleStage} />
                    </div>
                  </div>

                  {/* Email */}
                  {contact.email && (
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-sm hover:underline"
                        >
                          {contact.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Secondary Email */}
                  {contact.emailSecondary && (
                    <div>
                      <Label className="text-muted-foreground">Secondary Email</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`mailto:${contact.emailSecondary}`}
                          className="text-sm hover:underline"
                        >
                          {contact.emailSecondary}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  {contact.phone && (
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-sm hover:underline"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Secondary Phone */}
                  {contact.phoneSecondary && (
                    <div>
                      <Label className="text-muted-foreground">Secondary Phone</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`tel:${contact.phoneSecondary}`}
                          className="text-sm hover:underline"
                        >
                          {contact.phoneSecondary}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Mobile */}
                  {contact.mobile && (
                    <div>
                      <Label className="text-muted-foreground">Mobile</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`tel:${contact.mobile}`}
                          className="text-sm hover:underline"
                        >
                          {contact.mobile}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Title */}
                  {contact.title && (
                    <div>
                      <Label className="text-muted-foreground">Title</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{contact.title}</span>
                      </div>
                    </div>
                  )}

                  {/* Department */}
                  {contact.department && (
                    <div>
                      <Label className="text-muted-foreground">Department</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{contact.department}</span>
                      </div>
                    </div>
                  )}

                  {/* Account */}
                  {contact.accountId && (
                    <div>
                      <Label className="text-muted-foreground">Account</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <Link
                          to={`/dashboard/${workspaceId}/crm/accounts/${contact.accountId}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {accountName || 'View Account'}
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Lead Source */}
                  {contact.leadSource && (
                    <div>
                      <Label className="text-muted-foreground">Lead Source</Label>
                      <div className="mt-2">
                        <span className="text-sm capitalize">
                          {contact.leadSource.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Created */}
                  <div>
                    <Label className="text-muted-foreground">Created</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {new Date(contact.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Disposition Panel - State Machine UI */}
            <ContactDispositionPanel
              contact={contact}
              workspaceId={workspaceId}
              userId={userId}
            />

            {/* Custom Fields Card */}
            <div>
              {isEditingCustomFields ? (
                <CustomFieldsEditor
                  initialFields={contact.customFields || {}}
                  onSave={handleSaveCustomFields}
                  onCancel={() => setIsEditingCustomFields(false)}
                />
              ) : (
                <CustomFieldsDisplay
                  fields={contact.customFields || {}}
                  onEdit={() => setIsEditingCustomFields(true)}
                />
              )}
            </div>

            {/* Work Items Panel (UI-001) */}
            <WorkItemsPanel
              entityType="contact"
              entityId={contactId}
              workspaceId={workspaceId}
              title="Work Items"
            />

            {/* Email Verification Attempts (CRM-005) */}
            <EmailAttemptsCard
              entityId={contactId}
              entityType="contact"
            />

            {/* Enrichment History */}
            <EnrichmentHistoryCard
              entityId={contactId}
              entityType="contact"
              currentData={contact.customFields}
            />
          </div>
        </TabsContent>

        {/* AI Calls Tab */}
        <TabsContent value="ai-calls">
          <AiCallsTab
            entityType="contact"
            entityId={contactId}
            workspaceId={workspaceId}
            entityName={fullName}
          />
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <TimelineView
            workspaceId={workspaceId}
            entityType="contact"
            entityId={contactId}
            userId={userId}
          />
        </TabsContent>
      </Tabs>

      {/* SMS Composer Modal */}
      <SMSComposer
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        lead={contact}
        workspaceId={workspaceId}
        userId={userId}
        entityType="contact"
      />

      {/* WhatsApp Composer Modal */}
      <WhatsAppComposer
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
        lead={contact}
        workspaceId={workspaceId}
        userId={userId}
        entityType="contact"
      />

      {/* Email Composer Modal */}
      <EmailComposer
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        lead={contact}
        workspaceId={workspaceId}
        userId={userId}
        entityType="contact"
      />

      {/* Research Dialog */}
      <CreateResearchDialog
        open={researchDialogOpen}
        onOpenChange={setResearchDialogOpen}
        entityType="contact"
        entityId={contactId}
        entityName={fullName}
        workspaceId={workspaceId}
        userId={userId}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
