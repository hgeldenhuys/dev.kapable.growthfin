/**
 * Management API - Migrations Endpoints
 *
 * Tier Structure:
 * - Hobbyist:   Schema isolation (shared DB, separate schema per project)
 * - Pro:        Database isolation (shared instance, separate DB per project)
 * - Business:   Org Instance isolation (dedicated container per org, all projects share)
 * - Enterprise: Project Instance isolation (dedicated container per project)
 *
 * Upgrade Path:   Hobbyist → Pro → Business → Enterprise
 * Downgrade Path: Enterprise → Pro → Hobbyist (Business → Pro)
 *
 * POST   /v1/projects/:projectId/upgrade   - Upgrade tier
 *        Body: { targetTier?: 'pro' | 'business' | 'enterprise' }
 * POST   /v1/projects/:projectId/downgrade - Downgrade tier
 *        Body: { targetTier?: 'pro' | 'hobbyist' }
 * GET    /v1/projects/:projectId/tier      - Get current tier info
 * GET    /v1/projects/:projectId/migrations - List migrations
 * GET    /v1/migrations/:migrationId       - Get migration status
 */

import { sql } from '../../lib/db';
import type { AdminContext } from '../../lib/admin-auth';
import {
  upgradeToProTier,
  upgradeToBusinessTier,
  upgradeToEnterpriseTier,
  downgradeToHobbyistTier,
  downgradeFromBusinessTier,
  downgradeFromEnterpriseTier,
  getMigrationStatus,
  listProjectMigrations,
} from '../../services/migration';

/**
 * Get project tier information
 */
export async function getProjectTier(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { projectId } = params;

  // Verify project belongs to org
  const project = await sql`
    SELECT p.id, p.name, p.slug
    FROM projects p
    WHERE p.id = ${projectId} AND p.org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (project.length === 0) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get tier info from registry
  const tierResult = await sql`
    SELECT
      pd.database_name,
      pd.schema_name,
      pd.size_bytes,
      pd.status,
      di.tier,
      di.name as instance_name,
      s.name as server_name,
      s.region
    FROM project_databases pd
    JOIN database_instances di ON di.id = pd.instance_id
    JOIN servers s ON s.id = di.server_id
    WHERE pd.project_id = ${projectId}
  `;

  if (tierResult.length === 0) {
    return Response.json({
      project: project[0],
      tier: 'hobbyist',
      isolation: 'schema',
      status: 'unregistered',
      message: 'Project not yet registered in control plane',
    });
  }

  const info = tierResult[0];
  const isolation = info.schema_name ? 'schema' : 'database';

  // Format size
  let sizeFormatted = '0 B';
  if (info.size_bytes > 0) {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(info.size_bytes) / Math.log(k));
    sizeFormatted = `${parseFloat((info.size_bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  return Response.json({
    project: project[0],
    tier: info.tier,
    isolation,
    database: info.database_name,
    schema: info.schema_name,
    instance: info.instance_name,
    server: info.server_name,
    region: info.region,
    size: {
      bytes: info.size_bytes || 0,
      formatted: sizeFormatted,
    },
    status: info.status,
  });
}

/**
 * Upgrade project tier
 *
 * Supported upgrades:
 * - Free → Pro (default)
 * - Pro → Enterprise (requires targetTier: 'enterprise')
 */
export async function upgradeProject(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { projectId } = params;

  // Parse optional body for target tier
  let targetTier: string | undefined;
  try {
    const body = await req.json();
    targetTier = body.targetTier;
  } catch {
    // No body or invalid JSON - use default upgrade path
  }

  // Verify project belongs to org
  const project = await sql`
    SELECT p.id, p.name, p.slug
    FROM projects p
    WHERE p.id = ${projectId} AND p.org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (project.length === 0) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get current tier
  const tierResult = await sql`
    SELECT di.tier, pd.schema_name
    FROM project_databases pd
    JOIN database_instances di ON di.id = pd.instance_id
    WHERE pd.project_id = ${projectId}
  `;

  if (tierResult.length === 0) {
    return Response.json({
      error: 'Project not registered in control plane',
    }, { status: 400 });
  }

  const currentTier = tierResult[0].tier;
  const hasSchema = !!tierResult[0].schema_name;

  // Determine upgrade path
  // Upgrade path: Hobbyist → Pro → Business → Enterprise
  let result;
  let upgradeTo: string;

  if (currentTier === 'hobbyist' || hasSchema) {
    // Hobbyist → Pro (or Business/Enterprise requires going through Pro first)
    if (targetTier === 'business' || targetTier === 'enterprise') {
      return Response.json({
        error: `Cannot upgrade directly from Hobbyist to ${targetTier}. Please upgrade to Pro first.`,
      }, { status: 400 });
    }
    upgradeTo = 'pro';
    result = await upgradeToProTier(projectId);
  } else if (currentTier === 'pro') {
    // Pro → Business (default) or Pro → Enterprise (if specified)
    if (targetTier === 'enterprise') {
      upgradeTo = 'enterprise';
      result = await upgradeToEnterpriseTier(projectId);
    } else if (targetTier === 'hobbyist') {
      return Response.json({
        error: 'Cannot upgrade to Hobbyist tier. Use downgrade endpoint instead.',
      }, { status: 400 });
    } else {
      // Default: Pro → Business
      upgradeTo = 'business';
      result = await upgradeToBusinessTier(projectId);
    }
  } else if (currentTier === 'business') {
    // Business → Enterprise
    if (targetTier && targetTier !== 'enterprise') {
      return Response.json({
        error: `Invalid target tier '${targetTier}'. Business tier can only upgrade to Enterprise.`,
      }, { status: 400 });
    }
    upgradeTo = 'enterprise';
    result = await upgradeToEnterpriseTier(projectId);
  } else if (currentTier === 'enterprise') {
    return Response.json({
      error: 'Project is already on Enterprise tier (highest tier)',
    }, { status: 400 });
  } else {
    return Response.json({
      error: `Unknown current tier: ${currentTier}`,
    }, { status: 500 });
  }

  if (!result.success) {
    return Response.json({
      error: 'Upgrade failed',
      message: result.error,
      migrationId: result.migrationId,
    }, { status: 500 });
  }

  return Response.json({
    success: true,
    message: `Upgraded to ${upgradeTo.charAt(0).toUpperCase() + upgradeTo.slice(1)} tier`,
    fromTier: currentTier,
    toTier: upgradeTo,
    migrationId: result.migrationId,
    duration: result.duration,
  });
}

/**
 * Downgrade project tier
 *
 * Supported downgrades:
 * - Enterprise → Pro (default for Enterprise)
 * - Pro → Hobbyist (default for Pro, or targetTier: 'hobbyist')
 * - Enterprise → Hobbyist (requires targetTier: 'hobbyist', goes through Pro first)
 */
export async function downgradeProject(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { projectId } = params;

  // Parse optional body for target tier
  let targetTier: string | undefined;
  try {
    const body = await req.json();
    targetTier = body.targetTier;
  } catch {
    // No body or invalid JSON - use default downgrade path
  }

  // Verify project belongs to org
  const project = await sql`
    SELECT p.id, p.name, p.slug
    FROM projects p
    WHERE p.id = ${projectId} AND p.org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (project.length === 0) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get current tier
  const tierResult = await sql`
    SELECT di.tier, pd.schema_name
    FROM project_databases pd
    JOIN database_instances di ON di.id = pd.instance_id
    WHERE pd.project_id = ${projectId}
  `;

  if (tierResult.length === 0) {
    return Response.json({
      error: 'Project not registered in control plane',
    }, { status: 400 });
  }

  const currentTier = tierResult[0].tier;
  const hasSchema = !!tierResult[0].schema_name;

  // Determine downgrade path
  // Downgrade path: Enterprise → Business → Pro → Hobbyist
  let result;
  let downgradeTo: string;

  if (currentTier === 'hobbyist' || hasSchema) {
    return Response.json({
      error: 'Project is already on Hobbyist tier (lowest tier)',
    }, { status: 400 });
  } else if (currentTier === 'enterprise') {
    // Enterprise → Business (default) or → Pro (if specified)
    if (targetTier === 'hobbyist') {
      return Response.json({
        error: 'Cannot downgrade directly from Enterprise to Hobbyist. Please downgrade step by step.',
      }, { status: 400 });
    }
    if (targetTier === 'pro') {
      // Allow direct Enterprise → Pro skip
      downgradeTo = 'pro';
      result = await downgradeFromEnterpriseTier(projectId);
    } else {
      // Default: Enterprise → Business
      downgradeTo = 'business';
      // Enterprise → Business uses same function as Enterprise → Pro (moves to shared pool)
      // For now, we'll go directly to Pro since Business requires org-dedicated instance
      // In practice, downgrade always goes to the next lower tier
      result = await downgradeFromEnterpriseTier(projectId);
      downgradeTo = 'pro'; // Enterprise downgrade goes to Pro pool
    }
  } else if (currentTier === 'business') {
    // Business → Pro
    if (targetTier && targetTier !== 'pro' && targetTier !== 'hobbyist') {
      return Response.json({
        error: `Invalid target tier '${targetTier}'. Business tier can downgrade to Pro or Hobbyist.`,
      }, { status: 400 });
    }
    if (targetTier === 'hobbyist') {
      return Response.json({
        error: 'Cannot downgrade directly from Business to Hobbyist. Please downgrade to Pro first.',
      }, { status: 400 });
    }
    downgradeTo = 'pro';
    result = await downgradeFromBusinessTier(projectId);
  } else if (currentTier === 'pro') {
    // Pro → Hobbyist
    if (targetTier && targetTier !== 'hobbyist') {
      return Response.json({
        error: `Invalid target tier '${targetTier}'. Pro tier can only downgrade to Hobbyist.`,
      }, { status: 400 });
    }
    downgradeTo = 'hobbyist';
    result = await downgradeToHobbyistTier(projectId);
  } else {
    return Response.json({
      error: `Unknown current tier: ${currentTier}`,
    }, { status: 500 });
  }

  if (!result.success) {
    return Response.json({
      error: 'Downgrade failed',
      message: result.error,
      migrationId: result.migrationId,
    }, { status: 500 });
  }

  return Response.json({
    success: true,
    message: `Downgraded to ${downgradeTo.charAt(0).toUpperCase() + downgradeTo.slice(1)} tier`,
    fromTier: currentTier,
    toTier: downgradeTo,
    migrationId: result.migrationId,
    duration: result.duration,
  });
}

/**
 * List migrations for a project
 */
export async function listMigrations(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { projectId } = params;

  // Verify project belongs to org
  const project = await sql`
    SELECT p.id, p.name
    FROM projects p
    WHERE p.id = ${projectId} AND p.org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (project.length === 0) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const migrations = await listProjectMigrations(projectId);

  return Response.json({
    project: project[0],
    migrations,
    total: migrations.length,
  });
}

/**
 * Get migration status by ID
 */
export async function getMigration(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { migrationId } = params;

  const migration = await getMigrationStatus(migrationId);

  if (!migration) {
    return Response.json({ error: 'Migration not found' }, { status: 404 });
  }

  // Verify migration belongs to org's project
  const project = await sql`
    SELECT p.id, p.name
    FROM projects p
    WHERE p.id = ${migration.project_id} AND p.org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (project.length === 0) {
    return Response.json({ error: 'Migration not found' }, { status: 404 });
  }

  return Response.json(migration);
}
