/**
 * Contact Lists Layout
 * Shared layout for all contact lists routes
 */

import { Outlet } from 'react-router';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ContactListsLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
