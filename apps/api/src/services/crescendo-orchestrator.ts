/**
 * Crescendo Build Orchestrator
 *
 * Runs the full build pipeline after a spec is approved:
 * - New app: createProject → createApp → deploy (scaffold) → push PRD → forge plan → forge execute → post-build deploy
 * - Existing app: create Forge story → plan → execute → post-build deploy
 *
 * Runs asynchronously. Updates crescendo_sessions state at each transition.
 */

import { sql } from '../lib/db';
import type { CrescendoSpec } from './crescendo-ai';

const DEPLOY_AGENT_URL = process.env.DEPLOY_AGENT_URL || 'http://127.0.0.1:4100';
const FORGE_DAEMON_URL = process.env.FORGE_DAEMON_URL || 'http://127.0.0.1:3015';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BuildContext {
  targetAppId?: string;
  targetEnvName: string;
  createdBy: string;
  memberId: string;
}

type SessionState = 'approved' | 'scaffolding' | 'forging' | 'deploying' | 'complete' | 'failed';

// ─── Main Build Pipeline ────────────────────────────────────────────────────

export async function runCrescendoBuild(
  sessionId: string,
  orgId: string,
  orgSlug: string,
  spec: CrescendoSpec,
  context: BuildContext,
): Promise<void> {
  try {
    if (context.targetAppId) {
      await runFeatureBuild(sessionId, orgId, orgSlug, spec, context);
    } else {
      await runNewAppBuild(sessionId, orgId, orgSlug, spec, context);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[crescendo] Build failed for session ${sessionId}:`, errorMsg);
    await updateSession(sessionId, 'failed', { build_error: errorMsg });
  }
}

// ─── New App Build ──────────────────────────────────────────────────────────

async function runNewAppBuild(
  sessionId: string,
  orgId: string,
  orgSlug: string,
  spec: CrescendoSpec,
  context: BuildContext,
): Promise<void> {
  // Step 1: Scaffold — create project + app
  await updateSession(sessionId, 'scaffolding');

  let projectId: string | undefined;
  let appId: string;

  // Create project if database is enabled
  if (spec.databaseEnabled !== false) {
    const projResult = await sql`
      INSERT INTO projects (org_id, name, slug, environment)
      VALUES (${orgId}, ${spec.appName}, ${spec.slug}, 'production')
      RETURNING id
    `;
    projectId = projResult[0]?.id;
  }

  // Create app
  const framework = spec.framework || 'react-router';
  const appResult = await sql`
    INSERT INTO apps (org_id, name, slug, description, framework, settings)
    VALUES (
      ${orgId},
      ${spec.appName},
      ${spec.slug},
      ${spec.description},
      ${framework},
      '{}'::jsonb
    )
    RETURNING id
  `;
  appId = appResult[0].id;

  // Create production environment
  const port = await allocatePort();
  await sql`
    INSERT INTO app_environments (
      app_id, name, port, status, subdomain,
      deployment_mode, project_id
    ) VALUES (
      ${appId}, 'production', ${port}, 'pending', ${orgSlug},
      'container', ${projectId || null}
    )
  `;

  // Link app to session
  await sql`
    UPDATE crescendo_sessions
    SET app_id = ${appId}, updated_at = now()
    WHERE id = ${sessionId}
  `;

  // Enable auth gate if auth is enabled
  if (spec.authEnabled !== false && projectId) {
    try {
      await sql`
        INSERT INTO auth_configs (project_id) VALUES (${projectId}) ON CONFLICT DO NOTHING
      `;
      await sql`
        UPDATE app_environments
        SET auth_gate_enabled = true,
            auth_gate_project_id = ${projectId},
            auth_gate_exclude_paths = '["\/health"]'::jsonb
        WHERE app_id = ${appId}
      `;
    } catch {
      // Non-critical
    }
  }

  // Deploy (scaffold) via deploy agent
  try {
    const deployRes = await fetch(`${DEPLOY_AGENT_URL}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        envName: 'production',
        orgSlug,
        appSlug: spec.slug,
        framework,
      }),
    });

    if (!deployRes.ok) {
      const err = await deployRes.text().catch(() => 'Deploy agent error');
      throw new Error(`Scaffold deploy failed: ${err}`);
    }
  } catch (err) {
    throw new Error(`Scaffold failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 2: Forge — create story and run plan → execute
  await runForgePhase(sessionId, orgId, orgSlug, spec, appId, context);
}

// ─── Feature Build (Existing App) ───────────────────────────────────────────

async function runFeatureBuild(
  sessionId: string,
  orgId: string,
  orgSlug: string,
  spec: CrescendoSpec,
  context: BuildContext,
): Promise<void> {
  const appId = context.targetAppId!;

  // Verify app exists and belongs to org
  const appCheck = await sql`
    SELECT id, slug FROM apps WHERE id = ${appId} AND org_id = ${orgId}
  `;
  if (appCheck.length === 0) {
    throw new Error('Target app not found');
  }

  // Link app to session
  await sql`
    UPDATE crescendo_sessions
    SET app_id = ${appId}, updated_at = now()
    WHERE id = ${sessionId}
  `;

  await runForgePhase(sessionId, orgId, orgSlug, spec, appId, context);
}

// ─── Forge Phase ────────────────────────────────────────────────────────────

async function runForgePhase(
  sessionId: string,
  orgId: string,
  orgSlug: string,
  spec: CrescendoSpec,
  appId: string,
  context: BuildContext,
): Promise<void> {
  await updateSession(sessionId, 'forging');

  // Build story prompt from spec
  const prompt = buildStoryPrompt(spec);

  // Create a Forge story via the daemon
  const spawnRes = await fetch(`${FORGE_DAEMON_URL}/spawn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgId,
      orgSlug,
      memberId: context.memberId,
      message: prompt,
      command: 'plan',
      appId,
    }),
  });

  if (!spawnRes.ok) {
    const err = await spawnRes.text().catch(() => 'Forge daemon error');
    throw new Error(`Forge plan failed: ${err}`);
  }

  const spawnResult = await spawnRes.json() as { jobId: string; storyId?: string };

  // Save story ID to session
  await sql`
    UPDATE crescendo_sessions
    SET story_id = ${spawnResult.storyId || null}::uuid, updated_at = now()
    WHERE id = ${sessionId}
  `;

  // Wait for plan phase to complete (poll every 5s, max 5 min)
  await waitForJob(spawnResult.jobId, 5 * 60 * 1000);

  // Spawn execute phase
  const execRes = await fetch(`${FORGE_DAEMON_URL}/spawn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgId,
      orgSlug,
      memberId: context.memberId,
      message: 'Execute the planned tasks',
      command: 'execute',
      storyId: spawnResult.storyId,
      appId,
    }),
  });

  if (!execRes.ok) {
    const err = await execRes.text().catch(() => 'Forge daemon error');
    throw new Error(`Forge execute failed: ${err}`);
  }

  const execResult = await execRes.json() as { jobId: string };

  // Wait for execute phase to complete (max 15 min)
  // The forge daemon handles post-execute rebuild (install, build, restart)
  await waitForJob(execResult.jobId, 15 * 60 * 1000);

  // Mark deploying (forge daemon already handles the actual deploy/restart)
  await updateSession(sessionId, 'deploying');

  // Wait a bit for post-execute rebuild to finish
  await sleep(10000);

  // Mark complete
  await updateSession(sessionId, 'complete');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function updateSession(
  sessionId: string,
  state: SessionState,
  extra?: { build_error?: string },
): Promise<void> {
  if (extra?.build_error) {
    await sql`
      UPDATE crescendo_sessions
      SET state = ${state}, build_error = ${extra.build_error}, updated_at = now()
      WHERE id = ${sessionId}
    `;
  } else {
    await sql`
      UPDATE crescendo_sessions
      SET state = ${state}, updated_at = now()
      WHERE id = ${sessionId}
    `;
  }

  // Notify for SSE listeners
  try {
    await sql`SELECT pg_notify('crescendo_' || ${sessionId}, ${state})`;
  } catch {
    // Non-critical
  }
}

async function waitForJob(jobId: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  const pollInterval = 5000;

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await sql`
        SELECT done, error FROM ai_chat_jobs WHERE id = ${jobId}
      `;
      if (result.length > 0 && result[0].done) {
        if (result[0].error) {
          throw new Error(`Job ${jobId} failed: ${result[0].error}`);
        }
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('failed')) throw err;
      // DB error, keep polling
    }

    await sleep(pollInterval);
  }

  throw new Error(`Job ${jobId} timed out after ${timeoutMs / 1000}s`);
}

async function allocatePort(): Promise<number> {
  // Find next available port starting from 4013
  const result = await sql`
    SELECT COALESCE(MAX(port), 4012) + 1 as next_port
    FROM app_environments
    WHERE port >= 4000
  `;
  return result[0]?.next_port || 4013;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildStoryPrompt(spec: CrescendoSpec): string {
  const sections: string[] = [];

  sections.push(`# Build: ${spec.appName}\n`);
  sections.push(`## Description\n\n${spec.description}\n`);

  if (spec.entities.length > 0) {
    sections.push(`## Data Model\n\nCore entities: ${spec.entities.join(', ')}\n`);
  }

  if (spec.routes.length > 0) {
    sections.push(`## Routes\n\n${spec.routes.map(r => `- \`${r}\``).join('\n')}\n`);
  }

  if (spec.roles.length > 0) {
    sections.push(`## User Roles\n\n${spec.roles.map(r => `- ${r}`).join('\n')}\n`);
  }

  if (spec.features.length > 0) {
    sections.push(`## Features\n\n${spec.features.map(f => `- ${f}`).join('\n')}\n`);
  }

  sections.push(`## Technical Stack\n`);
  sections.push(`- **Framework:** ${spec.framework || 'react-router'}`);
  sections.push(`- **Authentication:** ${spec.authEnabled !== false ? 'Enabled (SignalDB built-in auth)' : 'Disabled'}`);
  sections.push(`- **Database:** ${spec.databaseEnabled !== false ? 'Enabled (PostgreSQL)' : 'Disabled'}`);
  sections.push(`- **App slug:** \`${spec.slug}\``);

  if (spec.prd) {
    sections.push(`\n## Full PRD\n\n${spec.prd}`);
  }

  return sections.join('\n');
}
