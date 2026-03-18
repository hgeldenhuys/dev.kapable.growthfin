/**
 * Research Layout
 * Shared layout for all research routes
 */

import { Outlet } from 'react-router';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ResearchLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
