/**
 * CORS handling for the API
 */

import { env } from '../config/env';

/** Build allowed origins from env — CORS_ORIGIN is comma-separated */
function getAllowedOrigins(): string[] {
  const origins: string[] = [
    'https://signaldb.live',
    'https://app.signaldb.live',
  ];

  if (env.CORS_ORIGIN) {
    const envOrigins = env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
    for (const o of envOrigins) {
      if (!origins.includes(o)) origins.push(o);
    }
  }

  return origins;
}

const ALLOWED_ORIGINS = getAllowedOrigins();

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
};

function isAllowedOrigin(origin: string): boolean {
  // Exact match against allowlist
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Allow localhost with any port in development only
  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
    } catch {
      // Invalid URL, not allowed
    }
  }

  // Subdomain matching — require dot prefix to prevent evil-signaldb.live
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (
      url.protocol === 'https:' &&
      (hostname.endsWith('.signaldb.live') || hostname.endsWith('.signaldb.app'))
    ) {
      return true;
    }
  } catch {
    // Invalid URL
  }

  return false;
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...CORS_HEADERS };

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function handleCors(req: Request): Response | null {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  return null;
}
