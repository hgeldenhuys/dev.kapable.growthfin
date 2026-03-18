---
name: cqrs-implementation
description: Implement CQRS pattern with GET for initial state and SSE for delta streaming
when_to_use: When adding new endpoints that need real-time updates
context_size: small
---

# CQRS Implementation Pattern

## When to Use This Skill

Use this skill when you need to:
- Add a new endpoint that shows real-time data
- Convert a polling endpoint to real-time
- Implement live updates for any resource

## The Pattern

### 1. GET Endpoint - Initial State

```typescript
// src/routes/resource.ts
app.get('/api/v1/resources', async (c) => {
  const { where, orderBy, limit } = c.req.query();

  const resources = await db.query.resources.findMany({
    where: parseWhere(where),
    orderBy: parseOrderBy(orderBy),
    limit: parseInt(limit || '100'),
  });

  return c.json(resources);
});
```

### 2. SSE Endpoint - Delta Updates

```typescript
// src/routes/resource.ts
app.get('/api/v1/stream', async (c) => {
  const { table, where } = c.req.query();

  // Set SSE headers
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  // Create stream
  const stream = new ReadableStream({
    async start(controller) {
      // Set up PostgreSQL LISTEN
      const client = await getPostgresClient();
      await client.query(`LISTEN ${table}_changes`);

      // Handle notifications
      client.on('notification', (msg) => {
        const data = JSON.parse(msg.payload);

        // Apply WHERE filter if provided
        if (where && !matchesWhere(data, where)) return;

        // Send delta
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      });

      // Cleanup on close
      c.req.raw.signal.addEventListener('abort', () => {
        client.query(`UNLISTEN ${table}_changes`);
        client.release();
        controller.close();
      });
    }
  });

  return new Response(stream);
});
```

### 3. Database Trigger - Emit Changes

```sql
-- migrations/xxx_add_notify_trigger.sql
CREATE OR REPLACE FUNCTION notify_resource_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'resources_changes',
    json_build_object(
      'operation', TG_OP,
      'new', NEW,
      'old', OLD
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resource_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON resources
FOR EACH ROW EXECUTE FUNCTION notify_resource_changes();
```

### 4. Frontend - Consume CQRS

```typescript
// apps/web/src/hooks/useResources.ts
export function useResources(where?: string) {
  // 1. GET initial state
  const { data: initialData } = useQuery({
    queryKey: ['resources', where],
    queryFn: () => fetch(`/api/v1/resources?where=${where}`).then(r => r.json()),
  });

  // 2. SSE for deltas
  useEffect(() => {
    const eventSource = new EventSource(
      `/api/v1/stream?table=resources&where=${where}`
    );

    eventSource.onmessage = (event) => {
      const delta = JSON.parse(event.data);

      // Update React Query cache
      queryClient.setQueryData(['resources', where], (old) => {
        return applyDelta(old, delta);
      });
    };

    return () => eventSource.close();
  }, [where]);

  return { data: initialData };
}
```

## Complete Example

Here's adding CQRS for a new `notifications` table:

```bash
# 1. Create migration with trigger
cat > migrations/001_notifications_trigger.sql << 'EOF'
CREATE OR REPLACE FUNCTION notify_notifications_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('notifications_changes',
    json_build_object(
      'operation', TG_OP,
      'data', NEW
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notifications_changes
AFTER INSERT OR UPDATE ON notifications
FOR EACH ROW EXECUTE FUNCTION notify_notifications_changes();
EOF

# 2. Run migration
bun run db:migrate

# 3. Add endpoints (see patterns above)
# 4. Add frontend hook (see pattern above)
```

## Key Rules

1. **NEVER poll** - Always use SSE/WebSocket
2. **Database triggers** emit changes via pg_notify
3. **GET for initial**, SSE for updates
4. **One SSE connection** per data stream
5. **Clean up listeners** on disconnect

## Testing

```bash
# Terminal 1: Start SSE listener
curl -N "http://localhost:3000/api/v1/stream?table=notifications"

# Terminal 2: Insert data
psql agios_dev -c "INSERT INTO notifications (message) VALUES ('test');"

# Terminal 1 should show the delta
```

## Common Mistakes to Avoid

❌ **Polling with setInterval**
```typescript
// WRONG
setInterval(() => fetch('/api/notifications'), 5000);
```

❌ **Forgetting to clean up listeners**
```typescript
// WRONG - No cleanup
client.on('notification', handler);
```

❌ **Not setting SSE headers**
```typescript
// WRONG - Missing headers
return c.text(stream);
```

✅ **Correct implementation follows the pattern above**