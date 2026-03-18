/**
 * Work Item Complete Action Route
 * Handles POST requests to complete a work item with result data
 */

import { redirect } from 'react-router';
import { getSession } from '~/lib/auth';
import type { Route } from './+types/dashboard.$workspaceId.work-items.$workItemId.complete';

/**
 * Action - Handle complete request
 */
export async function action({ request, params }: Route.ActionArgs) {
  const session = await getSession(request);
  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const { workspaceId, workItemId } = params;

  try {
    // Parse form data
    const formData = await request.formData();
    const notes = formData.get('notes') as string;
    const completedBy = formData.get('completedBy') as 'user' | 'ai' | 'system' || 'user';

    // Build result object
    const result = {
      notes: notes || '',
      completedAt: new Date().toISOString(),
    };

    // Call backend API to complete work item
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const response = await fetch(
      `${apiUrl}/api/v1/work-items/${workItemId}/complete?workspaceId=${workspaceId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedBy, result }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to complete work item');
    }

    // Redirect back to work item detail page
    return redirect(`/dashboard/${workspaceId}/work-items/${workItemId}?success=completed`);
  } catch (error) {
    console.error('Error completing work item:', error);
    return redirect(`/dashboard/${workspaceId}/work-items/${workItemId}?error=complete_failed`);
  }
}
