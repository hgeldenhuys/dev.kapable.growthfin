# @signaldb-live/client

Official JavaScript/TypeScript SDK for [SignalDB](https://signaldb.live) - realtime database as a service.

## Installation

```bash
# npm
npm install @signaldb-live/client

# yarn
yarn add @signaldb-live/client

# bun
bun add @signaldb-live/client
```

## Quick Start

```typescript
import { SignalDBClient } from '@signaldb-live/client';

const db = new SignalDBClient({
  apiKey: 'sk_live_your_api_key',
});

// Query data
const users = await db.from('users').select();

// Insert data
const newUser = await db.from('users').insert({
  name: 'John Doe',
  email: 'john@example.com',
});

// Update data
const updatedUser = await db.from('users').update(newUser.id, {
  name: 'John Smith',
});

// Delete data
await db.from('users').delete(newUser.id);
```

## Filtering & Querying

```typescript
// Simple equality filter
const activeUsers = await db
  .from('users')
  .where('status', 'active')
  .select();

// Using operators
const highValueDeals = await db
  .from('deals')
  .where('value', 'gt', 10000)
  .where('status', 'in', ['won', 'pending'])
  .orderBy('value', 'desc')
  .limit(10)
  .select();

// Available operators: eq, ne, gt, gte, lt, lte, in, contains, starts, isnull
```

## Pagination

```typescript
// Get paginated results with total count
const { data, total, limit, offset } = await db
  .from('users')
  .limit(20)
  .offset(40)
  .selectWithCount();

console.log(`Showing ${data.length} of ${total} users`);
```

## Realtime Subscriptions

### Using SSE (Table method)

```typescript
// Subscribe to all changes on a table
const unsubscribe = db.from('users').subscribe((users) => {
  console.log('Users updated:', users);
});

// Subscribe with filter
const unsubscribe = db.from('users').subscribe(
  (users) => {
    console.log('Active users:', users);
  },
  { filter: { status: 'active' } }
);

// Listen for specific events
const unsubscribe = db.from('users').on('insert', (user) => {
  console.log('New user created:', user);
});

// Unsubscribe when done
unsubscribe();
```

### Using WebSocket (Multiplexed)

For multiple subscriptions, use the `RealtimeClient` for better performance:

```typescript
import { RealtimeClient } from '@signaldb-live/client';

const realtime = new RealtimeClient({
  apiKey: 'sk_live_your_api_key',
});

// Connect
await realtime.connect();

// Subscribe to multiple tables
const unsubUsers = realtime.subscribe(
  { table: 'users' },
  (event) => console.log('User event:', event)
);

const unsubOrders = realtime.subscribe(
  { table: 'orders', filter: { status: 'pending' } },
  (event) => console.log('Order event:', event)
);

// Listen for connection state changes
realtime.onStateChange((state) => {
  console.log('Connection state:', state); // 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
});

// Disconnect when done
realtime.disconnect();
```

## Scoped Tokens (End-User RLS)

Create tokens with custom scopes for row-level security:

```typescript
// Server-side: Create a scoped token for an end-user
const { token, expires_at } = await db.createToken({
  sub: 'user-123',
  scopes: {
    team_id: 'sales',
    roles: ['member', 'viewer'],
  },
  expires_in: 86400, // 24 hours
});

// Client-side: Use the token
const clientDb = new SignalDBClient({
  apiKey: token, // Use the JWT token
});

// Queries are automatically filtered by RLS policies
const myData = await clientDb.from('deals').select();
```

## Schema Management

```typescript
// List all tables
const tables = await db.listTables();

// Get table schema
const schema = await db.getTable('users');

// Create a typed table
await db.createTable('orders', {
  schema: {
    fields: [
      { name: 'customer_name', type: 'text', required: true },
      { name: 'amount', type: 'number', default: 0 },
      { name: 'status', type: 'select', options: ['pending', 'shipped', 'delivered'] },
      { name: 'created_at', type: 'date' },
    ],
  },
  settings: {
    storage_mode: 'typed', // 'jsonb' or 'typed'
  },
});

// Delete a table
await db.deleteTable('old_table');
```

## Webhooks

```typescript
// Create a webhook
const webhook = await db.createWebhook({
  url: 'https://your-server.com/webhooks/signaldb',
  events: ['insert', 'update', 'delete'],
  tables: ['orders', 'users'], // optional: null = all tables
  headers: {
    'X-Custom-Header': 'value',
  },
});

console.log('Webhook secret:', webhook.secret); // Store this securely!

// Test webhook delivery
const result = await db.testWebhook(webhook.id);

// Get delivery logs
const logs = await db.getWebhookLogs(webhook.id);

// Rotate secret
const updated = await db.rotateWebhookSecret(webhook.id);
```

### Verifying Webhook Signatures

```typescript
import { verifyWebhookSignature } from '@signaldb-live/client';

// In your webhook handler
async function handleWebhook(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get('X-Webhook-Signature') || '';

  const isValid = await verifyWebhookSignature(
    payload,
    signature,
    'whsec_your_webhook_secret'
  );

  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(payload);
  // Handle the event...
}
```

## Token Utilities

```typescript
import {
  parseToken,
  isTokenExpired,
  getTokenTimeRemaining,
  getTokenUserId,
  getTokenScopes,
} from '@signaldb-live/client';

// Parse token claims (without verification)
const { payload } = parseToken(token);

// Check if expired
if (isTokenExpired(token)) {
  // Refresh the token
}

// Get remaining time
const secondsLeft = getTokenTimeRemaining(token);

// Get user info
const userId = getTokenUserId(token);
const scopes = getTokenScopes(token);
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

// Type-safe queries
const users = await db.from<User>('users').select();
// users is User[]

const user = await db.from<User>('users').get('user-id');
// user is User | null
```

## Error Handling

```typescript
import { SignalDBError } from '@signaldb-live/client';

try {
  await db.from('users').insert({ name: 'Test' });
} catch (error) {
  if (error instanceof SignalDBError) {
    console.error(`API Error ${error.status}: ${error.message}`);
  } else {
    throw error;
  }
}
```

## Configuration Options

```typescript
const db = new SignalDBClient({
  // Required
  apiKey: 'sk_live_xxx',

  // Optional
  baseUrl: 'https://api.signaldb.live', // Custom API URL
  timeout: 30000, // Request timeout in ms
  fetch: customFetch, // Custom fetch implementation
});
```

## License

MIT
