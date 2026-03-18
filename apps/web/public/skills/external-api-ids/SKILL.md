---
name: external-api-ids
title: UUID vs External ID Pattern for API Integration
category: backend
trigger: "external API" OR "third party integration" OR "API IDs"
severity: medium
reusability: high
created: 2025-10-30
---

# UUID vs External ID Pattern for API Integration

## When to Use

Use this pattern when integrating external APIs that have their own ID systems.

**Common scenarios**:
- Payment processors (Stripe, PayPal)
- Communication services (Twilio, SendGrid)
- AI/ML APIs (OpenAI, ElevenLabs, Anthropic)
- SaaS integrations (Salesforce, HubSpot)
- Any third-party API with its own entity identifiers

## The Problem

External APIs have their own ID formats and conventions. Using your internal UUIDs in API calls causes failures because the external system doesn't recognize your IDs.

**What goes wrong**:
```typescript
// Your database
{ id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'GPT-4' }

// API call with internal ID
await openai.chat({ model: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
// ❌ Error: Invalid model ID

// The API expects
await openai.chat({ model: 'gpt-4' })
// ✅ Works!
```

## The Solution

**Maintain TWO IDs: internal UUID for database relationships, external ID for API calls.**

### Database Schema

```typescript
// Drizzle ORM schema
export const models = pgTable('models', {
  id: uuid('id').primaryKey().defaultRandom(),           // Internal UUID
  externalId: varchar('external_id', { length: 255 })    // External API ID
    .notNull()
    .unique(),
  name: varchar('name', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Example data
// id: '3fa85f64-5717-4562-b3fc-2c963f66afa6'
// externalId: 'gpt-4-turbo'
// name: 'GPT-4 Turbo'
// provider: 'openai'
```

### Usage Pattern

```typescript
// ❌ WRONG - Using internal UUID for API call
async function generateText(modelId: string) {
  const model = await db.select().from(models).where(eq(models.id, modelId));

  // This will fail!
  const response = await openai.chat({
    model: model.id,  // ❌ UUID like '3fa85f64-...'
    messages: [...]
  });
}

// ✅ CORRECT - Using external ID for API call
async function generateText(modelId: string) {
  const model = await db.select().from(models).where(eq(models.id, modelId));

  // This works!
  const response = await openai.chat({
    model: model.externalId,  // ✅ 'gpt-4-turbo'
    messages: [...]
  });

  // Use internal ID for database relations
  await db.insert(generations).values({
    modelId: model.id,  // ✅ UUID for foreign key
    prompt: '...',
    response: response.text,
  });
}
```

## Complete Example: ElevenLabs TTS

See [EXAMPLES.md](./EXAMPLES.md) for detailed examples including:
- Database schema
- Syncing models from API
- Generate audio function

## Naming Conventions

**Clear, consistent naming prevents confusion:**

### ✅ Recommended Names

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `id` | UUID | Internal database primary key | `3fa85f64-...` |
| `externalId` | String | External API identifier | `gpt-4-turbo` |

### ❌ Names to Avoid

| Field | Why Avoid | Use Instead |
|-------|-----------|-------------|
| `apiId` | Ambiguous - could be your API's ID | `externalId` |
| `modelId` | Confusing - is it internal or external? | `id` or `externalId` |
| `stripeId`, `openaiId` | Couples to specific provider | `externalId` |

## Common Patterns by Provider

See [PROVIDER-PATTERNS.md](./PROVIDER-PATTERNS.md) for:
- Stripe ID formats
- OpenAI ID formats
- ElevenLabs ID formats
- Twilio ID formats

## Querying Best Practices

```typescript
// ✅ Query by internal ID for app logic
const model = await db
  .select()
  .from(models)
  .where(eq(models.id, userId));

// ✅ Query by external ID when syncing from API
const model = await db
  .select()
  .from(models)
  .where(eq(models.externalId, 'gpt-4-turbo'));

// ✅ Join using internal IDs
const results = await db
  .select()
  .from(generations)
  .innerJoin(models, eq(generations.modelId, models.id));
```

## Testing

```typescript
import { expect, test } from 'bun:test';

test('uses external ID for API calls, internal ID for DB', async () => {
  // Seed test data
  const [model] = await db
    .insert(models)
    .values({
      externalId: 'test-model-v1',
      name: 'Test Model',
      provider: 'test-provider',
    })
    .returning();

  // Mock API client
  const mockAPI = {
    generate: jest.fn().mockResolvedValue({ text: 'response' }),
  };

  // Generate content
  await generateContent(model.id, mockAPI);

  // Verify API called with external ID
  expect(mockAPI.generate).toHaveBeenCalledWith({
    model: 'test-model-v1',  // ✅ External ID
    prompt: expect.any(String),
  });

  // Verify DB uses internal ID
  const [generation] = await db
    .select()
    .from(generations)
    .where(eq(generations.modelId, model.id));

  expect(generation.modelId).toBe(model.id);  // ✅ UUID
});
```

## Migration Strategy

If you have existing code using only internal IDs, see [MIGRATION.md](./MIGRATION.md).

## Error Handling

```typescript
async function generateWithModel(modelId: string) {
  const [model] = await db
    .select()
    .from(models)
    .where(eq(models.id, modelId));

  if (!model) {
    throw new Error(`Model not found: ${modelId}`);
  }

  if (!model.externalId) {
    throw new Error(`Model missing external ID: ${modelId}`);
  }

  try {
    return await api.generate({ model: model.externalId });
  } catch (error) {
    // Log both IDs for debugging
    console.error('API call failed', {
      internalId: model.id,
      externalId: model.externalId,
      error: error.message,
    });
    throw error;
  }
}
```

## References

- Source: Enhanced Audio Management feature (2025-10-30)
- Found by: Backend-Dev during audio worker implementation
- Bug: Worker tried to pass internal UUID to ElevenLabs API
- Fix: Added `externalId` field, used it for API calls

## Checklist

When integrating external APIs:

- [ ] Add `externalId` field to schema
- [ ] Make `externalId` unique and not null
- [ ] Use `externalId` for all API calls
- [ ] Use `id` (UUID) for all database foreign keys
- [ ] Implement sync function to fetch and update external IDs
- [ ] Handle case where external ID might change
- [ ] Log both IDs in error messages for debugging
- [ ] Test API calls use correct ID format
- [ ] Test database relations use UUIDs

---

**Golden Rule**: Internal UUIDs for database, External IDs for APIs. Never confuse the two.
