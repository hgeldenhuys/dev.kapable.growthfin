# @agios/api

ElysiaJS backend API for the Agios system.

## Features

- ✅ **Modular Architecture** - Feature-based modules following Elysia best practices
- ✅ **Type-safe** - End-to-end TypeScript with Drizzle ORM
- ✅ **Swagger Docs** - Auto-generated API documentation
- ✅ **CORS Support** - Configurable cross-origin requests
- ✅ **Database Integration** - PostgreSQL via Drizzle ORM
- ✅ **Logging** - Structured logging with request IDs
- ✅ **Custom Authentication** - Session-based auth with bcryptjs
- ✅ **Device Authentication** - OAuth 2.0 Device Authorization Grant for CLI
- ✅ **SDK Distribution** - Serves pre-built hooks SDK tarball
- ✅ **Background Workers** - pgboss for async job processing
- ✅ **Real-time Streaming** - ElectricSQL (PostgreSQL logical replication) with SSE (NO POLLING)
- ✅ **CRM & Enrichment** - AI-powered contact enrichment with templates, analytics, multi-tenant support (Sprint 6)
- 🚧 **RLS Support** - Row-level security (Future)

## Quick Start

```bash
# Install dependencies (from root)
cd ../.. && bun install

# Configure environment (from root)
cp .env.example .env
# Edit .env and set BETTER_AUTH_SECRET

# Start development server
cd apps/api
bun run dev
```

**Note:** All environment variables are configured in the root `.env` file.

Visit:
- API: http://localhost:3000
- Swagger: http://localhost:3000/swagger
- Health: http://localhost:3000/health

## Project Structure

```
src/
├── index.ts              # Main entry point
├── config/
│   ├── env.ts           # Environment configuration
│   └── cors.ts          # CORS configuration
├── plugins/
│   ├── database.ts      # Database plugin
│   ├── auth.ts          # Better Auth plugin
│   └── logger.ts        # Logger plugin
├── lib/
│   ├── queue.ts         # pgboss job queue setup
│   ├── llm.ts           # LLM service for event summaries
│   ├── electric-client.ts   # ElectricSQL HTTP client with SSE streaming
│   └── electric-shapes.ts   # Helper functions for each table type
├── workers/             # Background job workers
│   ├── create-chat-messages.ts  # Extract chat from events
│   ├── summarize-event.ts       # Generate event summaries
│   ├── extract-todos.ts         # Parse TodoWrite events
│   └── generate-todo-title.ts   # Create session titles
└── modules/
    ├── health/          # Health check module
    │   ├── index.ts
    │   └── routes.ts
    ├── auth/            # Authentication module
    │   ├── index.ts
    │   ├── routes.ts
    │   ├── service.ts   # Auth service (bcryptjs)
    │   └── device-service.ts  # Device flow service
    ├── download/        # SDK download module
    │   ├── index.ts
    │   └── routes.ts
    ├── workspaces/      # Workspace management
    │   ├── index.ts
    │   ├── routes.ts
    │   └── service.ts
    ├── hook-events/     # Hook events module
    │   ├── index.ts
    │   ├── routes.ts
    │   └── service.ts
    ├── chat-messages/   # Chat messages module
    │   ├── index.ts
    │   └── routes.ts
    ├── todos/           # Todos module
    │   ├── index.ts
    │   └── routes.ts
    ├── sessions/        # Sessions module
    │   ├── index.ts
    │   └── routes.ts
    ├── summaries/       # Event summaries module
    │   ├── index.ts
    │   └── routes.ts
    └── crm/             # CRM & Enrichment module (Sprint 6)
        ├── index.ts
        ├── routes/
        │   ├── contact-lists.ts
        │   └── enrichment.ts
        └── services/
            ├── contact-lists.ts
            └── enrichment.ts
```

## API Endpoints

### Health

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check with DB status

### Generic SSE Streaming (Multiplexed)

- `GET /api/v1/stream?table=TABLE&where=CLAUSE&ids=ID1,ID2&columns=COL1,COL2` - Generic SSE endpoint for all tables

**Query Parameters:**
- `table` (required) - Table name (must be in whitelist)
- `where` (optional) - SQL WHERE clause for filtering
- `ids` (optional) - Comma-separated ID list for filtering specific rows
- `columns` (optional) - Comma-separated column list to stream only specific fields

**Allowed Tables:**
- `workspaces`
- `projects`
- `claude_sessions`
- `chat_messages`
- `event_summaries`
- `hook_events`

**Examples:**
```bash
# Stream all workspaces
curl -N http://localhost:3000/api/v1/stream?table=workspaces

# Stream hook events for specific agent type
curl -N http://localhost:3000/api/v1/stream?table=hook_events&where=agent_type='Explore'

# Stream specific sessions by ID
curl -N http://localhost:3000/api/v1/stream?table=claude_sessions&ids=id1,id2,id3

# Combine WHERE and IDs
curl -N http://localhost:3000/api/v1/stream?table=sessions&where=project_id='abc'&ids=id1,id2

# Select specific columns
curl -N http://localhost:3000/api/v1/stream?table=sessions&columns=id,title,status
```

**Response Format:** Server-Sent Events (SSE) with ElectricSQL change data

See [SSE-MULTIPLEXING-GUIDE.md](../../docs/SSE-MULTIPLEXING-GUIDE.md) and [SSE-VS-REST-ENDPOINTS.md](../../docs/SSE-VS-REST-ENDPOINTS.md) for architecture and usage patterns.

### Authentication

#### Web Authentication
- `POST /auth/sign-up/email` - Register new user with email/password
- `POST /auth/sign-in/email` - Sign in with email/password
- `POST /auth/sign-out` - Sign out (clears session cookie)
- `GET /auth/session` - Get current session

#### CLI Device Authentication
- `POST /auth/device/init` - Initialize device flow, returns device_code and user_code
- `POST /auth/device/confirm` - Confirm device with user_code (requires auth)
- `POST /auth/device/poll` - Poll for device confirmation status

See [ARCHITECTURE.md](../../ARCHITECTURE.md#cli-device-authentication-flow) for detailed flow.

### SDK Download

- `GET /download/hooks-sdk.tgz` - Download pre-built hooks SDK tarball
- `HEAD /download/hooks-sdk.tgz` - Get tarball metadata
- `GET /download/hooks-sdk/version` - Get SDK version info

### Workspaces

- `GET /api/v1/workspaces` - List workspaces
- `GET /api/v1/workspaces/:id` - Get workspace by ID
- `POST /api/v1/workspaces` - Create workspace

### Hook Events

**Immutability Guarantee**: The `hook_events` table is **INSERT-only** (never updated). Each event has a unique ID from Claude Code's payload, ensuring complete event sourcing without mutations.

- `GET /api/v1/hook-events?limit=50&offset=0` - List hook events
- `POST /api/v1/hook-events` - Create hook event (INSERT-only)
- `GET /api/v1/hook-events/recent?seconds=30&projectId=<uuid>` - Get recent events (Electric-SQL initial state)
- `GET /api/v1/hook-events/stream?since=<timestamp>&projectId=<uuid>` - Stream events via SSE (Electric-SQL delta updates)

**Performance Metrics**: Previously, `hook_events` tracked performance metrics (queuedAt, workerStartedAt, etc.) via UPDATE operations. These have been **removed** to maintain immutability. Performance tracking can be added to a separate table if needed.

### Chat Messages

Real-time chat messages extracted from hook events by background worker.

- `GET /api/v1/chat-messages/recent?seconds=30&projectId=<uuid>` - Get recent chat messages
- `GET /api/v1/chat-messages/stream?since=<timestamp>&projectId=<uuid>` - Stream chat messages via SSE
- `GET /api/v1/chat-messages/session/:sessionId` - Get chat for specific session

### Event Summaries

LLM-generated summaries for all hook events.

- `GET /api/v1/summaries/recent?seconds=30&projectId=<uuid>` - Get recent summaries
- `GET /api/v1/summaries/stream?since=<timestamp>&projectId=<uuid>` - Stream summaries via SSE

### Todos

Todo items extracted from TodoWrite events.

- `GET /api/v1/todos/recent?seconds=30&projectId=<uuid>` - Get recent sessions with todos
- `GET /api/v1/todos/stream?since=<timestamp>&projectId=<uuid>` - Stream todo updates via SSE
- `GET /api/v1/todos/session/:sessionId` - Get todos for specific session

### Sessions

Claude Code session lifecycle and metadata.

- `GET /api/v1/sessions/recent?seconds=30&projectId=<uuid>` - Get recent sessions
- `GET /api/v1/sessions/stream?since=<timestamp>&projectId=<uuid>` - Stream session updates via SSE

### CRM & Contact Enrichment (Added Sprint 6 - 2025-11-10)

AI-powered contact enrichment system with template-based scoring models, analytics, and multi-tenant support.

#### Leads Management
- `GET /api/v1/crm/leads?workspaceId=<uuid>` - List leads
- `GET /api/v1/crm/leads/:id?workspaceId=<uuid>` - Get lead details
- `POST /api/v1/crm/leads` - Create lead
- `PUT /api/v1/crm/leads/:id` - Update lead
- `DELETE /api/v1/crm/leads/:id` - Delete lead
- `POST /api/v1/crm/leads/convert/:id` - Convert lead to contact

#### CSV Import (Added 2025-11-18)
- `POST /api/v1/crm/leads/import-csv` - Import leads from CSV with automatic list creation
- `GET /api/v1/crm/leads/import-stream/:importId` - Stream import progress via SSE

**CSV Import Features:**
- Automatic list creation with `import-YYYY-MM-DD-UUID` naming
- Column mapping with `firstName+lastName` split support
- Custom field mapping for non-standard columns
- Idempotent imports (email-based deduplication per workspace)
- Real-time progress streaming via SSE
- `custom_fields_source='import'` tracking to distinguish from API enrichment

**Request Body (Import CSV):**
```json
{
  "csvContent": "firstName,lastName,email,company\nJohn,Doe,john@example.com,Acme Inc",
  "mapping": {
    "firstName": "firstName",
    "lastName": "lastName",
    "email": "email",
    "company": "companyName"
  },
  "customFieldMappings": {
    "industry": "industry",
    "director": "directorName"
  },
  "mergeStrategy": "skip",
  "workspaceId": "uuid",
  "userId": "uuid",
  "filename": "leads.csv"
}
```

**SSE Import Progress Events:**
```json
{"type": "progress", "processed": 5, "total": 10, "success": 5, "failed": 0}
{"type": "complete", "total": 10, "success": 9, "failed": 1, "listId": "uuid", "listName": "import-2025-11-18-abc123"}
{"type": "error", "message": "Import failed: invalid CSV"}
```

#### Contact Lists
- `GET /api/v1/crm/lists?workspaceId=<uuid>` - List contact lists
- `GET /api/v1/crm/lists/:id?workspaceId=<uuid>` - Get list details with members
- `POST /api/v1/crm/lists` - Create contact list
- `POST /api/v1/crm/lists/:id/contacts?workspaceId=<uuid>` - Add contacts to list
- `DELETE /api/v1/crm/lists/:id` - Delete contact list

**List Member Response:**
```json
{
  "id": "uuid",
  "listId": "uuid",
  "entityType": "lead",
  "entityId": "uuid",
  "addedAt": "2025-11-18T10:00:00Z",
  "source": "import",
  "entity": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "companyName": "Acme Inc",
    "customFields": {"industry": "Technology"},
    "customFieldsSource": "import"
  }
}
```

#### Enrichment Jobs
- `GET /api/v1/crm/enrichment/jobs?workspaceId=<uuid>` - List enrichment jobs
- `POST /api/v1/crm/enrichment/jobs` - Create enrichment job
- `POST /api/v1/crm/enrichment/jobs/:id/execute-sample` - Execute sample mode (test 1 contact)
- `POST /api/v1/crm/enrichment/jobs/:id/execute` - Execute full enrichment
- `GET /api/v1/crm/enrichment/jobs/:id/results` - Get enrichment results

**Request Body (Create Job):**
```json
{
  "workspaceId": "uuid",
  "sourceListId": "uuid",
  "scoringModelId": "uuid",
  "temperature": 0.7,
  "budgetLimit": 10.00,
  "userId": "uuid"
}
```

#### Scoring Models & Templates
- `GET /api/v1/crm/enrichment/scoring-models?workspaceId=<uuid>` - List scoring models
- `POST /api/v1/crm/enrichment/scoring-models` - Create custom scoring model
- `GET /api/v1/crm/enrichment/templates` - List global templates (6 professional templates)

**Available Templates (Sprint 6):**
1. **B2B Lead Quality Score** - Score leads 0-100 for B2B sales readiness
2. **Buying Intent Classifier** - Classify intent: hot/warm/cold/unqualified
3. **BANT Qualification** - Assess Budget, Authority, Need, Timeline
4. **Ideal Customer Profile Match** - Score ICP fit 0-100
5. **Company Information Enrichment** - Enrich with industry, size, tech stack
6. **Decision Maker Identification** - Identify decision makers and influencers

#### Analytics
- `GET /api/v1/crm/enrichment/analytics?workspaceId=<uuid>` - Get enrichment analytics

**Analytics Response:**
```json
{
  "totalJobs": 83,
  "completedJobs": 78,
  "totalContacts": 156,
  "totalCost": 1.15,
  "averageCostPerContact": 0.0074,
  "successRate": 0.94
}
```

**Configuration:**
- Template workspace_id is **nullable** for global templates
- Jobs require valid `sourceListId` (foreign key to contact_lists)
- Sample mode processes 1 contact for testing before full execution
- Cost tracking via `actualCost` field (measured in dollars)

**Multi-Tenancy:**
- Global templates: `workspace_id IS NULL AND is_template = true`
- Workspace-specific models: `workspace_id = <uuid>`
- Query logic: `OR (workspace_id IS NULL AND is_template = true)`

## Development

```bash
# Development with hot reload
bun run dev

# Type check
bun run typecheck

# Build for production
bun run build

# Run production build
bun run start
```

## Environment Variables

See root `.env` file for all environment variables.

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Secret for authentication (min 32 chars)
- `WEB_URL` - Web app URL for device flow redirect (default: http://localhost:5173)

Optional:
- `PORT` - API port (default: 3000)
- `NODE_ENV` - Environment (development|production)

## Module Pattern

Each module follows the vertical slice architecture:

```typescript
// modules/example/index.ts
export const exampleModule = new Elysia({ prefix: '/example' })
  .use(exampleRoutes);

// modules/example/routes.ts
export const exampleRoutes = new Elysia()
  .get('/', handler)
  .post('/', handler);

// modules/example/service.ts
export const exampleService = {
  async operation(db, data) {
    // Business logic
  }
};
```

## Adding a New Module

1. Create module directory: `src/modules/my-module/`
2. Create `index.ts`, `routes.ts`, `service.ts`
3. Export module from `index.ts`
4. Register in `src/index.ts`

Example:
```typescript
// src/modules/my-module/index.ts
import { Elysia } from 'elysia';
import { myModuleRoutes } from './routes';

export const myModule = new Elysia({ prefix: '/my-module' })
  .use(myModuleRoutes);

// src/index.ts
import { myModule } from './modules/my-module';

app.group('/api/v1', (app) =>
  app
    .use(workspacesModule)
    .use(myModule) // Add here
);
```

## Authentication System

### Session-Based Auth

The API uses custom session-based authentication with HTTP-only cookies:

```typescript
// Sign in
POST /auth/sign-in/email
Body: { email, password }
Response:
  Set-Cookie: session=<token>; HttpOnly; SameSite=Lax
  Body: { user: {...}, session: {...} }

// Authenticated requests
GET /auth/session
Cookie: session=<token>
Response: { user: {...}, session: {...} }
```

### Device Flow for CLI

OAuth 2.0 Device Authorization Grant for CLI authentication:

1. **Init**: `POST /auth/device/init` → Returns 6-character user code
2. **User confirms**: Web app calls `POST /auth/device/confirm`
3. **Poll**: CLI polls `POST /auth/device/poll` until confirmed
4. **Complete**: Returns access token, CLI saves to `.agent/config.json`

See [CLI README](../cli/README.md) for complete flow diagram.

### Password Security

- Uses **bcryptjs** (pure JS, Bun-compatible)
- Password hashing with salt rounds: 10
- Session tokens are cryptographically random (32 bytes)
- Tokens expire after 30 days

## SDK Distribution

The API serves the pre-built hooks SDK tarball:

```bash
# Download tarball
curl http://localhost:3000/download/hooks-sdk.tgz -o hooks-sdk.tgz

# Extract
tar -xzf hooks-sdk.tgz -C node_modules/@agios/

# Check version
curl http://localhost:3000/download/hooks-sdk/version
```

The SDK is bundled during development:
```bash
cd ../../packages/hooks-sdk
bun run build  # Creates dist/hooks-sdk.tgz
```

## ElectricSQL Real-time Streaming

The API uses **ElectricSQL** as a PostgreSQL logical replication multiplexer for real-time streaming to CLI watchers.

### Architecture

```
PostgreSQL (wal_level=logical)
  → Electric (1 connection via logical replication)
  → API (ElectricShapeStream wrapper)
  → SSE to N CLI watchers
```

**Key Benefits:**
- **Connection Efficiency**: 1 PostgreSQL connection serves unlimited concurrent watchers
- **Low Latency**: 4-18ms streaming overhead (negligible)
- **offset=now**: Skip historical data, stream only new changes
- **Auto-reconnection**: Built-in exponential backoff

### Implementation Files

**Core Electric Client** (`src/lib/electric-client.ts`):
```typescript
class ElectricShapeStream {
  constructor({
    electricUrl: 'http://localhost:3001',
    table: 'claude_sessions',
    where: "project_id='abc123'",     // SQL WHERE clause
    subscriptionTimestamp: new Date() // Client-side filter
  })

  async *stream(): AsyncGenerator<string> {
    // Yields SSE-formatted strings: "data: {JSON}\n\n"
  }
}
```

**Helper Functions** (`src/lib/electric-shapes.ts`):
```typescript
streamSessions(projectId: string): ElectricShapeStream
streamTodos(projectId: string): ElectricShapeStream
streamSummaries(projectId: string, sessionId?: string): ElectricShapeStream
streamChatMessages(projectId: string, sessionId?: string): ElectricShapeStream
streamHookEvents(projectId: string, sessionId?: string): ElectricShapeStream
```

### SSE Route Pattern

All streaming routes follow the same pattern:

```typescript
// Example: sessions/routes.ts
.get('/stream', async function* ({ query, set }) => {
  set.headers['content-type'] = 'text/event-stream';
  set.headers['cache-control'] = 'no-cache';
  set.headers['connection'] = 'keep-alive';

  const projectId = query.projectId as string;
  const subscriptionTimestamp = new Date();

  // Create Electric shape stream
  const electric = streamSessions(projectId, subscriptionTimestamp);

  // Stream changes as SSE
  for await (const sseMessage of electric.stream()) {
    yield sseMessage; // Already formatted as "data: {JSON}\n\n"
  }
})
```

### Electric Features Used

1. **offset=now**: Skip historical data
   ```typescript
   private currentOffset: string = 'now'; // Start fresh!
   ```

2. **WHERE clause filtering**: PostgreSQL-level filtering
   ```typescript
   where: `project_id='${projectId}' AND session_id='${sessionId}'`
   ```

3. **Auto-reconnection**: Exponential backoff (1s, 2s, 4s, 8s, ...)
   ```typescript
   while (reconnectAttempts < 10) {
     try {
       yield* streamInternal();
       reconnectAttempts = 0;
     } catch (error) {
       await sleep(Math.min(1000 * 2^attempts, 30000));
     }
   }
   ```

4. **camelCase conversion**: Database snake_case → API camelCase
   ```typescript
   // Converts: project_id → projectId, created_at → createdAt
   ```

5. **Table Immutability Patterns**: Different tables have different update patterns
   ```typescript
   // Immutable tables (INSERT-only): hook_events, event_summaries, chat_messages
   // Mutable tables (receive UPDATEs): claude_sessions (for todos/metadata)
   // Electric only sends changed fields in UPDATE operations (partial objects)
   // Immutable tables never receive UPDATEs, so all events are complete
   ```

### Performance

From production measurements:
- **Electric streaming latency**: 4-18ms
- **Total end-to-end latency**: Dominated by LLM calls (1500ms), not infrastructure
- **Connection efficiency**: 1 PostgreSQL connection → unlimited CLI watchers

See [ELECTRICSQL_INTEGRATION.md](../../docs/ELECTRICSQL_INTEGRATION.md) for comprehensive implementation guide and performance analysis.

## Related Documentation

- [ElectricSQL Integration](../../docs/ELECTRICSQL_INTEGRATION.md) - Comprehensive Electric implementation guide
- [Architecture Documentation](../../temp/ARCHITECTURE.md)
- [CLI Documentation](../cli/README.md)
- [Hooks SDK Documentation](../../packages/hooks-sdk/README.md)
- [SSR Auth Best Practices](../../.agent/SSR-AUTH-BEST-PRACTICES.md)

## License

Proprietary - Part of the Agios project
