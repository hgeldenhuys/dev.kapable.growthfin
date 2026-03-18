/**
 * SignalDB Connect - Dynamic Proxy Handler
 *
 * Routes requests from *.signaldb.app to the correct container
 * URL patterns:
 *   Production: {org}.signaldb.app (e.g., demo.signaldb.app)
 *   Non-prod:   {org}-{env}.signaldb.app (e.g., demo-dev.signaldb.app)
 */

import crypto from 'crypto';
import { sql } from '../lib/db';

// Auth service location (same container as API)
const AUTH_SERVICE_URL = 'http://127.0.0.1:3009';

// Connect apps run on the host, not inside the app-platform container.
// Inside the container, 127.0.0.1 is the container loopback — use the host bridge IP instead.
const CONNECT_APP_HOST = process.env.CONNECT_APP_HOST || '127.0.0.1';

export interface EnvironmentInfo {
  environment_id: string;
  app_id: string;
  org_id: string;
  container_name: string | null;
  port: number | null;
  status: string;
  app_name: string;
  org_slug: string;
  app_slug: string;
  env_name: string;
  subdomain: string | null;
  visibility: 'public' | 'internal';
  auth_gate_enabled: boolean;
  auth_gate_project_id: string | null;
  auth_gate_exclude_paths: string[];
  deployment_mode: 'systemd' | 'container' | null;
  container_ip: string | null;
  maintenance_mode: boolean;
  maintenance_url: string | null;
  app_settings: Record<string, unknown>;
}

const GATE_COOKIE_NAME = 'sdb_gate_token';
const GATE_SECRET = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'gate-secret';

/**
 * Create a signed auth gate token (HMAC-based, not full JWT — lightweight).
 * Contains: userId, email, projectId, role, expiry.
 * NOTE: Permissions are NOT stored in the token — they are resolved server-side
 * from cached role definitions on each request (v2 architecture).
 */
function createGateToken(payload: { userId: string; email: string; projectId: string; role?: string }): string {
  const exp = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  const data = JSON.stringify({
    userId: payload.userId,
    email: payload.email,
    projectId: payload.projectId,
    role: payload.role || 'member',
    exp,
  });
  const encoded = Buffer.from(data).toString('base64url');
  const sig = crypto.createHmac('sha256', GATE_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verify a gate token. Returns payload if valid, null if expired/tampered.
 * Note: Legacy tokens may contain a `permissions` field — it is ignored.
 * Permissions are resolved server-side from cached role definitions.
 */
function verifyGateToken(token: string): { userId: string; email: string; projectId: string; role: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', GATE_SECRET).update(encoded).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  try {
    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    return {
      userId: data.userId,
      email: data.email,
      projectId: data.projectId,
      role: data.role || 'member',
      exp: data.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Parse cookies from a Cookie header string.
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key.trim()] = rest.join('=').trim();
  }
  return cookies;
}

// Check if a path matches any exclude patterns.
// Supports: exact match, trailing wildcard prefix match, and glob patterns with wildcards.
function isPathExcluded(path: string, excludePaths: string[]): boolean {
  for (const pattern of excludePaths) {
    if (!pattern.includes('*')) {
      if (path === pattern) return true;
    } else if (pattern.endsWith('/*')) {
      // Trailing wildcard: prefix match (backwards compatible)
      const prefix = pattern.slice(0, -1); // "/api/" from "/api/*"
      if (path.startsWith(prefix) || path === prefix.slice(0, -1)) return true;
    } else {
      // Glob with * in middle: each * matches one path segment ([^/]+)
      const escaped = pattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const regexStr = '^' + escaped.join('[^/]+') + '$';
      if (new RegExp(regexStr).test(path)) return true;
    }
  }
  return false;
}

// Cache for environment lookups (15 second TTL)
const environmentCache = new Map<string, { info: EnvironmentInfo | null; timestamp: number }>();
const CACHE_TTL = 15 * 1000; // 15 seconds

// Cache for role definitions (5 minute TTL) — keyed by projectId
const roleDefsCache = new Map<string, { defs: Record<string, { permissions: string[] }>; ts: number }>();
const ROLE_DEFS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedRoleDefinitions(projectId: string): Promise<Record<string, { permissions: string[] }>> {
  const cached = roleDefsCache.get(projectId);
  if (cached && Date.now() - cached.ts < ROLE_DEFS_CACHE_TTL) return cached.defs;
  const result = await sql<Array<{ role_definitions: Record<string, { permissions: string[] }> | null }>>`
    SELECT role_definitions FROM auth_configs WHERE project_id = ${projectId}
  `;
  const defs = result[0]?.role_definitions || {};
  roleDefsCache.set(projectId, { defs, ts: Date.now() });
  return defs;
}

function resolvePermissionsFromDefs(defs: Record<string, { permissions: string[] }>, role: string): string[] {
  return defs[role]?.permissions || [];
}

/**
 * Clear the role definitions cache. Called by /__internal/invalidate-role-cache.
 */
export function clearRoleDefsCache(projectId?: string): void {
  if (projectId) roleDefsCache.delete(projectId); else roleDefsCache.clear();
}

/**
 * Parse Connect subdomain into org/env components
 * Input formats:
 *   Production: '{org}' (e.g., 'demo')
 *   Non-prod: '{org}-{env}' (e.g., 'demo-dev', 'demo-staging')
 *
 * Note: appSlug is not in the URL - looked up from database
 */
function parseSubdomain(subdomain: string): { orgSlug: string; envName: string } | null {
  // Known environment names
  const knownEnvNames = ['dev', 'development', 'staging', 'test', 'preview', 'qa'];

  // Check if subdomain contains environment suffix
  const dashIndex = subdomain.lastIndexOf('-');

  if (dashIndex > 0) {
    const potentialOrg = subdomain.substring(0, dashIndex);
    const potentialEnv = subdomain.substring(dashIndex + 1);

    if (knownEnvNames.includes(potentialEnv.toLowerCase())) {
      return { orgSlug: potentialOrg, envName: potentialEnv };
    }
  }

  // No dash or dash is part of org name - treat as production
  return { orgSlug: subdomain, envName: 'production' };
}

/**
 * Look up environment info from database
 * First tries direct subdomain lookup (fast path), then falls back to parsing
 */
export async function lookupEnvironment(subdomain: string): Promise<EnvironmentInfo | null> {
  // Check cache first
  const cached = environmentCache.get(subdomain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.info;
  }

  try {
    // Fast path: direct subdomain column lookup
    let result = await sql<EnvironmentInfo[]>`
      SELECT
        ae.id as environment_id,
        a.id as app_id,
        o.id as org_id,
        ae.container_name,
        ae.port,
        ae.status,
        ae.subdomain,
        ae.visibility,
        COALESCE(ae.auth_gate_enabled, false) as auth_gate_enabled,
        ae.auth_gate_project_id,
        COALESCE(ae.auth_gate_exclude_paths, '[]'::jsonb) as auth_gate_exclude_paths,
        a.name as app_name,
        o.slug as org_slug,
        a.slug as app_slug,
        ae.name as env_name,
        ae.deployment_mode,
        ae.container_ip,
        COALESCE(ae.maintenance_mode, false) as maintenance_mode,
        ae.maintenance_url,
        COALESCE(a.settings, '{}'::jsonb) as app_settings
      FROM app_environments ae
      JOIN apps a ON a.id = ae.app_id
      JOIN organizations o ON o.id = a.org_id
      WHERE ae.subdomain = ${subdomain}
    `;

    // If not found, try parsing and looking up by org/env (fallback for legacy data)
    if (result.length === 0) {
      const parsed = parseSubdomain(subdomain);
      if (!parsed) {
        environmentCache.set(subdomain, { info: null, timestamp: Date.now() });
        return null;
      }

      const { orgSlug, envName } = parsed;

      result = await sql<EnvironmentInfo[]>`
        SELECT
          ae.id as environment_id,
          a.id as app_id,
          o.id as org_id,
          ae.container_name,
          ae.port,
          ae.status,
          ae.subdomain,
          ae.visibility,
          COALESCE(ae.auth_gate_enabled, false) as auth_gate_enabled,
          ae.auth_gate_project_id,
          COALESCE(ae.auth_gate_exclude_paths, '[]'::jsonb) as auth_gate_exclude_paths,
          a.name as app_name,
          o.slug as org_slug,
          a.slug as app_slug,
          ae.name as env_name,
          ae.deployment_mode,
          ae.container_ip,
          COALESCE(ae.maintenance_mode, false) as maintenance_mode,
          ae.maintenance_url,
          COALESCE(a.settings, '{}'::jsonb) as app_settings
        FROM app_environments ae
        JOIN apps a ON a.id = ae.app_id
        JOIN organizations o ON o.id = a.org_id
        WHERE o.slug = ${orgSlug}
          AND ae.name = ${envName}
        LIMIT 1
      `;
    }

    // Third path: custom domain lookup via app_domains table
    if (result.length === 0) {
      result = await sql<EnvironmentInfo[]>`
        SELECT
          ae.id as environment_id,
          a.id as app_id,
          o.id as org_id,
          ae.container_name,
          ae.port,
          ae.status,
          ae.subdomain,
          ae.visibility,
          COALESCE(ae.auth_gate_enabled, false) as auth_gate_enabled,
          ae.auth_gate_project_id,
          COALESCE(ae.auth_gate_exclude_paths, '[]'::jsonb) as auth_gate_exclude_paths,
          a.name as app_name,
          o.slug as org_slug,
          a.slug as app_slug,
          ae.name as env_name,
          ae.deployment_mode,
          ae.container_ip,
          COALESCE(ae.maintenance_mode, false) as maintenance_mode,
          ae.maintenance_url,
          COALESCE(a.settings, '{}'::jsonb) as app_settings
        FROM app_domains ad
        JOIN app_environments ae ON ae.id = ad.environment_id
        JOIN apps a ON a.id = ae.app_id
        JOIN organizations o ON o.id = a.org_id
        WHERE ad.domain = ${subdomain}
          AND ad.verified = true
        LIMIT 1
      `;
    }

    const info = result.length > 0 ? result[0] : null;
    environmentCache.set(subdomain, { info, timestamp: Date.now() });
    return info;
  } catch (error) {
    console.error('[connect-proxy] Database lookup error:', error);
    return null;
  }
}

/**
 * Clear cache for a specific subdomain (call after deployment)
 */
export function clearEnvironmentCache(subdomain?: string): void {
  if (subdomain) {
    environmentCache.delete(subdomain);
  } else {
    environmentCache.clear();
  }
}

/**
 * Generate a branded maintenance page HTML
 */
function getMaintenancePage(appName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${appName} - Maintenance</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .container{text-align:center;max-width:480px;padding:2rem}
    .icon{width:64px;height:64px;margin:0 auto 1.5rem;border-radius:16px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);display:flex;align-items:center;justify-content:center}
    .icon svg{width:32px;height:32px;color:#22c55e}
    h1{font-size:1.5rem;font-weight:700;margin-bottom:.5rem}
    p{color:#a1a1aa;font-size:.875rem;line-height:1.6}
    .badge{display:inline-block;margin-top:1.5rem;padding:.25rem .75rem;border-radius:9999px;background:rgba(234,179,8,.1);color:#eab308;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
    .footer{margin-top:2rem;font-size:.75rem;color:#52525b}
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085"/>
      </svg>
    </div>
    <h1>${appName}</h1>
    <p>We're currently performing scheduled maintenance. We'll be back shortly.</p>
    <span class="badge">Maintenance Mode</span>
    <p class="footer">Powered by SignalDB Connect</p>
  </div>
</body>
</html>`;
}

/**
 * Handle same-domain auth: proxy /auth/* requests to the auth service.
 * This enables OAuth to work on Connect app domains by:
 * 1. Routing /auth/oauth/google → auth service's /api/{org}/{project}/oauth/google
 * 2. Setting X-SignalDB-App-Domain header so auth service knows the callback domain
 * 3. Rewriting Location headers from auth.signaldb.app to the app's domain
 */
async function handleSameDomainAuth(
  req: Request,
  env: EnvironmentInfo,
  originalUri: string,
  subdomain: string
): Promise<Response> {
  const urlPath = new URL(originalUri, 'http://localhost').pathname;

  // Extract the auth path: /auth/oauth/google → oauth/google
  const authPath = urlPath.replace(/^\/auth\/?/, '');

  // Look up the project to use for auth
  // Priority: auth_gate_project_id, then first auth-enabled project in org
  let orgSlug = env.org_slug;
  let projectSlug: string | null = null;

  if (env.auth_gate_project_id) {
    // Use the auth gate project
    const projectInfo = await sql<Array<{ project_slug: string }>>`
      SELECT p.slug as project_slug
      FROM projects p
      WHERE p.id = ${env.auth_gate_project_id}
    `;
    if (projectInfo.length > 0) {
      projectSlug = projectInfo[0].project_slug;
    }
  }

  if (!projectSlug) {
    // Fall back to first auth-enabled project in org
    const projectInfo = await sql<Array<{ project_slug: string }>>`
      SELECT p.slug as project_slug
      FROM projects p
      JOIN auth_configs ac ON ac.project_id = p.id
      WHERE p.org_id = ${env.org_id}
        AND ac.enabled = true
      ORDER BY p.created_at ASC
      LIMIT 1
    `;
    if (projectInfo.length > 0) {
      projectSlug = projectInfo[0].project_slug;
    }
  }

  if (!projectSlug) {
    return Response.json({
      error: 'No auth project configured',
      message: 'This app has no auth configuration. Enable auth gate or configure a project.',
    }, { status: 404 });
  }

  // Determine the app's host for callback URLs
  const appHost = `${subdomain}.signaldb.app`;

  // Build the target URL for the auth service
  // Page routes (login, signup, etc.) go WITHOUT /api/ prefix:
  //   /auth/login → /{org}/{project}/login
  //   /auth/signup → /{org}/{project}/signup
  // API routes go WITH /api/ prefix:
  //   /auth/oauth/google → /api/{org}/{project}/oauth/google
  //   /auth/callback/google → /api/{org}/{project}/callback/google
  //   /auth/session → /api/{org}/{project}/session
  const pageRoutes = ['login', 'signup', 'forgot-password', 'reset-password', 'verify'];
  const isPageRoute = pageRoutes.some(r => authPath === r || authPath.startsWith(r + '?'));
  const targetPath = isPageRoute
    ? `/${orgSlug}/${projectSlug}/${authPath}`
    : `/api/${orgSlug}/${projectSlug}/${authPath}`;
  const targetUrl = new URL(originalUri, 'http://localhost');
  targetUrl.pathname = targetPath;
  const fullTargetUrl = `${AUTH_SERVICE_URL}${targetUrl.pathname}${targetUrl.search}`;

  try {
    // Clone headers but add app domain context
    const headers = new Headers(req.headers);
    headers.delete('X-Connect-Subdomain');
    headers.delete('X-App-Subdomain');
    headers.delete('X-Original-URI');

    // Tell auth service which domain to use for callbacks
    headers.set('X-SignalDB-App-Domain', appHost);
    headers.set('X-Forwarded-Host', appHost);
    headers.set('X-Forwarded-Proto', 'https');

    // Forward the request to auth service
    const proxyReq = new Request(fullTargetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      // @ts-ignore - Bun supports duplex
      duplex: 'half',
    });

    const response = await fetch(proxyReq, { redirect: 'manual' });

    // Clone response headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('Content-Encoding');
    responseHeaders.delete('Content-Length');

    // Rewrite Location header from auth.signaldb.app to app's domain
    const location = responseHeaders.get('Location');
    if (location) {
      // Rewrite auth.signaldb.app URLs to app's domain
      // e.g., https://auth.signaldb.app/api/demo/production/callback/google
      //    → https://demo.signaldb.app/auth/callback/google
      let newLocation = location;

      // Rewrite auth service callback URLs
      const authCallbackPattern = /^https?:\/\/auth\.signaldb\.app\/api\/[^/]+\/[^/]+\/(.+)$/;
      const match = location.match(authCallbackPattern);
      if (match) {
        newLocation = `https://${appHost}/auth/${match[1]}`;
      }

      // Also handle direct redirects to auth.signaldb.app
      if (newLocation.startsWith('https://auth.signaldb.app/')) {
        // Keep external OAuth redirects (Google, GitHub, etc.) unchanged
        // Only rewrite auth.signaldb.app → app domain for callback paths
        const authUrl = new URL(newLocation);
        if (authUrl.pathname.startsWith(`/api/${orgSlug}/${projectSlug}/`)) {
          const remainingPath = authUrl.pathname.replace(`/api/${orgSlug}/${projectSlug}/`, '');
          newLocation = `https://${appHost}/auth/${remainingPath}${authUrl.search}`;
        }
      }

      responseHeaders.set('Location', newLocation);
    }

    // Rewrite Set-Cookie domain from auth.signaldb.app to app's domain
    const setCookies = response.headers.getSetCookie?.() || [];
    if (setCookies.length > 0) {
      responseHeaders.delete('Set-Cookie');
      for (const cookie of setCookies) {
        // Replace domain=.signaldb.app or domain=auth.signaldb.app with the app's subdomain
        // For same-domain auth, we want cookies on the specific app domain
        let rewrittenCookie = cookie
          .replace(/domain=\.signaldb\.app/gi, `domain=${appHost}`)
          .replace(/domain=auth\.signaldb\.app/gi, `domain=${appHost}`);
        responseHeaders.append('Set-Cookie', rewrittenCookie);
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[connect-proxy] Same-domain auth error:', error);
    return Response.json({
      error: 'Auth service unavailable',
      message: 'Failed to connect to authentication service',
    }, { status: 502 });
  }
}

/**
 * Handle direct auth API: proxy /auth-api/* to auth service.
 * Unlike /auth/*, the URL already includes org and project slugs:
 *   /auth-api/demo/production/config → /api/demo/production/config
 *   /auth-api/demo/production/login  → /api/demo/production/login
 */
async function handleDirectAuthApi(
  req: Request,
  originalUri: string,
  subdomain: string
): Promise<Response> {
  const parsed = new URL(originalUri, 'http://localhost');
  // Replace /auth-api/ prefix with /api/
  const targetPath = parsed.pathname.replace(/^\/auth-api\//, '/api/');
  const fullTargetUrl = `${AUTH_SERVICE_URL}${targetPath}${parsed.search}`;

  try {
    const headers = new Headers(req.headers);
    headers.delete('X-Connect-Subdomain');
    headers.delete('X-App-Subdomain');
    headers.delete('X-Original-URI');

    const appHost = `${subdomain}.signaldb.app`;
    headers.set('X-SignalDB-App-Domain', appHost);
    headers.set('X-Forwarded-Host', appHost);
    headers.set('X-Forwarded-Proto', 'https');

    const proxyReq = new Request(fullTargetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      // @ts-ignore - Bun supports duplex
      duplex: 'half',
    });

    const response = await fetch(proxyReq, { redirect: 'manual' });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('Content-Encoding');
    responseHeaders.delete('Content-Length');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[connect-proxy] Direct auth API error:', error);
    return Response.json({
      error: 'Auth service unavailable',
      message: 'Failed to connect to authentication service',
    }, { status: 502 });
  }
}

/**
 * Handle proxy request to user app container
 */
export async function handleAppsProxy(req: Request): Promise<Response> {
  // Internal cache invalidation endpoint (localhost-only, no subdomain needed)
  const originalUri = req.headers.get('X-Original-URI') || '/';
  if (originalUri === '/__internal/invalidate-role-cache' && req.method === 'POST') {
    // Only allow from localhost (same machine)
    const realIp = req.headers.get('X-Real-IP') || '';
    if (realIp === '127.0.0.1' || realIp === '::1' || realIp === '') {
      try {
        const body = await req.json() as { projectId?: string };
        clearRoleDefsCache(body.projectId);
        return Response.json({ cleared: true, projectId: body.projectId || 'all' });
      } catch {
        clearRoleDefsCache();
        return Response.json({ cleared: true, projectId: 'all' });
      }
    }
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Support both new Connect header and legacy apps header
  const subdomain = req.headers.get('X-Connect-Subdomain') || req.headers.get('X-App-Subdomain');

  if (!subdomain) {
    return Response.json({
      error: 'Invalid subdomain',
      message: 'Could not determine app from subdomain',
    }, { status: 400 });
  }

  // Look up the environment
  const env = await lookupEnvironment(subdomain);

  if (!env) {
    return Response.json({
      error: 'App not found',
      message: `No app found for subdomain: ${subdomain}`,
      hint: 'Check that the org, app, and environment names are correct',
    }, { status: 404 });
  }

  // Check if environment is running
  if (env.status !== 'running') {
    // Auto-recovery: if status is 'failed' but container is actually healthy, fix the status
    if (env.status === 'failed' && env.deployment_mode === 'container' && env.container_ip) {
      try {
        const healthRes = await fetch(`http://${env.container_ip}:3000/health`, { signal: AbortSignal.timeout(2000) });
        if (healthRes.ok) {
          await sql`UPDATE app_environments SET status = 'running', updated_at = now() WHERE id = ${env.environment_id}`;
          env.status = 'running';
          // Invalidate cache for this subdomain
          environmentCache.delete(env.subdomain);
          console.log(`[apps-proxy] Auto-recovered env ${env.environment_id} from 'failed' to 'running'`);
        }
      } catch { /* container really is down, fall through to 503 */ }
    }

    if (env.status !== 'running') {
      return Response.json({
        error: 'App not running',
        message: `App "${env.app_name}" (${env.env_name}) is ${env.status}`,
        status: env.status,
        hint: env.status === 'pending' ? 'App is being deployed' :
              env.status === 'building' ? 'App is being built' :
              env.status === 'stopped' ? 'App has been stopped' :
              'Check deployment logs for details',
      }, { status: 503 });
    }
  }

  // Maintenance mode intercept — skip for /health so deploy health checks still pass
  if (env.maintenance_mode) {
    const checkPath = new URL(originalUri, 'http://localhost').pathname;
    if (checkPath !== '/health') {
      if (env.maintenance_url) {
        return new Response(null, {
          status: 302,
          headers: { Location: env.maintenance_url },
        });
      }
      return new Response(getMaintenancePage(env.app_name), {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Retry-After': '300',
        },
      });
    }
  }

  // Check if container is configured (container-mode apps can route via container_ip instead of port)
  const hasRouting = env.port || (env.deployment_mode === 'container' && env.container_ip);
  if (!hasRouting) {
    return Response.json({
      error: 'App not configured',
      message: `App "${env.app_name}" (${env.env_name}) has no port or container IP assigned`,
    }, { status: 503 });
  }

  // Check visibility: internal-only apps reject external requests
  if (env.visibility === 'internal') {
    const realIp = req.headers.get('X-Real-IP') || '';
    if (realIp !== '127.0.0.1' && realIp !== '::1') {
      return Response.json({
        error: 'This app is internal-only',
        message: `App "${env.app_name}" (${env.env_name}) is configured for internal access only`,
      }, { status: 403 });
    }
  }

  // Parse URL path once for all auth checks
  const urlPath = new URL(originalUri, 'http://localhost').pathname;

  // Same-domain auth: intercept /auth/* and proxy to auth service
  // This allows OAuth callbacks to land on the app's domain, fixing cross-domain cookie issues
  if (urlPath.startsWith('/auth/')) {
    return await handleSameDomainAuth(req, env, originalUri, subdomain);
  }

  // Direct auth API: intercept /auth-api/* and proxy to auth service
  // Apps that embed org/project in the URL (e.g., /auth-api/demo/production/config)
  // map directly to the auth service's /api/demo/production/config
  if (urlPath.startsWith('/auth-api/')) {
    return await handleDirectAuthApi(req, originalUri, subdomain);
  }

  // ================================================================
  // Parse gate cookie for ALL requests (identity available to all apps)
  // ================================================================
  const cookieHeader = req.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const existingGateToken = cookies[GATE_COOKIE_NAME];
  const gatePayload = existingGateToken ? verifyGateToken(existingGateToken) : null;

  // ================================================================
  // /__auth/* handlers — work for ALL apps (gated or not)
  // ================================================================

  // /__auth/callback — cookie-based token exchange (no JWT in URL)
  if (urlPath === '/__auth/callback') {
    const callbackUrl = new URL(originalUri, 'http://localhost');
    const redirectPath = callbackUrl.searchParams.get('redirect') || '/';
    const exchangeToken = cookies['sdb_auth_exchange'];

    if (!exchangeToken) {
      console.error('[connect-proxy] Auth callback: no exchange cookie');
      return new Response(null, { status: 302, headers: { 'Location': '/' } });
    }

    // Verify HMAC signature on exchange cookie
    const exchParts = exchangeToken.split('.');
    if (exchParts.length !== 2) {
      return new Response(null, { status: 302, headers: { 'Location': '/' } });
    }

    const [exchEncoded, exchSig] = exchParts;
    const expectedExchSig = crypto.createHmac('sha256', GATE_SECRET).update(exchEncoded).digest('base64url');

    const exchSigBuf = Buffer.from(exchSig);
    const expectedExchBuf = Buffer.from(expectedExchSig);
    if (exchSigBuf.length !== expectedExchBuf.length ||
        !crypto.timingSafeEqual(exchSigBuf, expectedExchBuf)) {
      console.error('[connect-proxy] Auth callback: exchange cookie signature invalid');
      return new Response(null, { status: 302, headers: { 'Location': '/' } });
    }

    let exchangeData: { userId: string; email: string; projectId: string; role: string; exp: number };
    try {
      exchangeData = JSON.parse(Buffer.from(exchEncoded, 'base64url').toString());
    } catch {
      return new Response(null, { status: 302, headers: { 'Location': '/' } });
    }

    // Check 60-second expiry
    if (exchangeData.exp < Date.now()) {
      console.error('[connect-proxy] Auth callback: exchange cookie expired');
      return new Response(null, { status: 302, headers: { 'Location': '/' } });
    }

    // Create gate token from exchange data (permissions resolved server-side, not stored in token)
    const newGateToken = createGateToken({
      userId: exchangeData.userId,
      email: exchangeData.email,
      projectId: exchangeData.projectId,
      role: exchangeData.role || 'member',
    });

    // Set gate cookie, clear exchange cookie, redirect to app
    const callbackHeaders = new Headers();
    callbackHeaders.set('Location', redirectPath);
    callbackHeaders.append('Set-Cookie', `${GATE_COOKIE_NAME}=${newGateToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}`);
    callbackHeaders.append('Set-Cookie', 'sdb_auth_exchange=; Path=/__auth; HttpOnly; SameSite=Lax; Max-Age=0');

    return new Response(null, { status: 302, headers: callbackHeaders });
  }

  // /__auth/logout — clear gate cookie
  if (urlPath === '/__auth/logout') {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': `${GATE_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      },
    });
  }

  // /__auth/me — return authenticated user info from gate token + cached role definitions
  if (urlPath === '/__auth/me' && req.method === 'GET') {
    if (gatePayload) {
      // Resolve permissions server-side from cached role definitions
      const roleDefs = await getCachedRoleDefinitions(gatePayload.projectId);
      const permissions = resolvePermissionsFromDefs(roleDefs, gatePayload.role);
      return Response.json({
        authenticated: true,
        user: {
          id: gatePayload.userId,
          email: gatePayload.email,
          role: gatePayload.role || 'member',
          permissions,
        },
        expiresAt: gatePayload.exp,
      }, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    return Response.json({ authenticated: false, user: null, expiresAt: null }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  // /__auth/refresh — issue fresh gate token with reset TTL
  if (urlPath === '/__auth/refresh' && req.method === 'POST') {
    if (!gatePayload) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const refreshedToken = createGateToken({
      userId: gatePayload.userId,
      email: gatePayload.email,
      projectId: gatePayload.projectId,
      role: gatePayload.role || 'member',
    });

    return Response.json({ refreshed: true }, {
      headers: {
        'Set-Cookie': `${GATE_COOKIE_NAME}=${refreshedToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  // ================================================================
  // Auth gate enforcement (only for gated apps)
  // ================================================================
  if (env.auth_gate_enabled && env.auth_gate_project_id) {
    const excludePaths = Array.isArray(env.auth_gate_exclude_paths) ? env.auth_gate_exclude_paths : [];

    // Skip auth for /__auth/* paths and user-configured exclude paths
    if (!urlPath.startsWith('/__auth/') && !isPathExcluded(urlPath, excludePaths)) {
      const isAuthenticated = gatePayload && gatePayload.projectId === env.auth_gate_project_id;

      if (!isAuthenticated) {
        const appHost = `${subdomain}.signaldb.app`;

        // If the URL contains a password reset or verification token, redirect to the
        // appropriate auth page. Only check specific param names (NOT generic 'token').
        const parsedUri = new URL(originalUri, 'http://localhost');
        const resetToken = parsedUri.searchParams.get('reset_token');
        const verifyToken = parsedUri.searchParams.get('verify_token');
        if (resetToken && urlPath === '/') {
          return new Response(null, {
            status: 302,
            headers: { 'Location': `https://${appHost}/auth/reset-password?token=${encodeURIComponent(resetToken)}` },
          });
        }
        if (verifyToken && urlPath === '/') {
          return new Response(null, {
            status: 302,
            headers: { 'Location': `https://${appHost}/auth/verify?token=${encodeURIComponent(verifyToken)}` },
          });
        }

        // Look up project's org/slug for the login URL
        try {
          const projectInfo = await sql<Array<{ org_slug: string; project_slug: string }>>`
            SELECT o.slug as org_slug, p.slug as project_slug
            FROM projects p
            JOIN organizations o ON o.id = p.org_id
            WHERE p.id = ${env.auth_gate_project_id}
          `;

          if (projectInfo.length > 0) {
            // Strip auth-related token params from the redirect URL
            const cleanUri = new URL(originalUri, 'http://localhost');
            cleanUri.searchParams.delete('token');
            cleanUri.searchParams.delete('reset_token');
            cleanUri.searchParams.delete('verify_token');
            const cleanPath = cleanUri.pathname + cleanUri.search;

            // Redirect to login — form JS handles /__auth/callback wrapping via exchange cookie
            const loginUrl = `https://${appHost}/auth/login?redirect=${encodeURIComponent(cleanPath)}`;
            return new Response(null, {
              status: 302,
              headers: { 'Location': loginUrl },
            });
          }
        } catch (error) {
          console.error('[connect-proxy] Auth gate redirect error:', error);
        }

        return Response.json({
          error: 'Authentication required',
          message: 'This app requires authentication',
        }, { status: 401 });
      }
    }
  }

  // ================================================================
  // Proxy the request to the app container
  // ================================================================
  const targetHost = (env.deployment_mode === 'container' && env.container_ip)
    ? env.container_ip
    : CONNECT_APP_HOST;
  const targetPort = (env.deployment_mode === 'container' && env.container_ip)
    ? 3000
    : env.port;
  const targetUrl = `http://${targetHost}:${targetPort}${originalUri}`;

  try {
    // Clone headers but remove proxy-specific ones
    const headers = new Headers(req.headers);
    headers.delete('X-Connect-Subdomain');
    headers.delete('X-App-Subdomain');
    headers.delete('X-Original-URI');

    // Add app context headers
    headers.set('X-SignalDB-App-Id', env.app_id);
    headers.set('X-SignalDB-Env-Id', env.environment_id);
    headers.set('X-SignalDB-Org-Id', env.org_id);

    // Anti-spoofing: strip any incoming identity headers (could be forged by client)
    headers.delete('X-SignalDB-User-Id');
    headers.delete('X-SignalDB-User-Email');
    headers.delete('X-SignalDB-User-Roles');
    headers.delete('X-SignalDB-User-Permissions');
    headers.delete('X-SignalDB-Auth-Verified');

    // Inject verified identity from gate token (if authenticated)
    // Permissions are resolved server-side from cached role definitions (v2)
    if (gatePayload) {
      headers.set('X-SignalDB-User-Id', gatePayload.userId);
      headers.set('X-SignalDB-User-Email', gatePayload.email);
      headers.set('X-SignalDB-User-Roles', gatePayload.role || 'member');
      headers.set('X-SignalDB-Auth-Verified', 'true');
      const roleDefs = await getCachedRoleDefinitions(gatePayload.projectId);
      const perms = resolvePermissionsFromDefs(roleDefs, gatePayload.role);
      headers.set('X-SignalDB-User-Permissions', perms.join(','));
    }

    // Forward the request
    const proxyReq = new Request(targetUrl, {
      method: req.method,
      headers,
      body: req.body,
      // @ts-ignore - Bun supports duplex
      duplex: 'half',
    });

    // Don't follow redirects - pass them through to the client
    const response = await fetch(proxyReq, { redirect: 'manual' });

    // Clone headers, removing Content-Encoding since Bun auto-decompresses
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('Content-Encoding');
    responseHeaders.delete('Content-Length');

    const proxyRes = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

    proxyRes.headers.set('X-SignalDB-Connect', `${env.app_slug}.${env.org_slug}/${env.env_name}`);

    return proxyRes;
  } catch (error) {
    console.error('[connect-proxy] Proxy error:', error);

    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      return Response.json({
        error: 'App unavailable',
        message: `Cannot connect to app "${env.app_name}" (${env.env_name})`,
        hint: 'The app container may have crashed or is starting up',
      }, { status: 502 });
    }

    return Response.json({
      error: 'Proxy error',
      message: 'Failed to proxy request to app',
    }, { status: 502 });
  }
}

/**
 * Health check for a specific app environment
 */
export async function handleAppHealthCheck(req: Request): Promise<Response> {
  // Support both new Connect header and legacy apps header
  const subdomain = req.headers.get('X-Connect-Subdomain') || req.headers.get('X-App-Subdomain');

  if (!subdomain) {
    return Response.json({ error: 'Invalid subdomain' }, { status: 400 });
  }

  const env = await lookupEnvironment(subdomain);

  if (!env) {
    return Response.json({
      status: 'not_found',
      subdomain,
    }, { status: 404 });
  }

  const hasRoutingInfo = env.port || (env.deployment_mode === 'container' && env.container_ip);
  if (env.status !== 'running' || !hasRoutingInfo) {
    return Response.json({
      status: env.status,
      app: env.app_name,
      environment: env.env_name,
      port: env.port,
    }, { status: 503 });
  }

  // Try to hit the container's health endpoint
  try {
    const healthHost = (env.deployment_mode === 'container' && env.container_ip)
      ? env.container_ip
      : CONNECT_APP_HOST;
    const healthPort = (env.deployment_mode === 'container' && env.container_ip)
      ? 3000
      : env.port;
    const healthUrl = `http://${healthHost}:${healthPort}/health`;
    const response = await fetch(healthUrl, { method: 'GET' });

    return Response.json({
      status: response.ok ? 'healthy' : 'unhealthy',
      app: env.app_name,
      environment: env.env_name,
      containerStatus: response.status,
    }, { status: response.ok ? 200 : 503 });
  } catch (error) {
    return Response.json({
      status: 'unreachable',
      app: env.app_name,
      environment: env.env_name,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
