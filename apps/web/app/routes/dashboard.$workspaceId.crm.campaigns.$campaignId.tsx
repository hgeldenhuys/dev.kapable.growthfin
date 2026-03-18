/**
 * Campaign Detail Layout
 * Wraps campaign detail and sub-routes (schedule, recurrence, triggers)
 */

import { Outlet } from "react-router";
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CampaignDetailLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
