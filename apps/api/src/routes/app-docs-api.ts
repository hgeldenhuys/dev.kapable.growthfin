/**
 * App Docs API — Read markdown files from a running container's docs/ directory
 *
 * Endpoints:
 *   GET /v1/apps/:appId/docs      - List .md files in docs/
 *   GET /v1/apps/:appId/docs/*    - Read specific file content
 */

import type { AdminContext } from '../lib/admin-auth';
import { sql } from '../lib/db';

const DEPLOY_AGENT_URL = process.env.DEPLOY_AGENT_URL || 'http://127.0.0.1:4100';
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || '';

async function containerExec(
  containerName: string,
  command: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const response = await fetch(`${DEPLOY_AGENT_URL}/container-exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Deploy-Secret': DEPLOY_SECRET,
    },
    body: JSON.stringify({
      containerName,
      command,
      timeoutMs: 10_000,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Deploy agent error: ${response.status} ${text}`);
  }

  return await response.json() as { exitCode: number; stdout: string; stderr: string };
}

async function resolveContainerName(appId: string): Promise<string | null> {
  const rows = await sql`
    SELECT container_name FROM app_environments
    WHERE app_id = ${appId} AND name = 'prod'
    AND container_name IS NOT NULL
    LIMIT 1
  `;
  if (rows.length > 0) return rows[0].container_name;

  // Fallback: any environment with a container
  const fallback = await sql`
    SELECT container_name FROM app_environments
    WHERE app_id = ${appId} AND container_name IS NOT NULL
    ORDER BY CASE WHEN name = 'production' THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1
  `;
  return fallback.length > 0 ? fallback[0].container_name : null;
}

export async function handleAppDocsRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext,
): Promise<Response | null> {
  // Match /v1/apps/:appId/docs or /v1/apps/:appId/docs/*
  const docsMatch = pathname.match(/^\/v1\/apps\/([^/]+)\/docs(?:\/(.+))?$/);
  if (!docsMatch || req.method !== 'GET') return null;

  const appId = docsMatch[1];
  const filePath = docsMatch[2]; // undefined for list, filename for read

  // Verify app belongs to this org
  const appRows = await sql`
    SELECT id FROM apps WHERE id = ${appId} AND organization_id = ${ctx.orgId}
  `;
  if (appRows.length === 0) {
    return Response.json({ error: 'App not found' }, { status: 404 });
  }

  const containerName = await resolveContainerName(appId);
  if (!containerName) {
    return Response.json({ error: 'No running container found for this app' }, { status: 404 });
  }

  if (!filePath) {
    // List docs
    try {
      const result = await containerExec(
        containerName,
        'find docs/ -name "*.md" -type f 2>/dev/null | sort',
      );
      if (result.exitCode !== 0 || !result.stdout.trim()) {
        return Response.json({ files: [], message: 'No docs/ directory found' });
      }
      const files = result.stdout.trim().split('\n').filter(Boolean);
      return Response.json({ files });
    } catch (err: any) {
      return Response.json({ files: [], error: err.message });
    }
  }

  // Read specific file — validate filename
  if (filePath.includes('..') || !filePath.endsWith('.md')) {
    return Response.json({ error: 'Invalid filename. Must be a .md file with no path traversal.' }, { status: 400 });
  }

  try {
    const safePath = `docs/${filePath}`;
    const result = await containerExec(containerName, `cat "${safePath}" 2>/dev/null`);
    if (result.exitCode !== 0) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }
    return Response.json({ filename: filePath, content: result.stdout });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
