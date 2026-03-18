/**
 * Tasks Layout Route
 * Provides layout for task management pages
 */

import { Outlet } from 'react-router';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function TasksLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
