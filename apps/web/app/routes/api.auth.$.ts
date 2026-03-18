/**
 * Auth API Proxy for /auth/*
 *
 * This route proxies all /auth/* requests to the backend API.
 * Handles authentication endpoints like sign-in, sign-up, sign-out.
 */

import type { Route } from "./+types/api.auth.$";

const API_URL = typeof window === 'undefined'
  ? (process.env.API_URL || 'http://localhost:3000')
  : '';

export async function loader({ request, params }: Route.LoaderArgs) {
  return handleRequest(request, params);
}

export async function action({ request, params }: Route.ActionArgs) {
  return handleRequest(request, params);
}

async function handleRequest(request: Request, params: Route.LoaderArgs['params'] | Route.ActionArgs['params']) {
  // Only run on server
  if (typeof window !== 'undefined') {
    throw new Error('Auth proxy can only be used on server');
  }

  // Get the path after /auth/
  const path = params['*'] || '';

  // Build backend URL
  const url = new URL(request.url);
  const backendUrl = new URL(`${API_URL}/auth/${path}${url.search}`);

  // Forward the request to the backend
  try {
    // Build headers, filtering out hop-by-hop headers that undici rejects
    const forwardHeaders: Record<string, string> = {};
    const skipHeaders = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'expect'];

    request.headers.forEach((value, key) => {
      if (!skipHeaders.includes(key.toLowerCase())) {
        forwardHeaders[key] = value;
      }
    });

    // Set the correct host for the backend
    forwardHeaders['host'] = new URL(API_URL).host;

    const response = await fetch(backendUrl.toString(), {
      method: request.method,
      headers: forwardHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.text()
        : undefined,
      // @ts-ignore
      duplex: 'half', // Required for streaming bodies
    });

    // Create a new response with the backend's response
    const responseHeaders = new Headers(response.headers);

    // Remove backend-specific headers
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    responseHeaders.delete('transfer-encoding');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Auth Proxy] Error proxying request to ${backendUrl}:`, error);
    return new Response(
      JSON.stringify({ error: 'Auth proxy error', message: String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}