# Database Schema Documentation

**Database**: PostgreSQL
**ORM**: Drizzle
**Port**: 5439 (Docker)
**Real-time**: ElectricSQL replication

---

## 🎯 Core Principles

### Event Sourcing
- Hook events are INSERT-only (immutable)
- Never UPDATE or DELETE events
- Derive state from event stream

### JSONB for Flexibility
- Event payloads stored as JSONB
- Allows schema evolution
- Queryable with PostgreSQL operators

---

## 📊 Tables

### `hook_events`
**Purpose**: Store all Claude Code hook events
```sql
CREATE TABLE hook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  agent_type TEXT,
  event_name TEXT NOT NULL,
  tool_name TEXT,
  payload JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_project_session ON hook_events(project_id, session_id);
CREATE INDEX idx_created_at ON hook_events(created_at DESC);
```

### `projects`
**Purpose**: Agios projects
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `sessions`
**Purpose**: Claude Code sessions
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  session_id TEXT NOT NULL,
  agent_type TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  UNIQUE(project_id, session_id)
);
```

### `todos`
**Purpose**: Extracted todos from sessions
```sql
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  session_id TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  active_form TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `agents`
**Purpose**: Agent registry
```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  type TEXT NOT NULL,
  last_seen TIMESTAMP,
  metadata JSONB,
  UNIQUE(project_id, type)
);
```

---

## 🔄 Migration Workflow

### 1. Modify Schema
```typescript
// packages/db/src/schema/hook-events.ts
export const hookEvents = pgTable('hook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Add new column here
  newField: text('new_field'),
});
```

### 2. Generate Migration
```bash
bun run db:generate
# Creates: packages/db/src/migrations/0001_xyz.sql
```

### 3. Apply Migration
```bash
bun run db:migrate
# Applies to database
```

### 4. Update TypeScript Types
```bash
# Types are auto-generated from schema
# Just restart TypeScript server
```

---

## 🔍 Common Queries

### Get Recent Events
```typescript
const events = await db
  .select()
  .from(hookEvents)
  .where(eq(hookEvents.projectId, projectId))
  .orderBy(desc(hookEvents.createdAt))
  .limit(100);
```

### Get Session Events
```typescript
const sessionEvents = await db
  .select()
  .from(hookEvents)
  .where(and(
    eq(hookEvents.projectId, projectId),
    eq(hookEvents.sessionId, sessionId)
  ))
  .orderBy(asc(hookEvents.createdAt));
```

### JSONB Queries
```typescript
// Find events with specific tool
const bashEvents = await db
  .select()
  .from(hookEvents)
  .where(sql`payload->>'tool_name' = 'Bash'`);
```

---

## 🚀 Real-time Triggers

### PostgreSQL NOTIFY
```sql
-- Trigger function
CREATE FUNCTION notify_hook_event() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('hook_event_inserted', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER hook_event_notify
AFTER INSERT ON hook_events
FOR EACH ROW
EXECUTE FUNCTION notify_hook_event();
```

### ElectricSQL Shapes
ElectricSQL automatically creates shapes for all tables:
- `http://localhost:3001/streams/hook_events`
- `http://localhost:3001/streams/sessions`
- `http://localhost:3001/streams/todos`

---

## 🐛 Common Issues

### "Relation does not exist"
```bash
# Migrations not applied
bun run db:migrate
```

### "Type error after schema change"
```bash
# Regenerate types
bun run db:generate
# Restart TS server
```

### "Performance issues"
```sql
-- Check missing indexes
EXPLAIN ANALYZE [your query];

-- Add index if needed
CREATE INDEX idx_name ON table(column);
```

---

## 🔧 Database Management

### Connect via psql
```bash
psql -h localhost -p 5439 -U postgres -d agios_dev
```

### Drizzle Studio (GUI)
```bash
bun run db:studio
# Opens http://localhost:4983
```

### Reset Database
```bash
# WARNING: Destroys all data
docker compose down -v
docker compose up -d
bun run db:migrate
```

---

## ⚠️ Critical Rules

1. **NEVER edit migrations** after they're applied
2. **NEVER UPDATE/DELETE hook_events** - immutable
3. **Always use transactions** for multi-table operations
4. **Index foreign keys** for performance

---

## 📋 Type Safety

### Inferred Types
```typescript
// Automatically inferred from schema
import type { HookEvent } from '@agios/db';

// Type-safe queries
const event: HookEvent = await db.query.hookEvents.findFirst();
```

### Schema Exports
```typescript
// packages/db/src/index.ts
export { hookEvents, projects, sessions, todos, agents } from './schema';
export type { HookEvent, Project, Session, Todo, Agent } from './schema';
```

---

## 📚 Related Documentation

- Drizzle ORM: [Official docs](https://orm.drizzle.team)
- ElectricSQL: [`docs/ELECTRICSQL-STREAMING.md`](../../docs/ELECTRICSQL-STREAMING.md)
- Migration history: [`packages/db/MIGRATIONS.md`](MIGRATIONS.md)