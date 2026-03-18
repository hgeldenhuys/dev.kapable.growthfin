/**
 * Generic API Proxy for /api/v1/*
 *
 * This route proxies all /api/v1/* requests to the backend API.
 * It handles all HTTP methods and forwards headers appropriately.
 */

import type { Route } from "./+types/api.v1.$";

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
    throw new Error('API proxy can only be used on server');
  }

  // Get the path after /api/v1/
  const path = params['*'] || '';

  // Build backend URL
  const url = new URL(request.url);
  const backendUrl = new URL(`${API_URL}/api/v1/${path}${url.search}`);

  // Forward the request to the backend
  try {
    // Build headers, filtering out problematic ones
    const forwardHeaders: Record<string, string> = {};
    const skipHeaders = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'expect'];

    request.headers.forEach((value, key) => {
      if (!skipHeaders.includes(key.toLowerCase())) {
        forwardHeaders[key] = value;
      }
    });

    // Set the correct host for the backend
    forwardHeaders['host'] = new URL(API_URL).host;

    // For non-JSON bodies (multipart form data, binary), buffer the raw body
    // to avoid stream-forwarding issues that cause empty/corrupt uploads
    let body: any = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('multipart/form-data') || contentType.includes('application/octet-stream')) {
        // Buffer the entire body — streaming via request.body is unreliable
        const buf = await request.arrayBuffer();
        body = Buffer.from(buf);
        forwardHeaders['content-length'] = String(body.length);
      } else {
        body = await request.text();
      }
    }

    const response = await fetch(backendUrl.toString(), {
      method: request.method,
      headers: forwardHeaders,
      body,
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
    console.error(`[API Proxy] Error proxying request to ${backendUrl}:`, error);
    return new Response(
      JSON.stringify({ error: 'Proxy error', message: String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}