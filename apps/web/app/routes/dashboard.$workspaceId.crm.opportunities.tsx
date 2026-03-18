/**
 * Opportunities Layout
 * Shared layout for all opportunity routes
 */

import { Outlet } from "react-router";
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function OpportunitiesLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
