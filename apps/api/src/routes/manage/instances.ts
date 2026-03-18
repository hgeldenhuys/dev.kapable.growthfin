/**
 * Management API - Database Instances Endpoints
 *
 * GET    /v1/instances              - List all database instances
 * POST   /v1/instances              - Provision a new instance
 * GET    /v1/instances/:id          - Get instance details
 * DELETE /v1/instances/:id          - Deprovision an instance
 */

import { sql } from '../../lib/db';
import { encrypt } from '../../lib/encryption';
import type { AdminContext } from '../../lib/admin-auth';
import { requireEnv } from '../../lib/require-env';

const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');

interface ProvisionInstanceBody {
  name: string;
  tier: 'pro' | 'enterprise';
  port?: number;
  maxDatabases?: number;
  memoryGb?: number;
  cpus?: number;
}

/**
 * Execute a shell command on the server
 */
async function exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bash', '-c', command], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

/**
 * Find the next available port for a new instance
 */
async function findAvailablePort(): Promise<number> {
  const result = await sql`
    SELECT COALESCE(MAX(port), 5440) + 1 as next_port
    FROM database_instances
  `;
  return result[0].next_port;
}

/**
 * Generate a secure random password
 */
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  for (const byte of randomBytes) {
    password += chars[byte % chars.length];
  }
  return password;
}

/**
 * List all database instances
 */
export async function listInstances(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const instances = await sql`
    SELECT
      di.id,
      di.name,
      di.container_name,
      di.port,
      di.tier,
      di.max_databases,
      di.current_databases,
      di.max_size_gb,
      di.current_size_gb,
      di.status,
      di.health_status,
      di.health_check_at,
      di.created_at,
      di.updated_at,
      s.name as server_name,
      s.host as server_host,
      s.region
    FROM database_instances di
    JOIN servers s ON s.id = di.server_id
    ORDER BY di.tier, di.created_at DESC
  `;

  // Group by tier
  const grouped = {
    hobbyist: instances.filter(i => i.tier === 'hobbyist'),
    pro: instances.filter(i => i.tier === 'pro'),
    enterprise: instances.filter(i => i.tier === 'enterprise'),
  };

  return Response.json({
    data: instances,
    summary: {
      hobbyist: grouped.free.length,
      pro: grouped.pro.length,
      enterprise: grouped.enterprise.length,
      total: instances.length,
      available_enterprise: grouped.enterprise.filter(i => i.current_databases === 0 && i.status === 'active').length,
    },
  });
}

/**
 * Provision a new database instance
 */
export async function provisionInstance(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  let body: ProvisionInstanceBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.name || typeof body.name !== 'string') {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  if (!body.tier || !['pro', 'enterprise'].includes(body.tier)) {
    return Response.json({ error: 'tier must be "pro" or "enterprise"' }, { status: 400 });
  }

  // Sanitize name for container
  const safeName = body.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const containerName = `signaldb-${body.tier}-${safeName}`;

  // Check if container name already exists
  const existing = await sql`
    SELECT id FROM database_instances WHERE container_name = ${containerName}
  `;

  if (existing.length > 0) {
    return Response.json({
      error: `Instance with name '${body.name}' already exists`,
    }, { status: 409 });
  }

  // Get port
  const port = body.port || await findAvailablePort();

  // Check port is not in use
  const portInUse = await sql`
    SELECT id FROM database_instances WHERE port = ${port}
  `;

  if (portInUse.length > 0) {
    return Response.json({
      error: `Port ${port} is already in use`,
    }, { status: 409 });
  }

  // Get server (use first active server for now)
  const servers = await sql`
    SELECT id, host FROM servers WHERE status = 'active' LIMIT 1
  `;

  if (servers.length === 0) {
    return Response.json({
      error: 'No active servers available',
    }, { status: 500 });
  }

  const server = servers[0];
  const password = generatePassword();

  // Resource limits based on tier
  const memoryGb = body.memoryGb || (body.tier === 'enterprise' ? 4 : 2);
  const cpus = body.cpus || (body.tier === 'enterprise' ? 2 : 1);
  const maxDatabases = body.maxDatabases || (body.tier === 'enterprise' ? 1 : 100);

  // Create Docker container
  const dockerCmd = `docker run -d \\
    --name ${containerName} \\
    --restart unless-stopped \\
    -p 127.0.0.1:${port}:5432 \\
    -e POSTGRES_USER=signaldb \\
    -e POSTGRES_PASSWORD="${password}" \\
    -e POSTGRES_DB=postgres \\
    -v /opt/signaldb/data/${containerName}:/var/lib/postgresql/data \\
    --memory=${memoryGb}g \\
    --cpus=${cpus} \\
    --health-cmd="pg_isready -U signaldb" \\
    --health-interval=10s \\
    --health-timeout=5s \\
    --health-retries=3 \\
    postgres:16-alpine`;

  console.log(`[Provision] Creating container ${containerName} on port ${port}`);

  // Create data directory and run container
  const mkdirResult = await exec(`sudo mkdir -p /opt/signaldb/data/${containerName} && sudo chown $(id -u):$(id -g) /opt/signaldb/data/${containerName}`);
  if (mkdirResult.exitCode !== 0) {
    return Response.json({
      error: 'Failed to create data directory',
      details: mkdirResult.stderr,
    }, { status: 500 });
  }

  const dockerResult = await exec(dockerCmd);
  if (dockerResult.exitCode !== 0) {
    return Response.json({
      error: 'Failed to create Docker container',
      details: dockerResult.stderr,
    }, { status: 500 });
  }

  // Wait for container to be healthy (max 60s)
  console.log(`[Provision] Waiting for ${containerName} to become healthy...`);
  let healthy = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const healthResult = await exec(`docker inspect --format='{{.State.Health.Status}}' ${containerName}`);
    if (healthResult.stdout.trim() === 'healthy') {
      healthy = true;
      break;
    }
  }

  if (!healthy) {
    // Cleanup failed container
    await exec(`docker rm -f ${containerName}`);
    return Response.json({
      error: 'Container did not become healthy within 60 seconds',
    }, { status: 500 });
  }

  // Enable extensions
  await exec(`docker exec ${containerName} psql -U signaldb -d postgres -c "CREATE EXTENSION IF NOT EXISTS \\"uuid-ossp\\";"`);
  await exec(`docker exec ${containerName} psql -U signaldb -d postgres -c "CREATE EXTENSION IF NOT EXISTS \\"pgcrypto\\";"`);

  // Register in database
  const [instance] = await sql`
    INSERT INTO database_instances (
      server_id, name, container_name, port, tier,
      max_databases, postgres_user, postgres_password_encrypted, status, health_status
    )
    VALUES (
      ${server.id},
      ${containerName},
      ${containerName},
      ${port},
      ${body.tier},
      ${maxDatabases},
      'signaldb',
      pgp_sym_encrypt(${password}, ${ENCRYPTION_KEY}),
      'active',
      'healthy'
    )
    RETURNING id, name, container_name, port, tier, max_databases, status, created_at
  `;

  console.log(`[Provision] Instance ${containerName} created with ID ${instance.id}`);

  return Response.json({
    success: true,
    instance: {
      id: instance.id,
      name: instance.name,
      containerName: instance.container_name,
      port: instance.port,
      tier: instance.tier,
      maxDatabases: instance.max_databases,
      status: instance.status,
      createdAt: instance.created_at,
    },
    message: body.tier === 'enterprise'
      ? 'Enterprise instance ready. Can be assigned to a Pro project via upgrade.'
      : 'Pro pool ready. Projects can be upgraded to use this pool.',
  }, { status: 201 });
}

/**
 * Get instance details
 */
export async function getInstance(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { id } = params;

  const result = await sql`
    SELECT
      di.*,
      s.name as server_name,
      s.host as server_host,
      s.region
    FROM database_instances di
    JOIN servers s ON s.id = di.server_id
    WHERE di.id = ${id}
    LIMIT 1
  `;

  if (result.length === 0) {
    return Response.json({ error: 'Instance not found' }, { status: 404 });
  }

  const instance = result[0];

  // Get projects using this instance
  const projects = await sql`
    SELECT
      p.id, p.name, p.slug, pd.database_name
    FROM project_databases pd
    JOIN projects p ON p.id = pd.project_id
    WHERE pd.instance_id = ${id}
  `;

  // Remove sensitive fields
  delete instance.postgres_password_encrypted;

  return Response.json({
    ...instance,
    projects,
  });
}

/**
 * Deprovision an instance (stop and remove container)
 */
export async function deprovisionInstance(
  req: Request,
  params: Record<string, string>,
  ctx: AdminContext
): Promise<Response> {
  const { id } = params;

  const result = await sql`
    SELECT * FROM database_instances WHERE id = ${id}
  `;

  if (result.length === 0) {
    return Response.json({ error: 'Instance not found' }, { status: 404 });
  }

  const instance = result[0];

  // Check if any projects are using this instance
  const projects = await sql`
    SELECT COUNT(*) as count FROM project_databases WHERE instance_id = ${id}
  `;

  if (parseInt(projects[0].count) > 0) {
    return Response.json({
      error: 'Cannot deprovision instance with active projects',
      activeProjects: parseInt(projects[0].count),
    }, { status: 400 });
  }

  // Stop and remove container
  console.log(`[Deprovision] Removing container ${instance.container_name}`);
  const stopResult = await exec(`docker stop ${instance.container_name} && docker rm ${instance.container_name}`);

  if (stopResult.exitCode !== 0 && !stopResult.stderr.includes('No such container')) {
    return Response.json({
      error: 'Failed to remove container',
      details: stopResult.stderr,
    }, { status: 500 });
  }

  // Mark as deprovisioned in database
  await sql`
    UPDATE database_instances
    SET status = 'deprovisioned', updated_at = NOW()
    WHERE id = ${id}
  `;

  return Response.json({
    success: true,
    message: `Instance ${instance.container_name} has been deprovisioned`,
    instance: {
      id: instance.id,
      name: instance.name,
      tier: instance.tier,
    },
  });
}
