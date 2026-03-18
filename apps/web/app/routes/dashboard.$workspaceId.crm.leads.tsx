/**
 * Leads Layout
 * Shared layout for all lead routes
 */

import { Outlet } from "react-router";
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function LeadsLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
