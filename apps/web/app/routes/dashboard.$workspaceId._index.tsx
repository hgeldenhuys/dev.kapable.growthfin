/**
 * Dashboard Index — redirects to CRM dashboard
 */
import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

export function loader({ params }: LoaderFunctionArgs) {
  return redirect(`/dashboard/${params.workspaceId}/crm`);
}
