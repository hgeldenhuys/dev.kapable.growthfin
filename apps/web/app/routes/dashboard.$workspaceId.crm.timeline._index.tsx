/**
 * CRM Timeline Route
 * Main timeline view showing all CRM events across all entities
 */

import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { CRMTimeline } from '~/components/crm/CRMTimeline';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function TimelineIndexRoute() {
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  return (
    <div className="space-y-6">
      <CRMTimeline
        workspaceId={workspaceId}
        userId={userId}
        showFilters={true}
        showAddNote={true}
        embedded={false}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
