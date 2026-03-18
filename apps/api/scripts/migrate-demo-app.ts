#!/usr/bin/env bun
/**
 * Migrate Demo App to SignalDB Connect
 *
 * This script creates the necessary database entries to host the demo app
 * on SignalDB Connect at leads.demo.connect.signaldb.live
 *
 * Prerequisites:
 * - The demo project must already exist in the database
 * - Migration 016_connect_url_scheme.sql must be applied
 *
 * Usage:
 *   bun run scripts/migrate-demo-app.ts [--dry-run]
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://signaldb:signaldb@localhost:5440/signaldb';
const isDryRun = process.argv.includes('--dry-run');

const sql = postgres(DATABASE_URL);

interface DemoProject {
  id: string;
  name: string;
  org_id: string;
  org_slug: string;
}

async function findDemoProject(): Promise<DemoProject | null> {
  // Look for a project that looks like the demo project
  // It should be linked to the demo app's API key
  const result = await sql<DemoProject[]>`
    SELECT
      p.id,
      p.name,
      o.id as org_id,
      o.slug as org_slug
    FROM projects p
    JOIN organizations o ON o.id = p.org_id
    WHERE p.name ILIKE '%demo%'
       OR o.slug = 'demo'
    LIMIT 1
  `;

  return result.length > 0 ? result[0] : null;
}

async function getOrCreateDemoOrg(): Promise<{ id: string; slug: string }> {
  // Check if demo org exists
  const existing = await sql<{ id: string; slug: string }[]>`
    SELECT id, slug FROM organizations WHERE slug = 'demo'
  `;

  if (existing.length > 0) {
    console.log(`Found existing demo organization: ${existing[0].id}`);
    return existing[0];
  }

  if (isDryRun) {
    console.log('[DRY RUN] Would create demo organization');
    return { id: 'dry-run-org-id', slug: 'demo' };
  }

  // Create demo org
  const created = await sql<{ id: string; slug: string }[]>`
    INSERT INTO organizations (name, slug, settings)
    VALUES ('Demo Organization', 'demo', '{"tier": "enterprise"}')
    RETURNING id, slug
  `;

  console.log(`Created demo organization: ${created[0].id}`);
  return created[0];
}

async function createApp(orgId: string): Promise<{ id: string; slug: string } | null> {
  // Check if app already exists
  const existing = await sql<{ id: string; slug: string }[]>`
    SELECT id, slug FROM apps WHERE org_id = ${orgId} AND slug = 'leads'
  `;

  if (existing.length > 0) {
    console.log(`Found existing leads app: ${existing[0].id}`);
    return existing[0];
  }

  if (isDryRun) {
    console.log('[DRY RUN] Would create leads app');
    return { id: 'dry-run-app-id', slug: 'leads' };
  }

  // Create app
  const created = await sql<{ id: string; slug: string }[]>`
    INSERT INTO apps (org_id, name, slug, description, framework, settings)
    VALUES (
      ${orgId},
      'Lead Manager',
      'leads',
      'SignalDB Demo - Realtime lead management application',
      'react-router',
      '{"displayName": "Lead Manager Demo"}'
    )
    RETURNING id, slug
  `;

  console.log(`Created leads app: ${created[0].id}`);
  return created[0];
}

async function createEnvironment(
  appId: string,
  projectId: string | null
): Promise<{ id: string; subdomain: string }> {
  // Check if environment already exists
  const existing = await sql<{ id: string; subdomain: string }[]>`
    SELECT id, subdomain FROM app_environments WHERE app_id = ${appId} AND name = 'production'
  `;

  if (existing.length > 0) {
    console.log(`Found existing production environment: ${existing[0].id}`);
    console.log(`  Subdomain: ${existing[0].subdomain}`);
    return existing[0];
  }

  if (isDryRun) {
    console.log('[DRY RUN] Would create production environment');
    return { id: 'dry-run-env-id', subdomain: 'demo' };
  }

  // Create environment - subdomain will be computed by trigger
  const created = await sql<{ id: string; subdomain: string }[]>`
    INSERT INTO app_environments (
      app_id,
      name,
      project_id,
      status,
      settings
    )
    VALUES (
      ${appId},
      'production',
      ${projectId},
      'pending',
      '{"healthCheckUrl": "/health"}'
    )
    RETURNING id, subdomain
  `;

  console.log(`Created production environment: ${created[0].id}`);
  console.log(`  Subdomain: ${created[0].subdomain}`);
  return created[0];
}

async function main() {
  console.log('='.repeat(60));
  console.log('Migrate Demo App to SignalDB Connect');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\n*** DRY RUN MODE - No changes will be made ***\n');
  }

  try {
    // Step 1: Find existing demo project
    console.log('\n1. Looking for existing demo project...');
    const demoProject = await findDemoProject();

    if (demoProject) {
      console.log(`Found demo project: ${demoProject.name} (${demoProject.id})`);
      console.log(`  Org: ${demoProject.org_slug} (${demoProject.org_id})`);
    } else {
      console.log('No existing demo project found.');
    }

    // Step 2: Get or create demo organization
    console.log('\n2. Setting up demo organization...');
    const org = demoProject
      ? { id: demoProject.org_id, slug: demoProject.org_slug }
      : await getOrCreateDemoOrg();

    // If org slug isn't 'demo', we might want to use the existing org
    // but create the app with 'demo' slug for the URL
    if (org.slug !== 'demo' && !demoProject) {
      // Create a new demo org
      const demoOrg = await getOrCreateDemoOrg();
      console.log(`Using demo org: ${demoOrg.slug}`);
    }

    // Step 3: Create leads app
    console.log('\n3. Setting up leads app...');
    const demoOrgResult = await sql<{ id: string }[]>`
      SELECT id FROM organizations WHERE slug = 'demo' LIMIT 1
    `;
    const actualOrgId = demoOrgResult.length > 0 ? demoOrgResult[0].id : org.id;

    const app = await createApp(actualOrgId);
    if (!app) {
      throw new Error('Failed to create app');
    }

    // Step 4: Create production environment
    console.log('\n4. Setting up production environment...');
    const env = await createEnvironment(app.id, demoProject?.id || null);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`  Organization: demo`);
    console.log(`  App: leads`);
    console.log(`  Environment: production`);
    console.log(`  Subdomain: ${env.subdomain}`);
    console.log(`  Full URL: https://${env.subdomain}.signaldb.app`);
    if (demoProject) {
      console.log(`  Linked Project: ${demoProject.id}`);
    }

    if (isDryRun) {
      console.log('\n*** DRY RUN COMPLETE - Run without --dry-run to apply changes ***');
    } else {
      console.log('\nNext steps:');
      console.log('1. Build and deploy the demo app container');
      console.log('2. Update the environment with container info');
      console.log('3. Configure Nginx for *.connect.signaldb.live');
      console.log('4. Add Cloudflare DNS wildcard record');
    }

  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
