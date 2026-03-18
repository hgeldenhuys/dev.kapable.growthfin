/**
 * Contacts Layout
 * Shared layout for all contact routes
 */

import { Outlet } from "react-router";
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ContactsLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
