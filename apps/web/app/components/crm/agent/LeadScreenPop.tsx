/**
 * LeadScreenPop Component
 * Full-context lead screen pop drawer for agent calls
 */

import { Phone, Mail, FileText, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '~/components/ui/sheet';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { useLeadDetail } from '~/hooks/useLeadDetail';
import { ContactInfoSection } from './LeadScreenPopSections/ContactInfoSection';
import { AccountContextSection } from './LeadScreenPopSections/AccountContextSection';
import { ScoreDetailSection } from './LeadScreenPopSections/ScoreDetailSection';
import { CampaignSection } from './LeadScreenPopSections/CampaignSection';
import { ActivityTimeline } from './ActivityTimeline';
import { RelatedContactsSection } from './LeadScreenPopSections/RelatedContactsSection';

interface LeadScreenPopProps {
  leadId: string | null;
  workspaceId: string;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCall?: () => void;
  onEmail?: () => void;
  onAddNote?: () => void;
}

export function LeadScreenPop({
  leadId,
  workspaceId,
  userId,
  open,
  onOpenChange,
  onCall,
  onEmail,
  onAddNote,
}: LeadScreenPopProps) {
  const { data: leadDetail, isLoading, error } = useLeadDetail({
    leadId,
    workspaceId,
    userId,
    enabled: open && !!leadId,
  });

  const fullName = leadDetail?.contact
    ? `${leadDetail.contact.firstName || ''} ${leadDetail.contact.lastName || ''}`.trim()
    : '';

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      contacted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      qualified: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      callback: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    };
    return colors[status as keyof typeof colors] || colors.new;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          {leadDetail && (
            <>
              <SheetTitle className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-lg">{fullName || 'Lead Details'}</span>
                  {leadDetail.contact?.title && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {leadDetail.contact.title}
                    </span>
                  )}
                </div>
                <Badge className={getStatusColor(leadDetail.lead.status)}>
                  {leadDetail.lead.status.charAt(0).toUpperCase() + leadDetail.lead.status.slice(1)}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                Complete lead context including contact information, account details, AI intelligence, and activity timeline
              </SheetDescription>
            </>
          )}
          {isLoading && (
            <>
              <SheetTitle className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading lead details...
              </SheetTitle>
              <SheetDescription>Please wait while we load the lead information</SheetDescription>
            </>
          )}
        </SheetHeader>

        <div className="py-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-300">
                Failed to load lead details: {error.message}
              </p>
            </div>
          )}

          {leadDetail && (
            <div className="space-y-4">
              {leadDetail.contact && <ContactInfoSection contact={leadDetail.contact} />}
              {leadDetail.account && <AccountContextSection account={leadDetail.account} />}
              <ScoreDetailSection
                leadId={leadId!}
                workspaceId={workspaceId}
                score={leadDetail.aiIntelligence.propensityScore}
                scoreBreakdown={leadDetail.aiIntelligence.scoreBreakdown}
                scoreUpdatedAt={leadDetail.aiIntelligence.scoreUpdatedAt}
              />
              {leadDetail.campaign && <CampaignSection campaign={leadDetail.campaign} />}
              <ActivityTimeline
                leadId={leadId!}
                workspaceId={workspaceId}
                initialActivities={leadDetail.recentActivities}
              />
              {leadDetail.relatedContacts.length > 0 && (
                <RelatedContactsSection contacts={leadDetail.relatedContacts} />
              )}
            </div>
          )}
        </div>

        {leadDetail && (
          <SheetFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={onCall}
              className="flex-1"
              size="lg"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call Now
            </Button>
            <Button
              onClick={onEmail}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button
              onClick={onAddNote}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              <FileText className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
