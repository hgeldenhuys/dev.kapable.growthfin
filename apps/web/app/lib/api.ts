/**
 * API utilities for client-side code
 *
 * IMPORTANT: Client-side code should NEVER directly call localhost:3000.
 * All API calls must go through proxy routes to avoid CORS and security issues.
 */

/**
 * Get the base URL for API calls.
 *
 * For client-side code: Returns empty string (uses proxy routes)
 * For server-side code: Returns the actual API URL
 */
export function getApiUrl(): string {
  // Client-side: Use proxy routes (relative URLs)
  if (typeof window !== 'undefined') {
    return '';
  }

  // Server-side: Use actual API URL
  return process.env.API_URL || 'http://localhost:3000';
}

/**
 * Make an API request using the appropriate base URL
 *
 * @param path - API path (e.g., '/api/v1/crm/health/leads/123')
 * @param options - Fetch options
 */
export async function apiRequest(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}${path}`;

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include', // Important for cookies
  });
}
