/**
 * Campaigns Layout
 * Shared layout for all campaign routes
 */

import { Outlet } from "react-router";
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CampaignsLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
