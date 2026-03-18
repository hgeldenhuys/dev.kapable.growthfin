/**
 * Campaign Templates Layout
 * Layout for template routes
 */

import { Outlet } from 'react-router';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CampaignTemplatesLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
