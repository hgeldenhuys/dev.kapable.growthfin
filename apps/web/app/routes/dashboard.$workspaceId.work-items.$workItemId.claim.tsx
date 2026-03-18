/**
 * Work Item Claim Action Route
 * Handles POST requests to claim a work item
 */

import { redirect } from 'react-router';
import { getSession } from '~/lib/auth';
import type { Route } from './+types/dashboard.$workspaceId.work-items.$workItemId.claim';

/**
 * Action - Handle claim request
 */
export async function action({ request, params }: Route.ActionArgs) {
  const session = await getSession(request);
  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const { workspaceId, workItemId } = params;
  const userId = session.user.id;

  try {
    // Call backend API to claim work item
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const response = await fetch(
      `${apiUrl}/api/v1/work-items/${workItemId}/claim?workspaceId=${workspaceId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }
    );

    if (!response.ok) {
      if (response.status === 409) {
        // Already claimed by another user
        return redirect(`/dashboard/${workspaceId}/work-items/${workItemId}?error=already_claimed`);
      }
      throw new Error('Failed to claim work item');
    }

    // Redirect back to work item detail page
    return redirect(`/dashboard/${workspaceId}/work-items/${workItemId}?success=claimed`);
  } catch (error) {
    console.error('Error claiming work item:', error);
    return redirect(`/dashboard/${workspaceId}/work-items/${workItemId}?error=claim_failed`);
  }
}
