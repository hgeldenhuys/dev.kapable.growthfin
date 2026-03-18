/**
 * Agent Dashboard Route
 * Main workspace for sales agents to manage daily calls
 */

import { useParams } from 'react-router';
import { useUserId } from '~/hooks/useWorkspace';
import { PriorityCallList } from '~/components/crm/agent/PriorityCallList';
import { useCampaigns } from '~/hooks/useCampaigns';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function AgentDashboardRoute() {
  const { workspaceId } = useParams();
  const userId = useUserId();

  if (!workspaceId) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Invalid workspace
        </div>
      </div>
    );
  }

  // Fetch campaigns for filter dropdown
  const { data: campaignsData } = useCampaigns({
    workspaceId,
    enabled: true
  });

  const campaigns = campaignsData?.map((c) => ({
    id: c.id,
    name: c.name
  })) || [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl" data-tour="call-list">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Today's Call List
        </h1>
        <p className="text-muted-foreground mt-2">
          Prioritized leads to call today - callbacks first, then by score
        </p>
      </div>

      <PriorityCallList
        workspaceId={workspaceId}
        userId={userId}
        campaigns={campaigns}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
