/**
 * API Proxy Route
 * Transparently proxies all /api/* requests to the backend API
 *
 * This allows the Web app to be the public-facing interface while
 * keeping the API as an internal backend service.
 *
 * Supports:
 * - All HTTP methods (GET, POST, PUT, DELETE, etc.)
 * - Streaming responses (SSE, ElectricSQL)
 * - CORS for CLI access
 * - Error propagation
 */

import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";

async function proxyToAPI(request: Request, path: string) {
  // Get API URL from environment
  const apiUrl = process.env.VITE_API_URL || "http://localhost:3000";

  // The API has two structures:
  // - /cdn/... routes (no /api prefix)
  // - /api/v1/... routes (with /api prefix)
  // Since path includes everything after /api/, we need to check if it starts with v1/
  const needsApiPrefix = path.startsWith('v1/');
  const targetUrl = needsApiPrefix
    ? `${apiUrl}/api/${path}${request.url.includes('?') ? '?' + request.url.split('?')[1] : ''}`
    : `${apiUrl}/${path}${request.url.includes('?') ? '?' + request.url.split('?')[1] : ''}`;

  console.log(`[Proxy] ${request.method} ${targetUrl}`);

  try {
    // Proxy request to API
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      // @ts-ignore - duplex required for streaming
      duplex: "half",
    });

    // Clone headers and add CORS
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

    // Return streaming response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error(`[Proxy] Error: ${error}`);

    // Return 502 Bad Gateway on proxy failure
    return new Response(
      JSON.stringify({
        error: "Bad Gateway",
        message: error instanceof Error ? error.message : "Proxy error",
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

// Handle GET, HEAD requests
export async function loader({ request, params }: LoaderFunctionArgs) {
  const path = params["*"] || "";
  return proxyToAPI(request, path);
}

// Handle POST, PUT, DELETE, PATCH requests
export async function action({ request, params }: ActionFunctionArgs) {
  const path = params["*"] || "";
  return proxyToAPI(request, path);
}
