#!/usr/bin/env bun
/**
 * Register Loom Notification Server in SignalDB Connect
 *
 * Creates the database entries needed to host the Loom Notification Server
 * from an external monorepo on SignalDB Connect at loom.signaldb.app
 *
 * Prerequisites:
 * - The Claude Loom Production project must exist (3c96ddca-e198-4a66-9a8a-cc3b1d290715)
 * - Migration 016_connect_url_scheme.sql must be applied
 *
 * Usage:
 *   bun run scripts/register-loom-app.ts [--dry-run]
 *
 * This creates:
 * - Organization: loom (slug: loom)
 * - App: Loom Notification Server (slug: notifications)
 * - Environment: production (subdomain auto-computed to 'loom')
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://signaldb:signaldb@localhost:5440/signaldb';
const isDryRun = process.argv.includes('--dry-run');

const sql = postgres(DATABASE_URL);

// Claude Loom Production project ID
const LOOM_PROJECT_ID = '3c96ddca-e198-4a66-9a8a-cc3b1d290715';

async function verifyProjectExists(): Promise<boolean> {
  const result = await sql`
    SELECT id, name FROM projects WHERE id = ${LOOM_PROJECT_ID}
  `;

  if (result.length === 0) {
    console.error(`ERROR: Claude Loom Production project not found: ${LOOM_PROJECT_ID}`);
    return false;
  }

  console.log(`Found project: ${result[0].name} (${result[0].id})`);
  return true;
}

async function getOrCreateOrg(): Promise<{ id: string; slug: string }> {
  // Check if loom org exists
  const existing = await sql<{ id: string; slug: string }[]>`
    SELECT id, slug FROM organizations WHERE slug = 'loom'
  `;

  if (existing.length > 0) {
    console.log(`Found existing loom organization: ${existing[0].id}`);
    return existing[0];
  }

  if (isDryRun) {
    console.log('[DRY RUN] Would create loom organization');
    return { id: 'dry-run-org-id', slug: 'loom' };
  }

  // Create loom org
  const created = await sql<{ id: string; slug: string }[]>`
    INSERT INTO organizations (name, slug, subdomain, plan, settings)
    VALUES ('Claude Loom', 'loom', 'loom', 'business', '{"tier": "business"}')
    RETURNING id, slug
  `;

  console.log(`Created loom organization: ${created[0].id}`);
  return created[0];
}

async function getOrCreateApp(orgId: string): Promise<{ id: string; slug: string }> {
  // In dry-run with a fake org ID, skip database query
  if (isDryRun && orgId.startsWith('dry-run')) {
    console.log('[DRY RUN] Would create notifications app');
    return { id: 'dry-run-app-id', slug: 'notifications' };
  }

  // Check if app already exists
  const existing = await sql<{ id: string; slug: string }[]>`
    SELECT id, slug FROM apps WHERE org_id = ${orgId} AND slug = 'notifications'
  `;

  if (existing.length > 0) {
    console.log(`Found existing notifications app: ${existing[0].id}`);
    return existing[0];
  }

  if (isDryRun) {
    console.log('[DRY RUN] Would create notifications app');
    return { id: 'dry-run-app-id', slug: 'notifications' };
  }

  // Create app
  const created = await sql<{ id: string; slug: string }[]>`
    INSERT INTO apps (org_id, name, slug, description, framework, settings)
    VALUES (
      ${orgId},
      'Loom Notification Server',
      'notifications',
      'Realtime notification server for Claude Loom',
      'react-router',
      '{"displayName": "Loom Notifications", "source": "external-monorepo"}'
    )
    RETURNING id, slug
  `;

  console.log(`Created notifications app: ${created[0].id}`);
  return created[0];
}

async function getOrCreateEnvironment(
  appId: string,
  projectId: string
): Promise<{ id: string; subdomain: string; port: number }> {
  // In dry-run with a fake app ID, skip database query
  if (isDryRun && appId.startsWith('dry-run')) {
    // Check what port would be allocated
    const portResult = await sql<{ allocate_app_port: number }[]>`SELECT allocate_app_port()`;
    const port = portResult[0].allocate_app_port;
    console.log(`[DRY RUN] Would create production environment with port ${port}`);
    return { id: 'dry-run-env-id', subdomain: 'loom', port };
  }

  // Check if environment already exists
  const existing = await sql<{ id: string; subdomain: string; port: number }[]>`
    SELECT id, subdomain, port FROM app_environments WHERE app_id = ${appId} AND name = 'production'
  `;

  if (existing.length > 0) {
    console.log(`Found existing production environment: ${existing[0].id}`);
    console.log(`  Subdomain: ${existing[0].subdomain}`);
    console.log(`  Port: ${existing[0].port}`);
    return existing[0];
  }

  if (isDryRun) {
    // Check what port would be allocated
    const portResult = await sql<{ allocate_app_port: number }[]>`SELECT allocate_app_port()`;
    const port = portResult[0].allocate_app_port;
    console.log(`[DRY RUN] Would create production environment with port ${port}`);
    return { id: 'dry-run-env-id', subdomain: 'loom', port };
  }

  // Allocate port and create environment
  // Note: subdomain is auto-computed by trigger_compute_connect_subdomain
  const portResult = await sql<{ allocate_app_port: number }[]>`SELECT allocate_app_port()`;
  const allocatedPort = portResult[0].allocate_app_port;

  const created = await sql<{ id: string; subdomain: string; port: number }[]>`
    INSERT INTO app_environments (
      app_id,
      name,
      project_id,
      status,
      port,
      settings
    )
    VALUES (
      ${appId},
      'production',
      ${projectId},
      'pending',
      ${allocatedPort},
      '{"healthCheckUrl": "/health", "source": "external-monorepo"}'
    )
    RETURNING id, subdomain, port
  `;

  console.log(`Created production environment: ${created[0].id}`);
  console.log(`  Subdomain: ${created[0].subdomain}`);
  console.log(`  Port: ${created[0].port}`);
  return created[0];
}

async function main() {
  console.log('='.repeat(60));
  console.log('Register Loom Notification Server in SignalDB Connect');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\n*** DRY RUN MODE - No changes will be made ***\n');
  }

  try {
    // Step 1: Verify Claude Loom project exists
    console.log('\n1. Verifying Claude Loom Production project...');
    const projectExists = await verifyProjectExists();
    if (!projectExists && !isDryRun) {
      console.error('\nAborting: Project must exist before creating app environment.');
      process.exit(1);
    }

    // Step 2: Get or create loom organization
    console.log('\n2. Setting up loom organization...');
    const org = await getOrCreateOrg();

    // Step 3: Create notifications app
    console.log('\n3. Setting up notifications app...');
    const app = await getOrCreateApp(org.id);

    // Step 4: Create production environment
    console.log('\n4. Setting up production environment...');
    const env = await getOrCreateEnvironment(app.id, LOOM_PROJECT_ID);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`  Organization: loom`);
    console.log(`  App: notifications (Loom Notification Server)`);
    console.log(`  Environment: production`);
    console.log(`  Subdomain: ${env.subdomain}`);
    console.log(`  Port: ${env.port}`);
    console.log(`  Full URL: https://${env.subdomain}.signaldb.app`);
    console.log(`  Linked Project: ${LOOM_PROJECT_ID}`);

    if (isDryRun) {
      console.log('\n*** DRY RUN COMPLETE - Run without --dry-run to apply changes ***');
    } else {
      console.log('\nNext steps:');
      console.log('1. Create server directory: /opt/signaldb/user-apps/loom-notifications/');
      console.log('2. Create ecosystem.config.js on server');
      console.log('3. Clone and build the Loom monorepo');
      console.log('4. Deploy build artifacts to server');
      console.log('5. Start PM2 process');
      console.log('6. Update environment status to "running":');
      console.log(`   UPDATE app_environments SET status = 'running', last_deployed_at = NOW() WHERE subdomain = '${env.subdomain}';`);
    }

  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
