/**
 * AI Analytics Sessions Route
 * Session audit log with pagination and filtering
 * US-ANALYTICS-010: Session Audit UI
 */

import type { Route } from './+types/dashboard.$workspaceId.ai.analytics.sessions';
import { SessionAuditLog } from '~/components/ai-analytics/SessionAuditLog';

export async function loader({ params }: Route.LoaderArgs) {
  const { workspaceId } = params;
  return { workspaceId };
}

export default function AIAnalyticsSessionsPage({ loaderData }: Route.ComponentProps) {
  const { workspaceId } = loaderData;

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Session Audit Log</h1>
        <p className="text-muted-foreground">
          Track and review Claude Code session history
        </p>
      </div>

      <SessionAuditLog workspaceId={workspaceId} />
    </div>
  );
}
