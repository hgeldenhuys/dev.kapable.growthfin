# @agios/db

Shared database schemas and client using Drizzle ORM with PostgreSQL.

## Features

- ✅ **Type-safe** - Full TypeScript support with Drizzle ORM
- ✅ **RLS (Row Level Security)** - Workspace-based data isolation
- ✅ **Multi-tenant** - Support for multiple workspaces per user
- ✅ **Relations** - Properly typed relationships between tables
- ✅ **Migrations** - Schema versioning with Drizzle Kit

## Installation

This package is part of the Agios monorepo and is automatically linked via Bun workspaces.

## Database Schema

### Authentication Tables

#### `users`
Core user authentication table (Better Auth).

```typescript
{
  id: uuid (PK)
  email: string (unique)
  name: string | null
  emailVerified: boolean
  image: string | null
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `sessions`
User sessions (Better Auth).

```typescript
{
  id: uuid (PK)
  userId: uuid (FK -> users.id)
  expiresAt: timestamp
  token: string (unique)
  ipAddress: string | null
  userAgent: string | null
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `accounts`
OAuth provider accounts (Better Auth).

```typescript
{
  id: uuid (PK)
  userId: uuid (FK -> users.id)
  provider: string
  providerAccountId: string
  // ... other OAuth fields
}
```

#### `device_codes`
CLI device authentication codes (OAuth 2.0 Device Flow).

```typescript
{
  id: uuid (PK)
  deviceCode: string (unique)    // Long random code for CLI polling
  userCode: string (unique)      // 6-character code user enters in web
  userId: uuid | null (FK -> users.id)
  confirmed: boolean              // Whether user confirmed in web app
  expiresAt: timestamp            // Expires after 15 minutes
  createdAt: timestamp
}
```

### Workspace Tables

#### `workspaces`
Multi-tenant workspaces (with RLS).

```typescript
{
  id: uuid (PK)
  name: string
  slug: string (unique)
  ownerId: uuid (FK -> users.id)
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `workspace_members`
User-workspace relationships (with RLS).

```typescript
{
  id: uuid (PK)
  workspaceId: uuid (FK -> workspaces.id)
  userId: uuid (FK -> users.id)
  role: 'owner' | 'admin' | 'member'
  createdAt: timestamp
}
```

#### `hook_events`
Captured Claude Code hook events (system-wide, **no workspace association**).

**Note**: Hook events are project-based logs, not workspace-based. Each project gets a unique `projectId` during `agios hooks install`, which is stored in `.agent/config.json`.

```typescript
{
  id: uuid (PK)
  projectId: uuid                // From .agent/config.json (not workspace!)
  sessionId: string              // Claude Code session ID
  eventName: string              // Hook event type
  toolName: string | null        // Tool name (for PreToolUse/PostToolUse)
  payload: jsonb                 // Full event payload including conversation context
  createdAt: timestamp
  processedAt: timestamp | null  // NULL = unprocessed, NOT NULL = processed
}
```

**Payload Structure:**
```typescript
{
  event: AnyHookInput,            // Full hook event from Claude Code
  conversation: TranscriptLine | null,  // Last transcript line for context
  timestamp: string                     // ISO 8601 timestamp
}
```

## Usage

### Basic Queries

```typescript
import { db, users, workspaces } from '@agios/db';

// Select all users
const allUsers = await db.select().from(users);

// Insert a workspace
const newWorkspace = await db.insert(workspaces).values({
  name: 'My Workspace',
  slug: 'my-workspace',
  ownerId: userId,
}).returning();
```

### With RLS Context

```typescript
import { db, withRLSContext, hookEvents } from '@agios/db';

// Query with RLS context
const events = await withRLSContext(
  db,
  { userId: 'user-uuid', workspaceId: 'workspace-uuid' },
  async (db) => {
    // All queries here respect RLS policies
    return db.select().from(hookEvents);
  }
);
```

### Manual RLS Context

```typescript
import { db, setRLSContext, clearRLSContext } from '@agios/db';

try {
  await setRLSContext(db, {
    userId: 'user-uuid',
    workspaceId: 'workspace-uuid',
  });

  // Queries here respect RLS
  const events = await db.select().from(hookEvents);
} finally {
  await clearRLSContext(db);
}
```

### Relations

```typescript
import { db, workspaces, workspaceMembers } from '@agios/db';

// Query with relations
const workspaceWithMembers = await db.query.workspaces.findFirst({
  where: (workspaces, { eq }) => eq(workspaces.id, workspaceId),
  with: {
    owner: true,
    members: {
      with: {
        user: true,
      },
    },
    hookEvents: {
      limit: 10,
      orderBy: (events, { desc }) => [desc(events.createdAt)],
    },
  },
});
```

## Development

### Generate Migrations

```bash
bun run db:generate
```

### Push Schema (Dev)

```bash
bun run db:push
```

### Run Migrations

```bash
bun run db:migrate
```

### Drizzle Studio

```bash
bun run db:studio
```

## Row Level Security (RLS)

RLS is enabled on **workspace-scoped tables only**:
- `workspaces`
- `workspace_members`

**NOT enabled on:**
- `users` (authentication table)
- `sessions` (Better Auth)
- `accounts` (Better Auth)
- `device_codes` (authentication)
- `hook_events` (system-wide project logs, access controlled via API auth)

### How RLS Works

1. **Set Context**: Before querying, set the user and workspace context:
   ```typescript
   await setRLSContext(db, { userId, workspaceId });
   ```

2. **PostgreSQL Policies**: RLS policies check the session variables:
   ```sql
   USING (workspace_id = current_setting('app.workspace_id')::uuid)
   ```

3. **Data Isolation**: Users can only access data from workspaces they belong to.

### RLS Policies

#### Workspaces
- **SELECT**: Users can view workspaces they own or are members of
- **INSERT**: Users can create their own workspaces
- **UPDATE**: Only workspace owners can update
- **DELETE**: Only workspace owners can delete

#### Workspace Members
- **SELECT**: Users can view members of their workspaces
- **ALL**: Owners and admins can manage members

### Hook Events Access Control

Hook events do NOT use RLS. Access control is handled at the API layer:
- API requires valid bearer token
- Each project has a unique `projectId` from `.agent/config.json`
- Events are queried by `projectId`, not `workspaceId`
- Future: Projects can be associated with workspaces for team access

## Environment Variables

```bash
DATABASE_URL="postgresql://user:password@host:port/database"
```

## Type Safety

All tables export infer types:

```typescript
import type { User, Workspace, HookEvent } from '@agios/db';

const user: User = {
  id: '...',
  email: 'user@example.com',
  // ... fully typed
};
```

## Authentication Flow

### Web Authentication
1. User signs up/in via Better Auth
2. Session created in `sessions` table
3. HTTP-only cookie sent to browser
4. Session validated on subsequent requests

### CLI Device Authentication
1. CLI calls `POST /auth/device/init`
2. API creates `device_codes` entry with:
   - `deviceCode`: Long random string for CLI polling
   - `userCode`: 6-character code for user entry
   - `expiresAt`: 15 minutes from now
3. User visits web app, enters `userCode`
4. Web app calls `POST /auth/device/confirm`
5. API updates `device_codes`: `confirmed=true`, `userId=<user-id>`
6. CLI polls `POST /auth/device/poll` with `deviceCode`
7. API returns access token when confirmed

See [ARCHITECTURE.md](../../ARCHITECTURE.md#cli-device-authentication-flow) for detailed flow.

## Future Enhancements

- [ ] Soft deletes
- [ ] Audit logging
- [ ] Database seeding
- [ ] ✅ Better Auth integration (Completed)
- [ ] Electric-SQL sync setup
- [ ] Project-workspace associations (for team access to hooks)

## Related Documentation

- [Architecture Documentation](../../temp/ARCHITECTURE.md)
- [API Documentation](../../apps/api/README.md)
- [CLI Documentation](../../apps/cli/README.md)

## License

Proprietary - Part of the Agios project
