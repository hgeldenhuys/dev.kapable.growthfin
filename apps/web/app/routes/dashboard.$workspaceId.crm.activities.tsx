/**
 * Activities Layout
 * Shared layout for all activity routes
 */

import { Outlet } from "react-router";
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ActivitiesLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
