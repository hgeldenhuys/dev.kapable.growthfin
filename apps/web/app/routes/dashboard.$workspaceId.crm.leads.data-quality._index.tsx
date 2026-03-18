/**
 * Data Quality Dashboard Route
 * Workspace-level view of lead data quality metrics
 */

import { useParams } from 'react-router';
import { DataQualityDashboard } from '~/components/crm/leads/DataQualityDashboard';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function DataQualityDashboardPage() {
  const workspaceId = useWorkspaceId();

  return (
    <div className="container mx-auto py-6">
      <DataQualityDashboard workspaceId={workspaceId} />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
