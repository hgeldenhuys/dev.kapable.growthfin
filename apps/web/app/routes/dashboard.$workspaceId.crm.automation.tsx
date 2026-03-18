/**
 * Automation Layout
 * Wraps automation analytics and workflow child routes
 */
import { Outlet } from "react-router";
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function AutomationLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
