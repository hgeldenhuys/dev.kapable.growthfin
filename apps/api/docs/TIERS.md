# SignalDB Tier Structure

## Overview

SignalDB uses a 4-tier system that determines database isolation level and resource limits.
The **Organization Plan** controls what tier projects can use.

**Important:** All tiers require payment (credit card verification) to prevent abuse.

## Tiers

| Tier | Isolation | Description | Price |
|------|-----------|-------------|-------|
| **Hobbyist** | Schema | Shared PostgreSQL database, separate schema per project | $1-5/mo |
| **Pro** | Database | Shared PostgreSQL instance, separate database per project | $29/mo |
| **Business** | Org Instance | Dedicated PostgreSQL container for the organization (all projects share) | $99/mo |
| **Enterprise** | Project Instance | Dedicated PostgreSQL container per project (maximum isolation) | Custom |

## Resource Limits

| Tier | Max Projects | Storage | Rows | API Calls/day |
|------|--------------|---------|------|---------------|
| Hobbyist | 1 | 100 MB | 10K | 1K |
| Pro | 5 | 5 GB | 500K | 50K |
| Business | 20 | 50 GB | 5M | 500K |
| Enterprise | Unlimited | Custom | Custom | Custom |

## Isolation Levels

### Hobbyist Tier (Schema Isolation)
```
┌─────────────────────────────────────────────┐
│ signaldb-hobbyist (PostgreSQL container)    │
│ ┌─────────────────────────────────────────┐ │
│ │ signaldb database                       │ │
│ │ ├── project_abc123 schema (Org A)       │ │
│ │ │   ├── tables                          │ │
│ │ │   └── data                            │ │
│ │ ├── project_def456 schema (Org B)       │ │
│ │ │   ├── tables                          │ │
│ │ │   └── data                            │ │
│ │ └── project_ghi789 schema (Org C)       │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Pro Tier (Database Isolation)
```
┌─────────────────────────────────────────────┐
│ signaldb-pro-pool (PostgreSQL container)    │
│ ├── project_abc123 database (Org A)         │
│ │   ├── tables                              │
│ │   └── data                                │
│ ├── project_def456 database (Org B)         │
│ │   ├── tables                              │
│ │   └── data                                │
│ └── project_ghi789 database (Org C)         │
└─────────────────────────────────────────────┘
```

### Business Tier (Org Instance Isolation)
```
┌─────────────────────────────────────────────┐
│ signaldb-business-orgA (dedicated container)│
│ ├── project_abc123 database                 │
│ │   ├── tables                              │
│ │   └── data                                │
│ └── project_xyz789 database                 │
│     ├── tables                              │
│     └── data                                │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ signaldb-business-orgB (dedicated container)│
│ └── project_def456 database                 │
└─────────────────────────────────────────────┘
```

### Enterprise Tier (Project Instance Isolation)
```
┌─────────────────────────────────────────────┐
│ signaldb-enterprise-abc123 (dedicated)      │
│ └── project_abc123 database                 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ signaldb-enterprise-def456 (dedicated)      │
│ └── project_def456 database                 │
└─────────────────────────────────────────────┘
```

## Upgrade/Downgrade Paths

```
Hobbyist ←→ Pro ←→ Business ←→ Enterprise
```

### Upgrade Requirements
- **Hobbyist → Pro**: Org must be on Pro plan or higher
- **Pro → Business**: Org must be on Business plan or higher
- **Business → Enterprise**: Org must be on Enterprise plan

### Downgrade Checks
- **Pro → Hobbyist**: Project must fit within Hobbyist tier limits (100MB, 10K rows)
- **Business → Pro**: Project must fit within Pro tier limits
- **Enterprise → Business**: All org's projects must fit in single instance

## Database Schema

### organizations table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'hobbyist',  -- hobbyist, pro, business, enterprise
  max_projects INTEGER,
  max_storage_bytes BIGINT,
  max_rows BIGINT,
  max_api_calls_daily INTEGER,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### database_instances table
```sql
CREATE TABLE database_instances (
  id UUID PRIMARY KEY,
  server_id UUID REFERENCES servers(id),
  name TEXT NOT NULL,
  container_name TEXT UNIQUE NOT NULL,
  port INTEGER NOT NULL,
  tier TEXT NOT NULL,  -- hobbyist, pro, business, enterprise
  org_id UUID REFERENCES organizations(id),  -- For business tier (dedicated to org)
  max_databases INTEGER,
  current_databases INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  ...
);
```

## API Endpoints

### Check Org Limits
```
GET /v1/org/limits
```

### Upgrade Org Plan
```
POST /v1/org/upgrade
{ "plan": "pro" | "business" | "enterprise" }
```

### Upgrade Project Tier
```
POST /v1/projects/{id}/upgrade
{ "targetTier": "pro" | "business" | "enterprise" }
```

### Downgrade Project Tier
```
POST /v1/projects/{id}/downgrade
{ "targetTier": "pro" | "hobbyist" }
```

Note: Project tier is constrained by org plan. Upgrading org plan automatically
allows projects to use higher tiers.

## Billing Integration (Future)

- Stripe subscription for org plan changes
- Credit card required for all tiers (anti-abuse measure)
- Usage-based billing for overages
- Metered billing for API calls
