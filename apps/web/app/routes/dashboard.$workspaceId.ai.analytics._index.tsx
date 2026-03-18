/**
 * AI Analytics Dashboard Route
 * Main analytics page showing tool usage, costs, and performance
 * US-ANALYTICS-008: Analytics Dashboard Components
 */

import type { Route } from './+types/dashboard.$workspaceId.ai.analytics._index';
import { AIAnalyticsDashboard } from '~/components/ai-analytics/AIAnalyticsDashboard';

export async function loader({ params }: Route.LoaderArgs) {
  const { workspaceId } = params;
  return { workspaceId };
}

export default function AIAnalyticsIndexPage({ loaderData }: Route.ComponentProps) {
  const { workspaceId } = loaderData;

  return <AIAnalyticsDashboard workspaceId={workspaceId} />;
}
