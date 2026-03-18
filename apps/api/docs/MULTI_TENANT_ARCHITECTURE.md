# SignalDB Multi-Tenant Architecture

## Validated Production State (January 2026)

This section documents the **actual** production architecture as verified on 2026-01-19.

### Infrastructure Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| **Web Server** | Nginx | NOT Caddy - config at `/etc/nginx/sites-available/signaldb` |
| **SSL** | Cloudflare | Full proxy mode, handles certificates for `*.signaldb.live` |
| **App Runtime** | Bun + systemd | Services in `app-platform` Incus container: signaldb-api, signaldb-admin, signaldb-auth |
| **Database** | PostgreSQL 16 | Incus containers: pg-hobbyist (5440), pg-pro (5441), pg-enterprise-demo (5450) |
| **Server** | Linode | IP: 172.232.188.216 |

### Verified Tier Implementation

| Tier | Status | Isolation | Port | Example Project |
|------|--------|-----------|------|-----------------|
| Free | Active | Schema-per-project | 5440 | Test project uses `project_<uuid>` schema |
| Pro | Active | Database-per-project | 5441 | Production upgraded to dedicated database |
| Enterprise | Planned | Instance-per-customer | 5442+ | Not yet implemented |

### Pro Tier Migration Completed

Successfully migrated "Production" project from Free to Pro tier:
- **From:** Schema `project_9dc33b73_4fe8_4473_9a53_66a70038ee80` in `signaldb` database (port 5440)
- **To:** Database `project_9dc33b73_4fe8_4473_9a53_66a70038ee80` (port 5441)
- **Data migrated:** 15 leads, 4 tasks, 2 table definitions
- **Notify triggers:** Configured for real-time SSE events

### API Endpoints for Tier Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/v1/projects/:id/upgrade` | POST | Admin key or Internal | Upgrade project to Pro tier |
| `/v1/projects/:id/downgrade` | POST | Admin key or Internal | Downgrade project to Free tier |
| `/v1/migrations/:id` | GET | Admin key | Get migration status |

Internal admin auth uses headers: `X-Internal-Admin: true` + `X-Admin-Org-Id: <uuid>`

### Tier-Aware Query Patterns (CRITICAL)

Different tiers use different isolation models. **All data queries must be tier-aware:**

| Tier | Isolation | Table Access Pattern |
|------|-----------|---------------------|
| Free | Schema | `{schema}.tables`, `{schema}.data` |
| Pro | Database | `tables`, `data` (dedicated database) |
| Enterprise | Instance | `tables`, `data` (dedicated PostgreSQL) |

**Implementation Pattern:**

```typescript
// In route handlers (tables.ts, rows.ts)
const { sql: projectSql, schema, tier } = await connectionManager.getPool(ctx.projectId);

// Only use schema prefix for free tier
const useSchema = tier === 'free' && schema;

if (useSchema) {
  // Free tier: schema-qualified queries
  result = await projectSql`SELECT * FROM ${projectSql(schema)}.data WHERE ...`;
} else {
  // Pro/Enterprise: tables are at database level
  result = await projectSql`SELECT * FROM data WHERE ...`;
}
```

**Auth Context:**

The `ApiContext` now includes tier information:

```typescript
interface ApiContext {
  orgId: string;
  projectId: string;
  schemaName: string | null;  // null for Pro/Enterprise
  tier: string;               // 'free', 'pro', 'enterprise'
  keyId: string;
  scopes: string[];
}
```

---

## Overview

SignalDB implements a tiered multi-tenant architecture with varying levels of database isolation based on customer plan:

| Tier | Isolation Level | Description |
|------|----------------|-------------|
| **Free** | Schema | Shared PostgreSQL, separate schemas per project |
| **Pro** | Database | Shared PostgreSQL instance, separate database per project |
| **Enterprise** | Instance | Dedicated PostgreSQL container per customer |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GLOBAL LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────────────────────────────────────────┐   │
│  │ Cloudflare  │     │           Control Plane Database                │   │
│  │    DNS      │     │  ┌─────────────────────────────────────────┐   │   │
│  │             │     │  │ organizations, projects, api_keys       │   │   │
│  │ *.signaldb  │     │  │ database_servers, database_instances    │   │   │
│  │   .live     │     │  │ project_databases, server_health        │   │   │
│  └──────┬──────┘     │  └─────────────────────────────────────────┘   │   │
│         │            └─────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      API Router / Load Balancer                      │   │
│  │                                                                       │   │
│  │  Routes requests to correct regional server based on:                │   │
│  │  - API key lookup → project → database location                      │   │
│  │  - Geographic proximity (future)                                     │   │
│  │  - Health status                                                      │   │
│  └───────────┬───────────────────┬───────────────────┬─────────────────┘   │
│              │                   │                   │                      │
└──────────────┼───────────────────┼───────────────────┼──────────────────────┘
               │                   │                   │
               ▼                   ▼                   ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│   SERVER: us-east-1  │ │   SERVER: eu-west-1  │ │  SERVER: ap-south-1  │
│   (Primary - Current)│ │      (Future)        │ │      (Future)        │
├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤
│                      │ │                      │ │                      │
│ ┌──────────────────┐ │ │ ┌──────────────────┐ │ │ ┌──────────────────┐ │
│ │ SignalDB API     │ │ │ │ SignalDB API     │ │ │ │ SignalDB API     │ │
│ │ (port 3003)      │ │ │ │ (port 3003)      │ │ │ │ (port 3003)      │ │
│ └────────┬─────────┘ │ │ └────────┬─────────┘ │ │ └────────┬─────────┘ │
│          │           │ │          │           │ │          │           │
│          ▼           │ │          ▼           │ │          ▼           │
│ ┌──────────────────┐ │ │ ┌──────────────────┐ │ │ ┌──────────────────┐ │
│ │ Connection Pool  │ │ │ │ Connection Pool  │ │ │ │ Connection Pool  │ │
│ │    Manager       │ │ │ │    Manager       │ │ │ │    Manager       │ │
│ └────────┬─────────┘ │ │ └────────┬─────────┘ │ │ └────────┬─────────┘ │
│          │           │ │          │           │ │          │           │
│    ┌─────┴─────┐     │ │    ┌─────┴─────┐     │ │    ┌─────┴─────┐     │
│    ▼           ▼     │ │    ▼           ▼     │ │    ▼           ▼     │
│ ┌──────┐ ┌────────┐  │ │ ┌──────┐ ┌────────┐  │ │ ┌──────┐ ┌────────┐  │
│ │Free  │ │Pro Pool│  │ │ │Free  │ │Pro Pool│  │ │ │Free  │ │Pro Pool│  │
│ │:5440 │ │ :5441  │  │ │ │:5440 │ │ :5441  │  │ │ │:5440 │ │ :5441  │  │
│ └──────┘ └────────┘  │ │ └──────┘ └────────┘  │ │ └──────┘ └────────┘  │
│                      │ │                      │ │                      │
│ ┌──────────────────┐ │ │ ┌──────────────────┐ │ │                      │
│ │ Enterprise:      │ │ │ │ Enterprise:      │ │ │                      │
│ │ acme-corp :5442  │ │ │ │ bigco    :5442   │ │ │                      │
│ │ megacorp  :5443  │ │ │ └──────────────────┘ │ │                      │
│ └──────────────────┘ │ │                      │ │                      │
│                      │ │                      │ │                      │
│ ┌──────────────────┐ │ │ ┌──────────────────┐ │ │ ┌──────────────────┐ │
│ │ Redis (cache)    │ │ │ │ Redis (cache)    │ │ │ │ Redis (cache)    │ │
│ │ :6380            │ │ │ │ :6380            │ │ │ │ :6380            │ │
│ └──────────────────┘ │ │ └──────────────────┘ │ │ └──────────────────┘ │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

## Control Plane Schema

The control plane database (always on primary server) tracks all infrastructure:

```sql
-- ============================================
-- INFRASTRUCTURE REGISTRY
-- ============================================

-- Physical/virtual servers
CREATE TABLE servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,           -- 'us-east-1', 'eu-west-1'
  host TEXT NOT NULL,                  -- IP address
  region TEXT NOT NULL,                -- 'us-east', 'eu-west', 'ap-south'
  provider TEXT DEFAULT 'linode',      -- 'linode', 'aws', 'gcp'
  specs JSONB DEFAULT '{}',            -- CPU, RAM, disk info
  status TEXT DEFAULT 'active',        -- 'active', 'maintenance', 'offline'
  is_primary BOOLEAN DEFAULT FALSE,    -- primary hosts control plane
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PostgreSQL instances on servers
CREATE TABLE database_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id),
  name TEXT NOT NULL,                  -- 'signaldb-free', 'signaldb-pro-pool', 'ent-acme'
  container_name TEXT NOT NULL,        -- Incus container name
  port INTEGER NOT NULL,               -- External port (5440, 5441, etc.)
  tier TEXT NOT NULL,                  -- 'free', 'pro', 'enterprise'

  -- Capacity management
  max_databases INTEGER,               -- NULL = unlimited (enterprise)
  current_databases INTEGER DEFAULT 0,
  max_size_gb INTEGER,                 -- Storage limit
  current_size_gb NUMERIC DEFAULT 0,

  -- Connection info (encrypted)
  postgres_user TEXT NOT NULL,
  postgres_password_encrypted TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'active',        -- 'active', 'full', 'maintenance', 'provisioning'
  health_check_at TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(server_id, port),
  UNIQUE(server_id, container_name)
);

-- Maps projects to their database location
CREATE TABLE project_databases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES database_instances(id),

  -- Location within instance
  database_name TEXT NOT NULL,         -- 'signaldb' for free, 'proj_xxx' for pro/ent
  schema_name TEXT,                    -- Only for free tier (schema isolation)

  -- Cached connection string (encrypted, for fast lookup)
  connection_string_encrypted TEXT NOT NULL,

  -- Size tracking
  size_bytes BIGINT DEFAULT 0,
  row_count BIGINT DEFAULT 0,
  last_size_check TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'active',        -- 'active', 'migrating', 'suspended'
  migration_id UUID,                   -- If currently migrating

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id)
);

-- Migration history
CREATE TABLE database_migrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),

  -- Source
  from_instance_id UUID REFERENCES database_instances(id),
  from_database TEXT,
  from_schema TEXT,

  -- Destination
  to_instance_id UUID NOT NULL REFERENCES database_instances(id),
  to_database TEXT NOT NULL,
  to_schema TEXT,

  -- Migration details
  reason TEXT NOT NULL,                -- 'upgrade', 'downgrade', 'rebalance', 'region_move'
  status TEXT DEFAULT 'pending',       -- 'pending', 'in_progress', 'completed', 'failed', 'rolled_back'
  size_bytes BIGINT,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health monitoring
CREATE TABLE server_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id),
  instance_id UUID REFERENCES database_instances(id),

  check_type TEXT NOT NULL,            -- 'ping', 'connection', 'query', 'disk', 'memory'
  status TEXT NOT NULL,                -- 'healthy', 'degraded', 'unhealthy'
  latency_ms INTEGER,
  details JSONB,

  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_project_databases_project ON project_databases(project_id);
CREATE INDEX idx_project_databases_instance ON project_databases(instance_id);
CREATE INDEX idx_database_instances_server ON database_instances(server_id);
CREATE INDEX idx_database_instances_tier ON database_instances(tier, status);
CREATE INDEX idx_server_health_recent ON server_health(server_id, checked_at DESC);
```

## Tier Limits Configuration

```sql
-- Plan limits (could also be in code/config)
CREATE TABLE plan_limits (
  plan TEXT PRIMARY KEY,               -- 'free', 'pro', 'enterprise'

  -- Database limits
  max_db_size_mb INTEGER,              -- NULL = unlimited
  max_rows INTEGER,
  max_tables INTEGER,

  -- Connection limits
  max_connections INTEGER,
  max_realtime_connections INTEGER,

  -- Rate limits
  requests_per_minute INTEGER,

  -- Features
  isolation_level TEXT NOT NULL,       -- 'schema', 'database', 'instance'
  direct_db_access BOOLEAN DEFAULT FALSE,
  dedicated_support BOOLEAN DEFAULT FALSE,
  custom_domain BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plan_limits VALUES
  ('free', 100, 10000, 10, 5, 10, 100, 'schema', FALSE, FALSE, FALSE, NOW()),
  ('pro', 10240, 1000000, 100, 50, 100, 1000, 'database', FALSE, FALSE, TRUE, NOW()),
  ('enterprise', NULL, NULL, NULL, 500, 1000, 10000, 'instance', TRUE, TRUE, TRUE, NOW());
```

## DNS & Routing Architecture

### Current (Single Server)
```
api.signaldb.live      → 172.232.188.216 (Linode 1)
app.signaldb.live      → 172.232.188.216
demo.signaldb.live     → 172.232.188.216
*.signaldb.live        → 172.232.188.216
```

### Multi-Server (Future)
```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Cloudflare DNS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  api.signaldb.live     → Cloudflare Load Balancer                       │
│                           ├── us-east.api.signaldb.live (primary)       │
│                           ├── eu-west.api.signaldb.live                 │
│                           └── ap-south.api.signaldb.live                │
│                                                                          │
│  app.signaldb.live     → Primary server (admin panel)                   │
│                                                                          │
│  *.signaldb.live       → Regional routing based on:                     │
│                           1. Project's assigned server (from registry)  │
│                           2. Geo-proximity (fallback)                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### API Request Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. Request arrives: POST api.signaldb.live/v1/leads                    │
│     Header: Authorization: Bearer sk_live_xxx                           │
│                                                                          │
│  2. Cloudflare routes to nearest healthy API server                     │
│                                                                          │
│  3. API Server:                                                          │
│     a. Validate API key → get project_id                                │
│     b. Lookup project_databases → get connection info                   │
│     c. Check if connection is local or remote                           │
│        - Local: Use connection pool                                      │
│        - Remote: Forward to correct regional API                        │
│                                                                          │
│  4. Execute query on correct database                                   │
│                                                                          │
│  5. Return response                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cross-Region Forwarding

When a request hits the wrong region:

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Client     │      │  EU Server   │      │  US Server   │
│   (Europe)   │      │  (closest)   │      │ (data lives) │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │ 1. API Request      │                     │
       │────────────────────>│                     │
       │                     │                     │
       │                     │ 2. Lookup: data     │
       │                     │    is in US region  │
       │                     │                     │
       │                     │ 3. Forward request  │
       │                     │────────────────────>│
       │                     │                     │
       │                     │                     │ 4. Query DB
       │                     │                     │
       │                     │ 5. Response         │
       │                     │<────────────────────│
       │                     │                     │
       │ 6. Response         │                     │
       │<────────────────────│                     │
       │                     │                     │
```

## Connection Pool Manager

Each API server maintains connection pools to databases:

```typescript
// apps/api/src/lib/connection-manager.ts

interface DatabaseConnection {
  instanceId: string;
  host: string;
  port: number;
  database: string;
  schema?: string;  // For free tier
  pool: Pool;
}

class ConnectionManager {
  private pools: Map<string, DatabaseConnection> = new Map();
  private projectCache: Map<string, string> = new Map(); // projectId -> poolKey

  async getConnection(projectId: string): Promise<DatabaseConnection> {
    // Check cache first
    const cached = this.projectCache.get(projectId);
    if (cached && this.pools.has(cached)) {
      return this.pools.get(cached)!;
    }

    // Lookup from registry
    const dbInfo = await this.lookupProjectDatabase(projectId);

    // Check if we're on the right server
    if (dbInfo.serverId !== CURRENT_SERVER_ID) {
      throw new RemoteServerError(dbInfo.serverId, dbInfo.serverHost);
    }

    // Get or create pool
    const poolKey = `${dbInfo.instanceId}:${dbInfo.database}`;
    if (!this.pools.has(poolKey)) {
      const pool = new Pool({
        host: dbInfo.host,
        port: dbInfo.port,
        database: dbInfo.database,
        user: dbInfo.user,
        password: await decrypt(dbInfo.passwordEncrypted),
        max: dbInfo.tier === 'enterprise' ? 50 : 20,
      });

      this.pools.set(poolKey, {
        instanceId: dbInfo.instanceId,
        host: dbInfo.host,
        port: dbInfo.port,
        database: dbInfo.database,
        schema: dbInfo.schema,
        pool,
      });
    }

    this.projectCache.set(projectId, poolKey);
    return this.pools.get(poolKey)!;
  }

  async executeQuery(projectId: string, query: string, params: any[]) {
    const conn = await this.getConnection(projectId);

    // For free tier, set search_path to project schema
    if (conn.schema) {
      await conn.pool.query(`SET search_path TO "${conn.schema}", public`);
    }

    return conn.pool.query(query, params);
  }
}
```

## Provisioning Service

### Auto-Provisioning Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  NEW PRO CUSTOMER                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User upgrades to Pro                                                │
│     └── Billing webhook triggers provisioning                           │
│                                                                          │
│  2. Find available Pro pool instance                                    │
│     SELECT * FROM database_instances                                    │
│     WHERE tier = 'pro'                                                  │
│       AND status = 'active'                                             │
│       AND current_databases < max_databases                             │
│     ORDER BY current_databases ASC                                      │
│     LIMIT 1;                                                            │
│                                                                          │
│  3. If no capacity → Provision new Pro pool                             │
│     a. Find server with capacity                                        │
│     b. Allocate next available port                                     │
│     c. Create Docker container                                          │
│     d. Wait for health check                                            │
│     e. Register in database_instances                                   │
│                                                                          │
│  4. Create database in pool                                             │
│     CREATE DATABASE project_<uuid>;                                     │
│                                                                          │
│  5. Migrate data from free schema                                       │
│     pg_dump --schema=project_xxx | pg_restore                           │
│                                                                          │
│  6. Update project_databases registry                                   │
│                                                                          │
│  7. Drop old schema                                                     │
│     DROP SCHEMA project_xxx CASCADE;                                    │
│                                                                          │
│  8. Invalidate connection caches                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Docker Provisioning Script

```bash
#!/bin/bash
# scripts/provision-postgres.sh

INSTANCE_NAME=$1
PORT=$2
TIER=$3
PASSWORD=$(openssl rand -base64 32)

# Resource limits by tier
case $TIER in
  "free")
    MEMORY="512m"
    CPU="0.5"
    ;;
  "pro")
    MEMORY="2g"
    CPU="1"
    ;;
  "enterprise")
    MEMORY="8g"
    CPU="4"
    ;;
esac

docker run -d \
  --name "$INSTANCE_NAME" \
  --restart unless-stopped \
  -p "127.0.0.1:${PORT}:5432" \
  -e POSTGRES_USER=signaldb \
  -e POSTGRES_PASSWORD="$PASSWORD" \
  -e POSTGRES_DB=signaldb \
  -v "/opt/signaldb/data/${INSTANCE_NAME}:/var/lib/postgresql/data" \
  --memory="$MEMORY" \
  --cpus="$CPU" \
  --health-cmd="pg_isready -U signaldb" \
  --health-interval=10s \
  --health-timeout=5s \
  --health-retries=3 \
  postgres:16-alpine

# Wait for healthy
echo "Waiting for PostgreSQL to be ready..."
until docker inspect --format='{{.State.Health.Status}}' "$INSTANCE_NAME" | grep -q "healthy"; do
  sleep 2
done

echo "PostgreSQL instance $INSTANCE_NAME ready on port $PORT"
echo "Password: $PASSWORD"
```

## Migration Service

### Upgrade Migration (Free → Pro)

```typescript
// apps/api/src/services/migration.ts

async function migrateToProTier(projectId: string): Promise<void> {
  const migration = await db.insert(databaseMigrations).values({
    projectId,
    reason: 'upgrade',
    status: 'pending',
  }).returning('id');

  try {
    // 1. Get current location
    const current = await getProjectDatabase(projectId);

    // 2. Find/create Pro pool instance
    const proInstance = await findOrCreateProInstance(current.serverId);

    // 3. Create new database
    const newDbName = `project_${projectId.replace(/-/g, '_')}`;
    await createDatabase(proInstance, newDbName);

    // 4. Update migration status
    await updateMigration(migration.id, { status: 'in_progress', startedAt: new Date() });

    // 5. Dump from schema
    const dumpFile = `/tmp/migration_${projectId}.sql`;
    await exec(`PGPASSWORD=${current.password} pg_dump -h ${current.host} -p ${current.port} -U signaldb -d signaldb --schema=${current.schema} -f ${dumpFile}`);

    // 6. Restore to new database
    await exec(`PGPASSWORD=${proInstance.password} psql -h ${proInstance.host} -p ${proInstance.port} -U signaldb -d ${newDbName} -f ${dumpFile}`);

    // 7. Update registry
    await updateProjectDatabase(projectId, {
      instanceId: proInstance.id,
      databaseName: newDbName,
      schemaName: null,
    });

    // 8. Drop old schema
    await exec(`PGPASSWORD=${current.password} psql -h ${current.host} -p ${current.port} -U signaldb -d signaldb -c "DROP SCHEMA IF EXISTS ${current.schema} CASCADE"`);

    // 9. Complete migration
    await updateMigration(migration.id, { status: 'completed', completedAt: new Date() });

    // 10. Invalidate caches
    await invalidateProjectCache(projectId);

  } catch (error) {
    await updateMigration(migration.id, {
      status: 'failed',
      errorMessage: error.message
    });
    throw error;
  }
}
```

### Downgrade Migration (Pro → Free)

```typescript
async function migrateToFreeTier(projectId: string): Promise<void> {
  // 1. Check size limits
  const currentSize = await getProjectDatabaseSize(projectId);
  const freeLimit = await getPlanLimit('free', 'max_db_size_mb');

  if (currentSize > freeLimit * 1024 * 1024) {
    throw new Error(
      `Database size (${formatBytes(currentSize)}) exceeds free tier limit (${freeLimit}MB). ` +
      `Please reduce data before downgrading.`
    );
  }

  // 2. Similar migration flow but in reverse...
  // Create schema in free instance, dump/restore, drop old database
}
```

## Health Monitoring

```typescript
// apps/api/src/services/health-monitor.ts

class HealthMonitor {
  private interval: NodeJS.Timer;

  start() {
    // Check every 30 seconds
    this.interval = setInterval(() => this.checkAll(), 30000);
  }

  async checkAll() {
    const instances = await db.select().from(databaseInstances).where({ status: 'active' });

    for (const instance of instances) {
      await this.checkInstance(instance);
    }
  }

  async checkInstance(instance: DatabaseInstance) {
    const startTime = Date.now();

    try {
      // Connection check
      const pool = new Pool({
        host: instance.host,
        port: instance.port,
        database: 'postgres',
        user: instance.user,
        password: await decrypt(instance.passwordEncrypted),
        connectionTimeoutMillis: 5000,
      });

      await pool.query('SELECT 1');
      const latency = Date.now() - startTime;
      await pool.end();

      // Record health
      await recordHealth(instance.id, {
        checkType: 'connection',
        status: latency < 100 ? 'healthy' : 'degraded',
        latencyMs: latency,
      });

      // Check disk usage
      const diskUsage = await this.checkDiskUsage(instance);
      await recordHealth(instance.id, {
        checkType: 'disk',
        status: diskUsage < 80 ? 'healthy' : diskUsage < 95 ? 'degraded' : 'unhealthy',
        details: { usagePercent: diskUsage },
      });

    } catch (error) {
      await recordHealth(instance.id, {
        checkType: 'connection',
        status: 'unhealthy',
        details: { error: error.message },
      });

      // Alert if instance is down
      await this.alertInstanceDown(instance);
    }
  }
}
```

## Admin UI Components

### Server Management Page

```
/admin/infrastructure
├── /servers           - List/manage physical servers
├── /instances         - List/manage PostgreSQL instances
├── /migrations        - View migration history
└── /health            - Real-time health dashboard
```

### Key Admin Features

1. **Server Overview**
   - CPU, memory, disk usage per server
   - Number of instances per server
   - Instance capacity utilization

2. **Instance Management**
   - Create new instances (pro pool, enterprise)
   - View databases per instance
   - Manual maintenance mode

3. **Project Database Viewer**
   - See where each project's data lives
   - Trigger manual migrations
   - View size/usage per project

4. **Health Dashboard**
   - Real-time health status
   - Latency graphs
   - Alert history

## Implementation Phases

### Phase 1: Registry & Routing (Week 1-2) - COMPLETE
- [x] Create control plane schema
- [x] Migrate existing data to new schema
- [x] Update API to use connection manager
- [x] Add project_databases lookup

### Phase 2: Pro Tier Support (Week 3-4) - COMPLETE (Jan 2026)
- [x] Create Pro pool instance (signaldb-pro on port 5441)
- [x] Implement database-level isolation
- [x] Build upgrade migration flow (`/v1/projects/:id/upgrade`)
- [x] Build downgrade migration flow (`/v1/projects/:id/downgrade`)
- [ ] Add size limit enforcement (partial - checks exist but not enforced)

### Phase 3: Enterprise Tier (Week 5-6)
- [ ] Implement per-customer instance provisioning
- [ ] Add direct database access feature
- [ ] Custom resource allocation

### Phase 4: Multi-Server (Week 7-8)
- [ ] Add second server
- [ ] Implement cross-region routing
- [ ] Request forwarding
- [ ] Health-based routing

### Phase 5: Admin UI (Week 9-10) - PARTIAL (Jan 2026)
- [ ] Infrastructure management pages
- [ ] Health monitoring dashboard
- [x] Migration management UI (Tier & Isolation tab in project details)
- [ ] Alerting integration

## Security Considerations

1. **Connection Strings**: Always encrypted at rest
2. **Network**: PostgreSQL only listens on 127.0.0.1
3. **Credentials**: Unique password per instance, rotated regularly
4. **Access**: Enterprise customers can have read-only replicas, never write access to production
5. **Audit**: All migrations and admin actions logged

## Disaster Recovery

1. **Backups**
   - Free: Daily pg_dump of shared DB
   - Pro: Daily pg_dump per database
   - Enterprise: Continuous WAL archiving + daily snapshots

2. **Recovery**
   - Free/Pro: Restore from latest backup
   - Enterprise: Point-in-time recovery available

3. **Failover**
   - Single server: Manual failover to backup
   - Multi-server: Automatic failover via health checks
