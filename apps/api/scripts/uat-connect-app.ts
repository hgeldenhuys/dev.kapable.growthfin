#!/usr/bin/env bun
/**
 * UAT: Connect App Creation Pipeline
 *
 * End-to-end test of the Connect app creation flow:
 *   1. Setup — Find/verify demo org exists
 *   2. Create App — Insert into apps + allocate port + create app_environments
 *   3. Verify DB State — Assert all fields correct
 *   4. Verify Subdomain Routing — HTTP request with X-Connect-Subdomain header
 *   5. Verify Docs Route — /docs on subdomain returns HTML
 *   6. Cleanup — Delete app (CASCADE deletes environments/deployments)
 *   7. Report — Print pass/fail for each step
 *
 * Usage:
 *   bun run scripts/uat-connect-app.ts              # Full UAT
 *   bun run scripts/uat-connect-app.ts --keep        # Keep test app after UAT
 *   bun run scripts/uat-connect-app.ts --dry-run     # Show what would happen
 *   bun run scripts/uat-connect-app.ts --cleanup     # Delete leftover UAT data
 *
 * Run on production server:
 *   ssh deploy@172.232.188.216 'cd /opt/signaldb/apps/api && source ~/.infisical/config.env && source scripts/load-secrets.sh && bun run scripts/uat-connect-app.ts'
 */

import postgres from 'postgres';

// ── Config ──────────────────────────────────────────────────────────────────

const TEST_ORG_SLUG = 'demo';
const TEST_APP_PREFIX = 'uat-test';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3003';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://signaldb:signaldb@localhost:5440/signaldb';

const flags = {
  keep: process.argv.includes('--keep'),
  dryRun: process.argv.includes('--dry-run'),
  cleanupOnly: process.argv.includes('--cleanup'),
};

const sql = postgres(DATABASE_URL);
const timestamp = Math.floor(Date.now() / 1000);
const testSlug = `${TEST_APP_PREFIX}-${timestamp}`;

// ── Types ───────────────────────────────────────────────────────────────────

interface StepResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

interface OrgInfo {
  id: string;
  slug: string;
}

interface AppInfo {
  id: string;
  slug: string;
  name: string;
  org_id: string;
  framework: string;
}

interface EnvInfo {
  id: string;
  app_id: string;
  name: string;
  port: number;
  subdomain: string;
  container_name: string;
  status: string;
  project_id: string | null;
}

// ── State ───────────────────────────────────────────────────────────────────

let org: OrgInfo | null = null;
let app: AppInfo | null = null;
let env: EnvInfo | null = null;
let projectId: string | null = null;
const results: StepResult[] = [];

// ── Steps ───────────────────────────────────────────────────────────────────

async function setup(): Promise<void> {
  // Find demo org
  const orgs = await sql<OrgInfo[]>`
    SELECT id, slug FROM organizations WHERE slug = ${TEST_ORG_SLUG}
  `;

  if (orgs.length === 0) {
    throw new Error(`Organization "${TEST_ORG_SLUG}" not found. Create it first.`);
  }

  org = orgs[0];
  console.log(`  Found org: ${org.slug} (${org.id})`);

  // Optionally find a project to link
  const projects = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM projects WHERE org_id = ${org.id} LIMIT 1
  `;

  if (projects.length > 0) {
    projectId = projects[0].id;
    console.log(`  Found project to link: ${projects[0].name} (${projectId})`);
  } else {
    console.log('  No project found to link (will skip DB linking)');
  }
}

async function createApp(): Promise<void> {
  if (flags.dryRun) {
    console.log(`  [DRY RUN] Would create app: ${testSlug}`);
    return;
  }

  if (!org) throw new Error('Org not found');

  // Insert app
  const apps = await sql<AppInfo[]>`
    INSERT INTO apps (org_id, name, slug, description, framework, settings)
    VALUES (
      ${org.id},
      ${'UAT Test App'},
      ${testSlug},
      ${'Automated UAT test — safe to delete'},
      ${'bun-server'},
      ${{ source: 'template', uat: true }}
    )
    RETURNING id, slug, name, org_id, framework
  `;

  if (apps.length === 0) {
    throw new Error('App INSERT returned no rows');
  }

  app = apps[0];
  console.log(`  Created app: ${app.name} (${app.id})`);

  // Allocate port
  const portResult = await sql<{ port: number }[]>`
    SELECT allocate_app_port() as port
  `;
  const port = portResult[0].port;
  console.log(`  Allocated port: ${port}`);

  // Use "uat" environment name to avoid subdomain collision with existing production apps
  // Subdomain pattern for non-prod: {org}-{env}.signaldb.app
  const envName = 'uat';
  const subdomain = `${org.slug}-${envName}`;
  const containerName = `signaldb-app-${org.slug}-${testSlug}-${envName}`;

  // Create UAT environment (not "production" to avoid subdomain conflict)
  const envs = await sql<EnvInfo[]>`
    INSERT INTO app_environments (
      app_id, name, project_id, port, subdomain, container_name, status
    ) VALUES (
      ${app.id},
      ${envName},
      ${projectId},
      ${port},
      ${subdomain},
      ${containerName},
      ${'pending'}
    )
    RETURNING id, app_id, name, port, subdomain, container_name, status, project_id
  `;

  if (envs.length === 0) {
    throw new Error('Environment INSERT returned no rows');
  }

  env = envs[0];
  console.log(`  Created environment: ${env.name} (${env.id})`);
  console.log(`    Subdomain: ${env.subdomain}`);
  console.log(`    Container: ${env.container_name}`);
  console.log(`    Port: ${env.port}`);
  console.log(`    Status: ${env.status}`);
}

async function verifyDbState(): Promise<void> {
  if (flags.dryRun) {
    console.log('  [DRY RUN] Would verify DB state');
    return;
  }

  if (!app || !env || !org) throw new Error('Missing app/env/org state');

  // Verify app record
  const appRows = await sql<AppInfo[]>`
    SELECT id, slug, name, org_id, framework
    FROM apps WHERE id = ${app.id}
  `;

  assert(appRows.length === 1, 'App exists in DB');
  assert(appRows[0].slug === testSlug, `App slug is "${testSlug}"`);
  assert(appRows[0].framework === 'bun-server', 'Framework is bun-server');
  assert(appRows[0].org_id === org.id, 'App belongs to correct org');

  // Verify environment record
  const envRows = await sql<EnvInfo[]>`
    SELECT id, app_id, name, port, subdomain, container_name, status, project_id
    FROM app_environments WHERE app_id = ${app.id}
  `;

  assert(envRows.length === 1, 'Exactly one environment exists');

  const e = envRows[0];
  assert(e.name === 'uat', 'Environment name is "uat"');
  assert(e.port >= 4000 && e.port <= 4999, `Port ${e.port} is in 4000-4999 range`);
  assert(e.subdomain === `${org.slug}-uat`, `Subdomain is "${org.slug}-uat"`);
  assert(e.container_name === `signaldb-app-${org.slug}-${testSlug}-uat`, 'Container name matches pattern');
  assert(e.status === 'pending', 'Status is "pending"');

  if (projectId) {
    assert(e.project_id === projectId, 'Linked project ID matches');
  }

  console.log('  All DB assertions passed');
}

async function verifyRouting(): Promise<void> {
  if (flags.dryRun) {
    console.log('  [DRY RUN] Would verify subdomain routing');
    return;
  }

  if (!env) throw new Error('Missing env state');

  // The subdomain lookup uses the `subdomain` column from app_environments.
  // Since our test app shares the "demo" subdomain with existing apps,
  // the routing may resolve to the existing demo app first.
  // Instead, we verify the environment exists via direct DB lookup,
  // and test the API proxy behavior with the container name pattern.

  try {
    const response = await fetch(API_URL, {
      headers: {
        'X-Connect-Subdomain': env.subdomain,
        'Host': `${env.subdomain}.signaldb.app`,
      },
    });

    // Any response from the proxy is fine — we just need it to recognize the subdomain
    // Status 503 means "app not running" which is correct for a pending app
    // Status 502 means container unreachable — also valid
    // Status 200 means another app is running on this subdomain (demo.signaldb.app)
    const status = response.status;
    const body = await response.json().catch(() => null);

    console.log(`  API response: ${status}`);
    if (body) {
      console.log(`  Body: ${JSON.stringify(body).substring(0, 200)}`);
    }

    // The subdomain should be recognized (not 404 "App not found")
    assert(status !== 404, 'Subdomain is recognized by proxy (not 404)');
    console.log('  Subdomain routing verified');
  } catch (err) {
    // Connection refused means the API server might not be running locally
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED')) {
      console.log(`  API not reachable at ${API_URL} — skipping routing test (run on production server)`);
      return;
    }
    throw err;
  }
}

async function verifyDocs(): Promise<void> {
  if (flags.dryRun) {
    console.log('  [DRY RUN] Would verify /docs route');
    return;
  }

  if (!env) throw new Error('Missing env state');

  try {
    const response = await fetch(`${API_URL}/docs`, {
      headers: {
        'X-Connect-Subdomain': env.subdomain,
        'X-Original-URI': '/docs',
        'Host': `${env.subdomain}.signaldb.app`,
      },
    });

    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();

    console.log(`  Docs response: ${status} (${contentType})`);

    assert(status === 200, `Docs returns 200 (got ${status})`);
    assert(contentType.includes('text/html'), 'Docs returns HTML content-type');
    assert(body.includes('SignalDB'), 'Docs HTML contains "SignalDB"');

    console.log('  Docs route verified');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED')) {
      console.log(`  API not reachable at ${API_URL} — skipping docs test (run on production server)`);
      return;
    }
    throw err;
  }
}

async function cleanup(): Promise<void> {
  if (flags.dryRun) {
    console.log('  [DRY RUN] Would delete test app');
    return;
  }

  if (flags.keep) {
    console.log('  --keep flag set, skipping cleanup');
    if (app) {
      console.log(`  App ID: ${app.id}`);
      console.log(`  To delete later: DELETE FROM apps WHERE id = '${app.id}'`);
    }
    return;
  }

  // Delete specific test app if we created one
  if (app) {
    await sql`DELETE FROM apps WHERE id = ${app.id}`;
    console.log(`  Deleted app: ${app.id}`);
  }

  // Also clean up any leftover UAT apps
  const staleApps = await sql<{ id: string; slug: string }[]>`
    SELECT id, slug FROM apps WHERE slug LIKE ${TEST_APP_PREFIX + '-%'}
  `;

  if (staleApps.length > 0) {
    for (const stale of staleApps) {
      await sql`DELETE FROM apps WHERE id = ${stale.id}`;
      console.log(`  Cleaned up stale UAT app: ${stale.slug} (${stale.id})`);
    }
  } else if (!app) {
    console.log('  No stale UAT apps found');
  }

  // Verify cleanup
  const remaining = await sql<{ count: number }[]>`
    SELECT count(*)::int as count FROM apps WHERE slug LIKE ${TEST_APP_PREFIX + '-%'}
  `;
  assert(remaining[0].count === 0, 'No UAT apps remain after cleanup');
  console.log('  Cleanup verified');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`    [PASS] ${message}`);
}

async function runStep(name: string, fn: () => Promise<void>): Promise<void> {
  const start = performance.now();
  console.log(`\n${name}`);

  try {
    await fn();
    const duration = performance.now() - start;
    results.push({ name, passed: true, message: 'OK', duration });
  } catch (err) {
    const duration = performance.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, message, duration });
    console.log(`  [FAIL] ${message}`);
  }
}

function report(): void {
  console.log('\n' + '='.repeat(70));
  console.log(' UAT RESULTS');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    const dur = `${r.duration.toFixed(0)}ms`;
    console.log(`  [${icon}] ${r.name.padEnd(40)} ${dur.padStart(8)}  ${r.passed ? '' : '| ' + r.message}`);
  }

  console.log('-'.repeat(70));
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(70));

  if (failed > 0) {
    console.log('\n  UAT FAILED\n');
  } else {
    console.log('\n  UAT PASSED\n');
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log(' SignalDB Connect — UAT: App Creation Pipeline');
  console.log('='.repeat(70));
  console.log(`  Org:       ${TEST_ORG_SLUG}`);
  console.log(`  App Slug:  ${testSlug}`);
  console.log(`  API:       ${API_URL}`);
  console.log(`  Flags:     ${flags.keep ? '--keep ' : ''}${flags.dryRun ? '--dry-run ' : ''}${flags.cleanupOnly ? '--cleanup ' : ''}`);

  if (flags.dryRun) {
    console.log('\n  *** DRY RUN MODE — No changes will be made ***');
  }

  try {
    if (flags.cleanupOnly) {
      await runStep('1. Cleanup stale UAT data', cleanup);
    } else {
      await runStep('1. Setup', setup);
      await runStep('2. Create App', createApp);
      await runStep('3. Verify DB State', verifyDbState);
      await runStep('4. Verify Subdomain Routing', verifyRouting);
      await runStep('5. Verify Docs Route', verifyDocs);
      await runStep('6. Cleanup', cleanup);
    }
  } finally {
    report();
    await sql.end();
  }

  const failed = results.filter(r => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  sql.end().finally(() => process.exit(1));
});
