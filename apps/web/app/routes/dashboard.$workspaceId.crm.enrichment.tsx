/**
 * Enrichment Layout Route
 */

import { Outlet } from 'react-router';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function EnrichmentLayout() {
  return <Outlet />;
}

export { CrmErrorBoundary as ErrorBoundary };
