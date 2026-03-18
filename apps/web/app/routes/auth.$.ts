/**
 * Auth Catch-All Route
 * Handles /auth/* requests directly via DB (sign-out, session, etc.)
 */

import type { Route } from "./+types/auth.$";
import { db, sessions, eq } from "~/lib/db.server";

/**
 * Extract session token from cookie header
 */
function extractToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith("session=")) {
      return cookie.substring("session=".length);
    }
  }
  return null;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const path = params['*'] || '';

  // GET /auth/session — validate session
  if (path === 'session') {
    const { getSession } = await import('~/lib/auth');
    const session = await getSession(request);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const path = params['*'] || '';

  // POST /auth/sign-out — delete session and clear cookie
  if (path === 'sign-out') {
    const token = extractToken(request);
    if (token) {
      try {
        await db.delete(sessions).where(eq(sessions.token, token));
      } catch (error) {
        console.error('[auth] Sign-out error:', error);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      },
    });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}
