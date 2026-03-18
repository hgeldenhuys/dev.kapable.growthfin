/**
 * Management API - Projects Endpoints
 *
 * POST   /v1/projects              - Create project
 * GET    /v1/projects              - List projects
 * GET    /v1/projects/:id          - Get project
 * DELETE /v1/projects/:id          - Delete project
 */

import crypto from 'crypto';
import { sql } from '../../lib/db';
import { connectionManager } from '../../lib/connection-manager';
import { projectUserManager } from '../../lib/project-user-manager';
import type { AdminContext } from '../../lib/admin-auth';

interface CreateProjectBody {
  name: string;
  slug: string;
  environment?: 'development' | 'staging' | 'production';
  settings?: Record<string, unknown>;
}

/**
 * List all projects for the organization
 */
export async function listProjects(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  // Get projects with tier info from project_databases
  const projects = await sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.environment,
      p.settings,
      p.created_at,
      p.updated_at,
      pd.schema_name,
      pd.database_name,
      di.tier,
      di.name as instance_name
    FROM projects p
    LEFT JOIN project_databases pd ON pd.project_id = p.id
    LEFT JOIN database_instances di ON di.id = pd.instance_id
    WHERE p.org_id = ${ctx.orgId}
    ORDER BY p.created_at DESC
  `;

  if (projects.length === 0) {
    return Response.json({ data: [], total: 0 });
  }

  // Batch api_keys count — single query instead of N
  const projectIds = projects.map((p: any) => p.id);
  const keyCounts = await sql`
    SELECT project_id, COUNT(*) as count
    FROM api_keys
    WHERE project_id = ANY(${projectIds}) AND revoked_at IS NULL
    GROUP BY project_id
  `;
  const keyCountMap: Record<string, number> = {};
  for (const row of keyCounts) {
    keyCountMap[row.project_id] = parseInt(row.count);
  }

  // Fetch per-project stats in parallel (each may hit a different database)
  const statsPromises = projects.map(async (project: any) => {
    let tableCount = 0;
    let rowCount = 0;

    try {
      const { sql: projectSql, schema, tier } = await connectionManager.getPool(project.id);
      const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

      if (useSchema) {
        const tablesRef = `"${schema}"."_tables"`;
        const dataRef = `"${schema}"."_data"`;
        const [tables, rows] = await Promise.all([
          projectSql.unsafe(`SELECT COUNT(*) as count FROM ${tablesRef}`),
          projectSql.unsafe(`SELECT COUNT(*) as count FROM ${dataRef}`),
        ]);
        tableCount = parseInt(tables[0]?.count || '0');
        rowCount = parseInt(rows[0]?.count || '0');
      } else if (tier === 'pro' || tier === 'enterprise') {
        const [tables, rows] = await Promise.all([
          projectSql.unsafe(`SELECT COUNT(*) as count FROM "_tables"`),
          projectSql.unsafe(`SELECT COUNT(*) as count FROM "_data"`),
        ]);
        tableCount = parseInt(tables[0]?.count || '0');
        rowCount = parseInt(rows[0]?.count || '0');
      }
    } catch {
      // Connection might not exist yet, use defaults
    }

    return { projectId: project.id, tableCount, rowCount };
  });

  const allStats = await Promise.all(statsPromises);
  const statsMap: Record<string, { tableCount: number; rowCount: number }> = {};
  for (const s of allStats) {
    statsMap[s.projectId] = { tableCount: s.tableCount, rowCount: s.rowCount };
  }

  const projectsWithStats = [];
  for (const project of projects) {
    const stats = statsMap[project.id] || { tableCount: 0, rowCount: 0 };
    projectsWithStats.push({
      id: project.id,
      name: project.name,
      slug: project.slug,
      environment: project.environment,
      tier: project.tier || 'hobbyist',
      isolation: project.schema_name ? 'schema' : 'database',
      instance: project.instance_name,
      settings: project.settings,
      created_at: project.created_at,
      updated_at: project.updated_at,
      stats: {
        api_keys: keyCountMap[project.id] || 0,
        tables: stats.tableCount,
        rows: stats.rowCount,
      },
    });
  }

  return Response.json({
    data: projectsWithStats,
    total: projectsWithStats.length,
  });
}

/**
 * Get a single project by ID
 */
export async function getProject(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { id } = params;

  // Get project with tier info
  const result = await sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.environment,
      p.settings,
      p.created_at,
      p.updated_at,
      pd.schema_name,
      pd.database_name,
      di.tier,
      di.name as instance_name
    FROM projects p
    LEFT JOIN project_databases pd ON pd.project_id = p.id
    LEFT JOIN database_instances di ON di.id = pd.instance_id
    WHERE p.id = ${id} AND p.org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (result.length === 0) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const project = result[0];

  // Get stats (tier-aware)
  let tableCount = 0;
  let rowCount = 0;

  try {
    const { sql: projectSql, schema, tier } = await connectionManager.getPool(id);
    const useSchema = (tier === 'hobbyist' || tier === 'free') && schema;

    if (useSchema) {
      const tablesRef = `"${schema}"."_tables"`;
      const dataRef = `"${schema}"."_data"`;
      const [tables, rows] = await Promise.all([
        projectSql.unsafe(`SELECT COUNT(*) as count FROM ${tablesRef}`),
        projectSql.unsafe(`SELECT COUNT(*) as count FROM ${dataRef}`),
      ]);
      tableCount = parseInt(tables[0]?.count || '0');
      rowCount = parseInt(rows[0]?.count || '0');
    } else if (tier === 'pro' || tier === 'enterprise') {
      const [tables, rows] = await Promise.all([
        projectSql.unsafe(`SELECT COUNT(*) as count FROM "_tables"`),
        projectSql.unsafe(`SELECT COUNT(*) as count FROM "_data"`),
      ]);
      tableCount = parseInt(tables[0]?.count || '0');
      rowCount = parseInt(rows[0]?.count || '0');
    }
  } catch {
    // Connection might not exist yet, use defaults
  }

  const keyCountResult = await sql`
    SELECT COUNT(*) as count FROM api_keys
    WHERE project_id = ${id} AND revoked_at IS NULL
  `;

  return Response.json({
    id: project.id,
    name: project.name,
    slug: project.slug,
    environment: project.environment,
    tier: project.tier || 'hobbyist',
    isolation: project.schema_name ? 'schema' : 'database',
    instance: project.instance_name,
    settings: project.settings,
    created_at: project.created_at,
    updated_at: project.updated_at,
    stats: {
      api_keys: parseInt(keyCountResult[0].count),
      tables: tableCount,
      rows: rowCount,
    },
  });
}

/**
 * Create a new project
 */
export async function createProject(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  let body: CreateProjectBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.name || typeof body.name !== 'string') {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  if (!body.slug || typeof body.slug !== 'string') {
    return Response.json({ error: 'slug is required' }, { status: 400 });
  }

  // Validate slug format (lowercase, alphanumeric, hyphens)
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return Response.json({
      error: 'slug must be lowercase alphanumeric with hyphens only',
    }, { status: 400 });
  }

  // Validate environment
  const validEnvironments = ['development', 'staging', 'production'];
  const environment = body.environment || 'development';
  if (!validEnvironments.includes(environment)) {
    return Response.json({
      error: `environment must be one of: ${validEnvironments.join(', ')}`,
    }, { status: 400 });
  }

  // Check if slug already exists for this org
  const existing = await sql`
    SELECT id FROM projects
    WHERE org_id = ${ctx.orgId} AND slug = ${body.slug}
    LIMIT 1
  `;

  if (existing.length > 0) {
    return Response.json({
      error: `Project with slug '${body.slug}' already exists`,
    }, { status: 409 });
  }

  // Create the project (trigger auto-creates schema and sets schema_name)
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const result = await sql`
    INSERT INTO projects (org_id, name, slug, environment, settings, jwt_secret)
    VALUES (${ctx.orgId}, ${body.name}, ${body.slug}, ${environment}, ${JSON.stringify(body.settings || {})}, ${jwtSecret})
    RETURNING id, name, slug, environment, schema_name, settings, created_at, updated_at
  `;

  return Response.json(result[0], { status: 201 });
}

/**
 * Delete a project
 */
export async function deleteProject(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { id } = params;

  // Check if project exists and belongs to this org
  const existing = await sql`
    SELECT id, name, schema_name FROM projects
    WHERE id = ${id} AND org_id = ${ctx.orgId}
    LIMIT 1
  `;

  if (existing.length === 0) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const project = existing[0];

  // Get counts for info (using schema-isolated queries)
  let tableCount = [{ count: '0' }];
  let rowCount = [{ count: '0' }];

  if (project.schema_name) {
    try {
      [tableCount, rowCount] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM ${sql(project.schema_name)}.tables`,
        sql`SELECT COUNT(*) as count FROM ${sql(project.schema_name)}.data`,
      ]);
    } catch {
      // Schema might not exist, use defaults
    }
  }

  const [keyCount] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM api_keys WHERE project_id = ${id}`,
  ]);

  // Clean up per-project PostgreSQL user if exists
  try {
    await projectUserManager.dropProjectUser(id);
  } catch (error) {
    console.warn(`[deleteProject] Failed to drop project user for ${id}:`, error);
    // Continue with deletion even if user cleanup fails
  }

  // Delete the project (cascades to api_keys, trigger drops schema)
  await sql`DELETE FROM projects WHERE id = ${id}`;

  return Response.json({
    deleted: true,
    project: { id: project.id, name: project.name },
    deleted_resources: {
      api_keys: parseInt(keyCount[0].count),
      tables: parseInt(tableCount[0].count),
      rows: parseInt(rowCount[0].count),
    },
  });
}
