# Multi-Tenant Database Isolation - Implementation Plan

## Overview

This plan migrates SignalDB from schema-only isolation to tiered isolation:
- **Free**: Schema isolation (current)
- **Pro**: Database isolation (new)
- **Enterprise**: Instance isolation (new)

---

## Phase 1: Control Plane Schema (Week 1)

### 1.1 Create Registry Tables

**File**: `apps/admin/scripts/migrations/001_control_plane.sql`

```sql
-- Run on primary server's control database

-- Servers table
CREATE TABLE IF NOT EXISTS servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL,
  region TEXT NOT NULL,
  provider TEXT DEFAULT 'linode',
  specs JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Database instances table
CREATE TABLE IF NOT EXISTS database_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id),
  name TEXT NOT NULL,
  container_name TEXT NOT NULL,
  port INTEGER NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise')),
  max_databases INTEGER,
  current_databases INTEGER DEFAULT 0,
  max_size_gb INTEGER,
  current_size_gb NUMERIC DEFAULT 0,
  postgres_user TEXT NOT NULL DEFAULT 'signaldb',
  postgres_password_encrypted TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  health_check_at TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(server_id, port),
  UNIQUE(server_id, container_name)
);

-- Project database locations
CREATE TABLE IF NOT EXISTS project_databases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES database_instances(id),
  database_name TEXT NOT NULL,
  schema_name TEXT,
  connection_string_encrypted TEXT NOT NULL,
  size_bytes BIGINT DEFAULT 0,
  row_count BIGINT DEFAULT 0,
  last_size_check TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  migration_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Migration history
CREATE TABLE IF NOT EXISTS database_migrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  from_instance_id UUID REFERENCES database_instances(id),
  from_database TEXT,
  from_schema TEXT,
  to_instance_id UUID NOT NULL REFERENCES database_instances(id),
  to_database TEXT NOT NULL,
  to_schema TEXT,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  size_bytes BIGINT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health monitoring
CREATE TABLE IF NOT EXISTS server_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id),
  instance_id UUID REFERENCES database_instances(id),
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  details JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan limits
CREATE TABLE IF NOT EXISTS plan_limits (
  plan TEXT PRIMARY KEY,
  max_db_size_mb INTEGER,
  max_rows INTEGER,
  max_tables INTEGER,
  max_connections INTEGER,
  max_realtime_connections INTEGER,
  requests_per_minute INTEGER,
  isolation_level TEXT NOT NULL,
  direct_db_access BOOLEAN DEFAULT FALSE,
  dedicated_support BOOLEAN DEFAULT FALSE,
  custom_domain BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_databases_project ON project_databases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_databases_instance ON project_databases(instance_id);
CREATE INDEX IF NOT EXISTS idx_database_instances_server ON database_instances(server_id);
CREATE INDEX IF NOT EXISTS idx_database_instances_tier ON database_instances(tier, status);
CREATE INDEX IF NOT EXISTS idx_server_health_recent ON server_health(server_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_database_migrations_project ON database_migrations(project_id);
```

### 1.2 Seed Initial Data

**File**: `apps/admin/scripts/migrations/002_seed_control_plane.sql`

```sql
-- Register current server
INSERT INTO servers (name, host, region, provider, is_primary, specs) VALUES
  ('us-east-1', '172.232.188.216', 'us-east', 'linode', TRUE,
   '{"cpu": 4, "ram_gb": 8, "disk_gb": 160}');

-- Register current free tier instance
INSERT INTO database_instances (
  server_id, name, container_name, port, tier,
  max_databases, postgres_user, postgres_password_encrypted
)
SELECT
  s.id,
  'signaldb-free',
  'signaldb-postgres',
  5440,
  'free',
  NULL, -- unlimited schemas for free
  'signaldb',
  pgp_sym_encrypt('signaldb_prod_secure_2024', current_setting('app.encryption_key'))
FROM servers s WHERE s.name = 'us-east-1';

-- Seed plan limits
INSERT INTO plan_limits VALUES
  ('free', 100, 10000, 10, 5, 10, 100, 'schema', FALSE, FALSE, FALSE, NOW()),
  ('pro', 10240, 1000000, 100, 50, 100, 1000, 'database', FALSE, FALSE, TRUE, NOW()),
  ('enterprise', NULL, NULL, NULL, 500, 1000, 10000, 'instance', TRUE, TRUE, TRUE, NOW())
ON CONFLICT (plan) DO NOTHING;
```

### 1.3 Migrate Existing Projects

**File**: `apps/admin/scripts/migrations/003_migrate_existing_projects.sql`

```sql
-- Register all existing projects in project_databases
INSERT INTO project_databases (project_id, instance_id, database_name, schema_name, connection_string_encrypted)
SELECT
  p.id,
  di.id,
  'signaldb',
  p.schema_name,
  pgp_sym_encrypt(
    format('postgresql://signaldb:%s@localhost:5440/signaldb',
           pgp_sym_decrypt(di.postgres_password_encrypted, current_setting('app.encryption_key'))),
    current_setting('app.encryption_key')
  )
FROM projects p
CROSS JOIN database_instances di
WHERE di.name = 'signaldb-free'
  AND NOT EXISTS (SELECT 1 FROM project_databases pd WHERE pd.project_id = p.id);
```

### Tasks
- [ ] Create migration SQL files
- [ ] Add encryption key to environment
- [ ] Run migrations on production
- [ ] Verify data integrity

---

## Phase 2: Connection Manager (Week 1-2)

### 2.1 Create Connection Manager

**File**: `apps/api/src/lib/connection-manager.ts`

```typescript
import { Pool, PoolClient } from 'pg';
import { LRUCache } from 'lru-cache';
import { decrypt } from './encryption';
import { sql } from './db';

interface PoolEntry {
  pool: Pool;
  instanceId: string;
  database: string;
  schema?: string;
  tier: string;
}

interface ProjectLocation {
  instanceId: string;
  serverId: string;
  serverHost: string;
  host: string;
  port: number;
  database: string;
  schema: string | null;
  user: string;
  passwordEncrypted: string;
  tier: string;
}

const CURRENT_SERVER_ID = process.env.SERVER_ID;

class ConnectionManager {
  private pools = new Map<string, PoolEntry>();
  private locationCache = new LRUCache<string, ProjectLocation>({
    max: 1000,
    ttl: 1000 * 60 * 5, // 5 minute cache
  });

  async getProjectLocation(projectId: string): Promise<ProjectLocation> {
    const cached = this.locationCache.get(projectId);
    if (cached) return cached;

    const result = await sql`
      SELECT
        pd.instance_id,
        di.server_id,
        s.host as server_host,
        '127.0.0.1' as host,  -- Always localhost for local connections
        di.port,
        pd.database_name as database,
        pd.schema_name as schema,
        di.postgres_user as user,
        di.postgres_password_encrypted as password_encrypted,
        di.tier
      FROM project_databases pd
      JOIN database_instances di ON di.id = pd.instance_id
      JOIN servers s ON s.id = di.server_id
      WHERE pd.project_id = ${projectId}
        AND pd.status = 'active'
    `;

    if (result.length === 0) {
      throw new Error(`No database found for project ${projectId}`);
    }

    const location: ProjectLocation = {
      instanceId: result[0].instance_id,
      serverId: result[0].server_id,
      serverHost: result[0].server_host,
      host: result[0].host,
      port: result[0].port,
      database: result[0].database,
      schema: result[0].schema,
      user: result[0].user,
      passwordEncrypted: result[0].password_encrypted,
      tier: result[0].tier,
    };

    this.locationCache.set(projectId, location);
    return location;
  }

  async getPool(projectId: string): Promise<PoolEntry> {
    const location = await this.getProjectLocation(projectId);

    // Check if data is on this server
    if (location.serverId !== CURRENT_SERVER_ID) {
      throw new RemoteDataError(location.serverId, location.serverHost);
    }

    const poolKey = `${location.instanceId}:${location.database}`;

    if (!this.pools.has(poolKey)) {
      const password = await decrypt(location.passwordEncrypted);

      const pool = new Pool({
        host: location.host,
        port: location.port,
        database: location.database,
        user: location.user,
        password,
        max: location.tier === 'enterprise' ? 50 : location.tier === 'pro' ? 20 : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      pool.on('error', (err) => {
        console.error(`Pool error for ${poolKey}:`, err);
      });

      this.pools.set(poolKey, {
        pool,
        instanceId: location.instanceId,
        database: location.database,
        schema: location.schema || undefined,
        tier: location.tier,
      });
    }

    return this.pools.get(poolKey)!;
  }

  async query(projectId: string, queryText: string, params: any[] = []): Promise<any> {
    const entry = await this.getPool(projectId);

    // For schema-isolated (free tier), set search_path
    if (entry.schema) {
      const client = await entry.pool.connect();
      try {
        await client.query(`SET search_path TO "${entry.schema}", public`);
        const result = await client.query(queryText, params);
        return result;
      } finally {
        client.release();
      }
    }

    return entry.pool.query(queryText, params);
  }

  invalidateProject(projectId: string): void {
    this.locationCache.delete(projectId);
  }

  async shutdown(): Promise<void> {
    for (const [key, entry] of this.pools) {
      await entry.pool.end();
    }
    this.pools.clear();
  }
}

export class RemoteDataError extends Error {
  constructor(public serverId: string, public serverHost: string) {
    super(`Data is on remote server ${serverId}`);
    this.name = 'RemoteDataError';
  }
}

export const connectionManager = new ConnectionManager();
```

### 2.2 Update API Routes

**File**: `apps/api/src/routes/rows.ts` (modifications)

```typescript
import { connectionManager, RemoteDataError } from '../lib/connection-manager';

// Replace direct sql queries with connection manager

// Before:
const result = await sql`
  SELECT * FROM "${sql.unsafe(ctx.schemaName)}".data
  WHERE table_name = ${table}
`;

// After:
const result = await connectionManager.query(
  ctx.projectId,
  `SELECT * FROM data WHERE table_name = $1`,
  [table]
);
```

### 2.3 Add Request Forwarding

**File**: `apps/api/src/middleware/routing.ts`

```typescript
import { RemoteDataError } from '../lib/connection-manager';

export async function routingMiddleware(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    if (error instanceof RemoteDataError) {
      // Forward request to correct server
      const targetUrl = `https://${error.serverHost}${c.req.path}`;

      const response = await fetch(targetUrl, {
        method: c.req.method,
        headers: c.req.headers,
        body: c.req.method !== 'GET' ? await c.req.text() : undefined,
      });

      // Proxy the response back
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    }
    throw error;
  }
}
```

### Tasks
- [ ] Create connection-manager.ts
- [ ] Create encryption utility
- [ ] Update all API routes to use connection manager
- [ ] Add request forwarding middleware
- [ ] Test with existing schema-isolated projects

---

## Phase 3: Pro Tier Provisioning (Week 3)

### 3.1 Create Pro Pool Instance

**File**: `scripts/provision-pro-pool.sh`

```bash
#!/bin/bash

set -e

SERVER_HOST=${1:-"172.232.188.216"}
PORT=${2:-5441}
POOL_NAME="signaldb-pro-pool"
PASSWORD=$(openssl rand -base64 32)

echo "Provisioning Pro Pool on ${SERVER_HOST}:${PORT}"

# SSH to server and create container
ssh -i ~/.ssh/id_ed25519_automation deploy@${SERVER_HOST} << EOF
  docker run -d \
    --name ${POOL_NAME} \
    --restart unless-stopped \
    -p 127.0.0.1:${PORT}:5432 \
    -e POSTGRES_USER=signaldb \
    -e POSTGRES_PASSWORD="${PASSWORD}" \
    -e POSTGRES_DB=postgres \
    -v /opt/signaldb/data/${POOL_NAME}:/var/lib/postgresql/data \
    --memory=2g \
    --cpus=1 \
    --health-cmd="pg_isready -U signaldb" \
    --health-interval=10s \
    --health-timeout=5s \
    --health-retries=3 \
    postgres:16-alpine

  # Wait for healthy
  echo "Waiting for PostgreSQL..."
  until docker inspect --format='{{.State.Health.Status}}' ${POOL_NAME} | grep -q "healthy"; do
    sleep 2
  done
  echo "PostgreSQL Pro Pool ready!"
EOF

echo "Password: ${PASSWORD}"
echo ""
echo "Register in database with:"
echo "INSERT INTO database_instances (server_id, name, container_name, port, tier, max_databases, postgres_user, postgres_password_encrypted)"
echo "SELECT id, '${POOL_NAME}', '${POOL_NAME}', ${PORT}, 'pro', 100, 'signaldb', pgp_sym_encrypt('${PASSWORD}', current_setting('app.encryption_key'))"
echo "FROM servers WHERE name = 'us-east-1';"
```

### 3.2 Migration Service

**File**: `apps/api/src/services/migration.ts`

```typescript
import { sql } from '../lib/db';
import { connectionManager } from '../lib/connection-manager';
import { exec } from 'child_process';
import { promisify } from 'util';
import { decrypt, encrypt } from '../lib/encryption';

const execAsync = promisify(exec);

interface MigrationResult {
  migrationId: string;
  success: boolean;
  error?: string;
}

export async function upgradeToProTier(projectId: string): Promise<MigrationResult> {
  // 1. Create migration record
  const [migration] = await sql`
    INSERT INTO database_migrations (project_id, reason, status)
    VALUES (${projectId}, 'upgrade', 'pending')
    RETURNING id
  `;

  try {
    // 2. Get current project location
    const [current] = await sql`
      SELECT
        pd.*,
        di.postgres_password_encrypted,
        di.port as instance_port
      FROM project_databases pd
      JOIN database_instances di ON di.id = pd.instance_id
      WHERE pd.project_id = ${projectId}
    `;

    if (!current) {
      throw new Error('Project not found in registry');
    }

    // 3. Find Pro pool with capacity
    const [proInstance] = await sql`
      SELECT di.*, s.host as server_host
      FROM database_instances di
      JOIN servers s ON s.id = di.server_id
      WHERE di.tier = 'pro'
        AND di.status = 'active'
        AND (di.max_databases IS NULL OR di.current_databases < di.max_databases)
      ORDER BY di.current_databases ASC
      LIMIT 1
    `;

    if (!proInstance) {
      throw new Error('No Pro pool available - please provision a new instance');
    }

    // 4. Create new database name
    const newDbName = `project_${projectId.replace(/-/g, '_')}`;

    // 5. Update migration status
    await sql`
      UPDATE database_migrations
      SET
        from_instance_id = ${current.instance_id},
        from_database = ${current.database_name},
        from_schema = ${current.schema_name},
        to_instance_id = ${proInstance.id},
        to_database = ${newDbName},
        status = 'in_progress',
        started_at = NOW()
      WHERE id = ${migration.id}
    `;

    // 6. Create database in Pro pool
    const proPassword = await decrypt(proInstance.postgres_password_encrypted);
    await execAsync(
      `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${proInstance.port} -U signaldb -d postgres -c "CREATE DATABASE ${newDbName}"`
    );

    // 7. Dump from schema
    const freePassword = await decrypt(current.postgres_password_encrypted);
    const dumpFile = `/tmp/migration_${projectId}.sql`;

    await execAsync(
      `PGPASSWORD="${freePassword}" pg_dump -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d signaldb --schema=${current.schema_name} --no-owner --no-acl -f ${dumpFile}`
    );

    // 8. Transform dump (remove schema prefix, change search_path)
    await execAsync(
      `sed -i 's/${current.schema_name}\\./public./g' ${dumpFile}`
    );

    // 9. Restore to new database
    await execAsync(
      `PGPASSWORD="${proPassword}" psql -h 127.0.0.1 -p ${proInstance.port} -U signaldb -d ${newDbName} -f ${dumpFile}`
    );

    // 10. Create notify triggers in new database
    await createNotifyTriggers(proInstance, newDbName, projectId);

    // 11. Update project_databases registry
    const newConnString = `postgresql://signaldb:${proPassword}@127.0.0.1:${proInstance.port}/${newDbName}`;

    await sql`
      UPDATE project_databases
      SET
        instance_id = ${proInstance.id},
        database_name = ${newDbName},
        schema_name = NULL,
        connection_string_encrypted = ${await encrypt(newConnString)},
        status = 'active'
      WHERE project_id = ${projectId}
    `;

    // 12. Update instance database count
    await sql`
      UPDATE database_instances
      SET current_databases = current_databases + 1
      WHERE id = ${proInstance.id}
    `;

    // 13. Drop old schema
    await execAsync(
      `PGPASSWORD="${freePassword}" psql -h 127.0.0.1 -p ${current.instance_port} -U signaldb -d signaldb -c "DROP SCHEMA IF EXISTS ${current.schema_name} CASCADE"`
    );

    // 14. Cleanup
    await execAsync(`rm -f ${dumpFile}`);

    // 15. Complete migration
    await sql`
      UPDATE database_migrations
      SET status = 'completed', completed_at = NOW()
      WHERE id = ${migration.id}
    `;

    // 16. Invalidate connection cache
    connectionManager.invalidateProject(projectId);

    return { migrationId: migration.id, success: true };

  } catch (error: any) {
    await sql`
      UPDATE database_migrations
      SET status = 'failed', error_message = ${error.message}
      WHERE id = ${migration.id}
    `;

    return { migrationId: migration.id, success: false, error: error.message };
  }
}

export async function downgradeToFreeTier(projectId: string): Promise<MigrationResult> {
  // 1. Check size limits
  const [project] = await sql`
    SELECT pd.size_bytes, pl.max_db_size_mb
    FROM project_databases pd
    JOIN projects p ON p.id = pd.project_id
    JOIN organizations o ON o.id = p.org_id
    JOIN plan_limits pl ON pl.plan = 'free'
    WHERE pd.project_id = ${projectId}
  `;

  const maxBytes = (project.max_db_size_mb || 100) * 1024 * 1024;

  if (project.size_bytes > maxBytes) {
    return {
      migrationId: '',
      success: false,
      error: `Database size (${formatBytes(project.size_bytes)}) exceeds free tier limit (${project.max_db_size_mb}MB). Please reduce data before downgrading.`
    };
  }

  // Similar migration flow in reverse...
  // Create schema in free instance, dump/restore, drop old database
}

async function createNotifyTriggers(instance: any, dbName: string, projectId: string) {
  const password = await decrypt(instance.postgres_password_encrypted);
  const channel = `project_${projectId.replace(/-/g, '_')}`;

  const triggerSQL = `
    CREATE OR REPLACE FUNCTION notify_data_change()
    RETURNS TRIGGER AS $$
    DECLARE
      payload JSONB;
      record_data RECORD;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        record_data := OLD;
      ELSE
        record_data := NEW;
      END IF;

      payload := jsonb_build_object(
        'op', TG_OP,
        'table', record_data.table_name,
        'id', record_data.id,
        'data', record_data.data,
        'ts', extract(epoch from now())
      );

      PERFORM pg_notify('${channel}', payload::TEXT);
      RETURN record_data;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS data_notify ON data;
    CREATE TRIGGER data_notify
      AFTER INSERT OR UPDATE OR DELETE ON data
      FOR EACH ROW EXECUTE FUNCTION notify_data_change();
  `;

  await execAsync(
    `PGPASSWORD="${password}" psql -h 127.0.0.1 -p ${instance.port} -U signaldb -d ${dbName} -c "${triggerSQL.replace(/\n/g, ' ')}"`
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
```

### Tasks
- [ ] Create provision-pro-pool.sh script
- [ ] Run script to create first Pro pool (port 5441)
- [ ] Register Pro pool in database_instances
- [ ] Implement upgradeToProTier function
- [ ] Implement downgradeToFreeTier function
- [ ] Add upgrade/downgrade API endpoints
- [ ] Test full migration cycle

---

## Phase 4: Enterprise Provisioning (Week 4)

### 4.1 Enterprise Instance Provisioning

**File**: `apps/api/src/services/enterprise-provisioning.ts`

```typescript
export async function provisionEnterpriseInstance(
  orgId: string,
  orgSlug: string
): Promise<{ instanceId: string; port: number }> {

  // 1. Find server with capacity
  const [server] = await sql`
    SELECT * FROM servers
    WHERE status = 'active'
    ORDER BY
      (SELECT COUNT(*) FROM database_instances WHERE server_id = servers.id) ASC
    LIMIT 1
  `;

  // 2. Find next available port
  const [portResult] = await sql`
    SELECT COALESCE(MAX(port), 5441) + 1 as next_port
    FROM database_instances
    WHERE server_id = ${server.id}
  `;
  const port = portResult.next_port;

  // 3. Generate secure password
  const password = generateSecurePassword();

  // 4. Create container via SSH
  const containerName = `signaldb-ent-${orgSlug}`;
  await execAsync(`
    ssh -i ~/.ssh/id_ed25519_automation deploy@${server.host} << 'EOF'
      docker run -d \
        --name ${containerName} \
        --restart unless-stopped \
        -p 127.0.0.1:${port}:5432 \
        -e POSTGRES_USER=signaldb \
        -e POSTGRES_PASSWORD="${password}" \
        -e POSTGRES_DB=main \
        -v /opt/signaldb/data/${containerName}:/var/lib/postgresql/data \
        --memory=8g \
        --cpus=4 \
        --health-cmd="pg_isready -U signaldb" \
        postgres:16-alpine
    EOF
  `);

  // 5. Wait for healthy
  await waitForHealthy(server.host, containerName);

  // 6. Register in database
  const [instance] = await sql`
    INSERT INTO database_instances (
      server_id, name, container_name, port, tier,
      postgres_user, postgres_password_encrypted
    ) VALUES (
      ${server.id}, ${containerName}, ${containerName}, ${port}, 'enterprise',
      'signaldb', ${await encrypt(password)}
    )
    RETURNING id
  `;

  return { instanceId: instance.id, port };
}
```

### Tasks
- [ ] Implement enterprise provisioning
- [ ] Add billing webhook integration
- [ ] Auto-provision on Enterprise signup
- [ ] Test dedicated instance creation

---

## Phase 5: Health Monitoring (Week 5)

### 5.1 Health Check Service

**File**: `apps/api/src/services/health-monitor.ts`

```typescript
import { sql } from '../lib/db';

class HealthMonitor {
  private checkInterval: NodeJS.Timer | null = null;

  start(intervalMs: number = 30000) {
    this.checkInterval = setInterval(() => this.runChecks(), intervalMs);
    console.log('[HealthMonitor] Started with interval', intervalMs);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async runChecks() {
    const instances = await sql`
      SELECT di.*, s.host as server_host
      FROM database_instances di
      JOIN servers s ON s.id = di.server_id
      WHERE di.status != 'offline'
    `;

    for (const instance of instances) {
      await this.checkInstance(instance);
    }
  }

  async checkInstance(instance: any) {
    const startTime = Date.now();

    try {
      const password = await decrypt(instance.postgres_password_encrypted);
      const pool = new Pool({
        host: '127.0.0.1',
        port: instance.port,
        user: instance.postgres_user,
        password,
        database: 'postgres',
        connectionTimeoutMillis: 5000,
      });

      await pool.query('SELECT 1');
      const latency = Date.now() - startTime;
      await pool.end();

      const status = latency < 50 ? 'healthy' : latency < 200 ? 'degraded' : 'slow';

      await sql`
        INSERT INTO server_health (server_id, instance_id, check_type, status, latency_ms)
        VALUES (${instance.server_id}, ${instance.id}, 'connection', ${status}, ${latency})
      `;

      await sql`
        UPDATE database_instances
        SET health_check_at = NOW(), health_status = ${status}
        WHERE id = ${instance.id}
      `;

    } catch (error: any) {
      await sql`
        INSERT INTO server_health (server_id, instance_id, check_type, status, details)
        VALUES (${instance.server_id}, ${instance.id}, 'connection', 'unhealthy', ${JSON.stringify({ error: error.message })})
      `;

      await sql`
        UPDATE database_instances
        SET health_check_at = NOW(), health_status = 'unhealthy'
        WHERE id = ${instance.id}
      `;

      // TODO: Send alert
      console.error(`[HealthMonitor] Instance ${instance.name} is unhealthy:`, error.message);
    }
  }
}

export const healthMonitor = new HealthMonitor();
```

### Tasks
- [ ] Implement health monitor service
- [ ] Add to API startup
- [ ] Create health dashboard API endpoint
- [ ] Add alerting (Discord/email)

---

## Phase 6: Admin UI (Week 6)

### 6.1 Infrastructure Pages

**New Routes:**
- `/admin/infrastructure` - Overview
- `/admin/infrastructure/servers` - Server management
- `/admin/infrastructure/instances` - Instance management
- `/admin/infrastructure/migrations` - Migration history
- `/admin/infrastructure/health` - Health dashboard

### 6.2 Server Management Page

**File**: `apps/admin/app/routes/admin.infrastructure.servers.tsx`

Key features:
- List all servers with status
- Add new server
- View instances per server
- Server health history

### 6.3 Instance Management Page

**File**: `apps/admin/app/routes/admin.infrastructure.instances.tsx`

Key features:
- List all PostgreSQL instances
- Create new Pro pool / Enterprise instance
- View databases per instance
- Instance health metrics

### 6.4 Migration Management

**File**: `apps/admin/app/routes/admin.infrastructure.migrations.tsx`

Key features:
- View migration history
- Trigger manual migrations
- View migration progress
- Rollback failed migrations

### Tasks
- [ ] Create infrastructure layout
- [ ] Implement servers page
- [ ] Implement instances page
- [ ] Implement migrations page
- [ ] Implement health dashboard
- [ ] Add upgrade/downgrade buttons to org page

---

## Phase 7: Multi-Server Support (Week 7-8)

### 7.1 Add Second Server

1. Provision new Linode
2. Install Docker
3. Deploy SignalDB API
4. Register in servers table
5. Update DNS (Cloudflare load balancer)

### 7.2 Cross-Region Routing

Update nginx/Cloudflare to route:
- `api.signaldb.live` → Load balancer
- `us-east.api.signaldb.live` → Server 1
- `eu-west.api.signaldb.live` → Server 2

### 7.3 Request Forwarding

Implement in API:
- Check if data is local
- If remote, forward request to correct server
- Cache routing decisions

### Tasks
- [ ] Provision second server
- [ ] Deploy SignalDB API
- [ ] Configure Cloudflare load balancer
- [ ] Test cross-region requests
- [ ] Test failover scenarios

---

## Rollback Plan

### Phase 1-2 Rollback
- Registry tables are additive, can be dropped
- Connection manager has fallback to direct connection
- No data loss risk

### Phase 3-4 Rollback (Migrations)
- Keep migration history
- Can reverse migrations with same tools
- Maintain old schema/database until confirmed

### Phase 5-7 Rollback
- Health monitoring is observational only
- Multi-server can fall back to single server
- DNS changes are instant via Cloudflare

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Migration success rate | >99% |
| Health check latency | <50ms |
| API routing latency overhead | <5ms |
| Cross-region request latency | <100ms |
| Zero data loss migrations | 100% |

---

## Timeline Summary

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Control Plane | Registry tables, seed data |
| 1-2 | Connection Manager | Dynamic routing, request forwarding |
| 3 | Pro Tier | Pro pool, upgrade migrations |
| 4 | Enterprise | Dedicated instances, auto-provisioning |
| 5 | Monitoring | Health checks, alerting |
| 6 | Admin UI | Infrastructure management |
| 7-8 | Multi-Server | Second region, load balancing |
