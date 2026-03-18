/**
 * Timeline Layout
 * Shared layout for timeline routes
 */

import { Outlet } from 'react-router';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function TimelineLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
