/**
 * Analytics Layout
 * Shared layout for all analytics routes
 */

import { Outlet } from "react-router";
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function AnalyticsLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
