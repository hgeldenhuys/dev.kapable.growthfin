/**
 * Management API - Usage Endpoint
 *
 * GET /v1/usage - Get usage stats for the organization
 */

import { sql } from '../../lib/db';
import type { AdminContext } from '../../lib/admin-auth';
import { getOrgUsageSummary } from '../../lib/usage';

/**
 * Get usage statistics for the organization
 */
export async function getUsage(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const url = new URL(req.url);
  const projectId = url.searchParams.get('project_id');

  // Get in-memory usage stats
  const realtimeUsage = await getOrgUsageSummary(ctx.orgId);

  // Get project count and keys
  const [projectCount, totalKeys] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM projects WHERE org_id = ${ctx.orgId}`,
    sql`SELECT COUNT(*) as count FROM api_keys WHERE org_id = ${ctx.orgId} AND revoked_at IS NULL`,
  ]);

  // Get all projects with schema names for aggregation
  const projects = await sql`
    SELECT id, schema_name FROM projects WHERE org_id = ${ctx.orgId} AND schema_name IS NOT NULL
  `;

  // Aggregate tables, rows, and storage across all project schemas
  let totalTables = 0;
  let totalRows = 0;
  let storageBytes = 0;

  for (const project of projects) {
    try {
      const [tableCount, rowData] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM ${sql(project.schema_name)}.tables`,
        sql`SELECT COUNT(*) as count, COALESCE(SUM(pg_column_size(data)), 0) as data_bytes FROM ${sql(project.schema_name)}.data`,
      ]);
      totalTables += parseInt(tableCount[0]?.count || '0');
      totalRows += parseInt(rowData[0]?.count || '0');
      storageBytes += parseInt(rowData[0]?.data_bytes || '0');
    } catch {
      // Schema might not exist, continue
    }
  }

  // If project_id is specified, get project-specific stats
  let projectStats = null;
  if (projectId) {
    // Verify project belongs to org and get schema_name
    const project = await sql`
      SELECT id, name, slug, schema_name FROM projects
      WHERE id = ${projectId} AND org_id = ${ctx.orgId}
      LIMIT 1
    `;

    if (project.length > 0 && project[0].schema_name) {
      const schemaName = project[0].schema_name;
      let pTables = 0;
      let pRows = 0;
      let pStorage = 0;

      try {
        const [tableCount, rowData] = await Promise.all([
          sql`SELECT COUNT(*) as count FROM ${sql(schemaName)}.tables`,
          sql`SELECT COUNT(*) as count, COALESCE(SUM(pg_column_size(data)), 0) as data_bytes FROM ${sql(schemaName)}.data`,
        ]);
        pTables = parseInt(tableCount[0]?.count || '0');
        pRows = parseInt(rowData[0]?.count || '0');
        pStorage = parseInt(rowData[0]?.data_bytes || '0');
      } catch {
        // Schema might not exist
      }

      const [pKeys] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM api_keys WHERE project_id = ${projectId} AND revoked_at IS NULL`,
      ]);

      projectStats = {
        project: { id: project[0].id, name: project[0].name, slug: project[0].slug },
        api_keys: parseInt(pKeys[0].count),
        tables: pTables,
        rows: pRows,
        storage_bytes: pStorage,
      };
    }
  }

  return Response.json({
    org_id: ctx.orgId,
    period: 'current_session',
    realtime: realtimeUsage,
    resources: {
      projects: parseInt(projectCount[0].count),
      api_keys: parseInt(totalKeys[0].count),
      tables: totalTables,
      rows: totalRows,
      storage_bytes: storageBytes,
      storage_mb: Math.round(storageBytes / 1024 / 1024 * 100) / 100,
    },
    project: projectStats,
  });
}
