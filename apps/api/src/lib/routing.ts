/**
 * Request Routing Utilities
 *
 * Handles cross-server request forwarding for multi-tenant architecture.
 * When data is on a remote server, forwards the request transparently.
 */

import { RemoteDataError } from './connection-manager';

/**
 * Forward a request to a remote server
 */
export async function forwardRequest(
  originalRequest: Request,
  targetHost: string
): Promise<Response> {
  const url = new URL(originalRequest.url);
  const targetUrl = `https://${targetHost}${url.pathname}${url.search}`;

  console.log(`[Routing] Forwarding request to ${targetUrl}`);

  // Clone headers, adding X-Forwarded-* headers
  const headers = new Headers(originalRequest.headers);
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.set('X-Forwarded-For', originalRequest.headers.get('X-Real-IP') || 'unknown');

  try {
    const response = await fetch(targetUrl, {
      method: originalRequest.method,
      headers,
      body: originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD'
        ? await originalRequest.arrayBuffer()
        : undefined,
      redirect: 'manual', // Don't follow redirects, pass them through
    });

    // Clone response with forwarded headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Forwarded-From', targetHost);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Routing] Forward request failed:`, error);
    return Response.json({
      error: 'Failed to forward request to remote server',
      target: targetHost,
    }, { status: 502 });
  }
}

/**
 * Wrap a route handler to automatically forward on RemoteDataError
 */
export function withRemoteForwarding<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof RemoteDataError) {
        // Extract original request from args (assumes first arg is Request)
        const request = args[0] as Request;
        return forwardRequest(request, error.serverHost);
      }
      throw error;
    }
  };
}

/**
 * Check if a response indicates a remote redirect
 */
export function isRemoteRedirect(response: Response): boolean {
  return response.status === 307 &&
    response.headers.get('Content-Type')?.includes('application/json');
}

/**
 * Handle remote redirect response by forwarding
 */
export async function handleRemoteRedirect(
  originalRequest: Request,
  response: Response
): Promise<Response> {
  try {
    const body = await response.clone().json();
    if (body.redirect?.server) {
      return forwardRequest(originalRequest, body.redirect.server);
    }
  } catch {
    // Not a valid redirect response
  }
  return response;
}
