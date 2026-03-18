/**
 * Priority Call List Component
 * Main component for agent call list with real-time updates
 */

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAgentCallList, type CallListFilters, type AgentCallListLead } from '~/hooks/useAgentCallList';
import { useCallListSSE } from '~/hooks/useCallListSSE';
import { useLeadScoresStream } from '~/hooks/useLeadScoresStream';
import { CallListFiltersComponent } from './CallListFilters';
import { LeadListItem } from './LeadListItem';
import { LeadScreenPop } from './LeadScreenPop';
import { CallDispositionModal } from './CallDispositionModal';
import { EmptyCallListState } from './EmptyCallListState';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Skeleton } from '~/components/ui/skeleton';
import { toast } from 'sonner';

interface PriorityCallListProps {
  workspaceId: string;
  userId: string;
  campaigns?: Array<{ id: string; name: string }>;
}

export function PriorityCallList({
  workspaceId,
  userId,
  campaigns = []
}: PriorityCallListProps) {
  const [filters, setFilters] = useState<CallListFilters>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [screenPopOpen, setScreenPopOpen] = useState(false);
  const [dispositionModalOpen, setDispositionModalOpen] = useState(false);
  // Fetch call list with filters
  const { data, isLoading, error } = useAgentCallList({
    workspaceId,
    userId,
    filters,
  });

  // Connect to SSE for real-time updates
  useCallListSSE({ workspaceId, userId });

  // Connect to lead scores SSE for real-time score updates
  useLeadScoresStream({
    workspaceId,
    userId,
    enabled: true,
    onScoreChanged: (event) => {
      // Toast notification for score changes
      toast.success('Score updated', { description: `Lead score changed from ${event.scoreBefore} to ${event.scoreAfter}` });
    },
  });

  const handleCall = (lead: AgentCallListLead) => {
    // Open screen pop with lead context
    setSelectedLeadId(lead.id);
    setScreenPopOpen(true);
  };

  const handleScreenPopCall = () => {
    // Initiate actual call
    const lead = data?.leads.find(l => l.id === selectedLeadId);
    if (lead?.contact.phone) {
      toast.success('Call initiated', { description: `Calling ${lead.contact.firstName} ${lead.contact.lastName}` });

      // Close screen pop and open disposition modal
      setScreenPopOpen(false);
      setDispositionModalOpen(true);

      // For demo purposes, we'll open the disposition modal immediately
      // In production, this would open after call ends via Telnyx integration
      // window.location.href = `tel:${lead.contact.phone}`;
    }
  };

  const handleScreenPopEmail = () => {
    // Compose email
    const lead = data?.leads.find(l => l.id === selectedLeadId);
    if (lead?.contact.email) {
      toast.success('Composing email', { description: `To: ${lead.contact.email}` });
      window.location.href = `mailto:${lead.contact.email}`;
    }
  };

  const handleScreenPopAddNote = () => {
    // TODO: Open add note modal
    toast.success('Add note', { description: 'Note functionality coming soon' });
  };

  const handleDispositionSuccess = () => {
    // After disposition saved, clear selection and show next lead
    setSelectedLeadId(null);
    toast.success('Disposition saved', { description: 'Lead status updated successfully' });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <CallListFiltersComponent
          filters={filters}
          onChange={setFilters}
          campaigns={campaigns}
        />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <CallListFiltersComponent
          filters={filters}
          onChange={setFilters}
          campaigns={campaigns}
        />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading call list</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to fetch call list. Please try again.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state
  if (!data?.leads || data.leads.length === 0) {
    return (
      <div className="space-y-4">
        <CallListFiltersComponent
          filters={filters}
          onChange={setFilters}
          campaigns={campaigns}
        />
        <EmptyCallListState workspaceId={workspaceId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CallListFiltersComponent
        filters={filters}
        onChange={setFilters}
        campaigns={campaigns}
      />

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {data.leads.length} of {data.total} leads
        </p>
      </div>

      {/* Lead list */}
      <div className="space-y-3">
        {data.leads.map((lead) => (
          <LeadListItem
            key={lead.id}
            lead={lead}
            onCall={handleCall}
          />
        ))}
      </div>

      {/* Load more (if needed for pagination) */}
      {data.total > data.leads.length && (
        <div className="flex justify-center pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {data.leads.length} of {data.total} leads
          </p>
        </div>
      )}

      {/* Lead Screen Pop */}
      <LeadScreenPop
        leadId={selectedLeadId}
        workspaceId={workspaceId}
        userId={userId}
        open={screenPopOpen}
        onOpenChange={setScreenPopOpen}
        onCall={handleScreenPopCall}
        onEmail={handleScreenPopEmail}
        onAddNote={handleScreenPopAddNote}
      />

      {/* Call Disposition Modal */}
      {selectedLeadId && (
        <CallDispositionModal
          leadId={selectedLeadId}
          workspaceId={workspaceId}
          open={dispositionModalOpen}
          onOpenChange={setDispositionModalOpen}
          onSuccess={handleDispositionSuccess}
        />
      )}
    </div>
  );
}
