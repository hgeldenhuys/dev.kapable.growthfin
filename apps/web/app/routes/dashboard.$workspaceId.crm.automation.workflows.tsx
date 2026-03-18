/**
 * Workflows Layout
 * Shared layout for all workflow routes
 */

import { Outlet } from 'react-router';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function WorkflowsLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
