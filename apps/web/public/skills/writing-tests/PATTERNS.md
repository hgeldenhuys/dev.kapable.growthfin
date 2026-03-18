# Testing Patterns and Anti-Patterns

This document contains common testing patterns, anti-patterns to avoid, and best practices for writing reliable tests.

## Common Pitfalls to Avoid

### 1. Not Checking .env First

```typescript
// ❌ WRONG: Made assumption about workspace ID
const WORKSPACE_ID = 'default';

// Reality in .env:
// TEST_WORKSPACE_ID='dev-workspace'

// Result: All tests fail with "workspace not found"
```

**Solution**: Always read `.env` first, use actual values.

### 2. Soft Assertions

```typescript
// ❌ WRONG: Creates false positive
if (await element.isVisible().catch(() => false)) {
  await expect(element).toContainText('Recipients (2)');
} else {
  console.log('skipping'); // Test passes!
}

// ✅ CORRECT: Fails loudly
await expect(element).toBeVisible({ timeout: 5000 });
await expect(element).toContainText('Recipients (2)');
```

### 3. Testing Implementation Not Behavior

```typescript
// ❌ WRONG: Testing internal state
expect(component.state.loading).toBe(true);

// ✅ CORRECT: Testing user-visible behavior
await expect(page.getByTestId('loading-spinner')).toBeVisible();
```

### 4. Not Testing Error Cases

```typescript
// ✅ Test both success and failure
describe('Campaign API', () => {
  test('creates campaign with valid data', async () => {
    // Happy path
  });

  test('returns 400 when name is missing', async () => {
    const response = await fetch(`${API_URL}/campaigns`, {
      method: 'POST',
      body: JSON.stringify({ workspaceId: WORKSPACE_ID }),
    });

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error).toHaveProperty('message');
  });

  test('returns 404 when campaign not found', async () => {
    // Error path
  });
});
```

### 5. Sharing State Between Tests

```typescript
// ❌ WRONG: Tests depend on each other
let sharedCampaign;

test('create campaign', async () => {
  sharedCampaign = await api.createCampaign();
});

test('update campaign', async () => {
  await api.updateCampaign(sharedCampaign.id); // Breaks if first fails
});

// ✅ CORRECT: Each test is independent
test('update campaign', async () => {
  const campaign = await api.createCampaign();
  await api.updateCampaign(campaign.id);
  await api.deleteCampaign(campaign.id);
});
```

## Test Types and Patterns

### Unit Tests Pattern

```typescript
// apps/api/src/modules/crm/services/campaigns.test.ts
import { config } from 'dotenv';
config();

describe('Campaign Service', () => {
  let db: Database;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not found in .env');
    }
    db = drizzle(postgres(process.env.DATABASE_URL));
  });

  test('creates campaign with valid data', async () => {
    const campaign = await campaignService.create(db, {
      workspaceId: process.env.TEST_WORKSPACE_ID!,
      name: 'Test Campaign',
      objective: 'sales',
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.name).toBe('Test Campaign');
  });
});
```

### API Route Tests Pattern

```typescript
// apps/api/src/modules/crm/routes/campaigns.api.test.ts
import { config } from 'dotenv';
config();

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID!;

describe('Campaign API Routes', () => {
  test('GET /recipients returns correct format', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/campaigns/${campaignId}/recipients?workspaceId=${WORKSPACE_ID}`
    );

    const data = await response.json();

    // Test the contract
    expect(data).toHaveProperty('recipients');
    expect(Array.isArray(data.recipients)).toBe(true);
    expect(Array.isArray(data)).toBe(false);
  });

  test('returns empty array wrapped in object when no data', async () => {
    const response = await fetch(`${API_URL}/campaigns/${emptyId}/recipients`);
    const data = await response.json();

    // Must still return { recipients: [] } not []
    expect(data).toHaveProperty('recipients');
    expect(data.recipients).toHaveLength(0);
  });
});
```

### E2E Tests Pattern

```typescript
// test/e2e/drip-campaign.spec.ts
import { test, expect } from '@playwright/test';

test('campaign displays recipients', async ({ page }) => {
  // Setup via API (using .env values)
  const campaign = await api.createCampaign({
    workspaceId: process.env.TEST_WORKSPACE_ID!,
    name: 'E2E Test Campaign',
  });

  // Navigate
  await page.goto(`/dashboard/crm/campaigns/${campaign.id}`);

  // Hard assertions with explicit counts
  const recipientsHeading = page.getByRole('heading', { name: /Recipients/ });
  await expect(recipientsHeading).toBeVisible({ timeout: 5000 });
  await expect(recipientsHeading).toContainText('(2)');

  // Verify table data
  const rows = page.locator('table tbody tr');
  await expect(rows).toHaveCount(2);

  // Cleanup
  await api.deleteCampaign(campaign.id);
});
```

## Best Practices

### 1. Test Independence

Each test should be completely independent:
- Create its own test data
- Clean up after itself
- Not rely on execution order

### 2. Clear Test Names

```typescript
// ❌ BAD: Vague
test('it works', async () => {});

// ✅ GOOD: Descriptive
test('returns 400 when campaign name is missing', async () => {});
```

### 3. Arrange-Act-Assert Pattern

```typescript
test('creates campaign successfully', async () => {
  // Arrange
  const campaignData = {
    workspaceId: WORKSPACE_ID,
    name: 'Test Campaign',
    objective: 'sales',
  };

  // Act
  const response = await fetch(`${API_URL}/campaigns`, {
    method: 'POST',
    body: JSON.stringify(campaignData),
  });
  const campaign = await response.json();

  // Assert
  expect(response.status).toBe(201);
  expect(campaign.name).toBe('Test Campaign');
  expect(campaign.id).toBeDefined();
});
```

### 4. Test Cleanup

```typescript
describe('Campaign Tests', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    // Clean up all created campaigns
    for (const id of createdIds) {
      await api.deleteCampaign(id);
    }
    createdIds.length = 0;
  });

  test('creates campaign', async () => {
    const campaign = await api.createCampaign({ name: 'Test' });
    createdIds.push(campaign.id);
    // Test assertions...
  });
});
```

### 5. Environment Validation

```typescript
// Validate all required environment variables upfront
beforeAll(() => {
  const required = ['DATABASE_URL', 'TEST_WORKSPACE_ID', 'VITE_API_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
});
```

## Anti-Patterns to Avoid

### 1. Timeout Manipulation

```typescript
// ❌ BAD: Hiding issues with long timeouts
await expect(element).toBeVisible({ timeout: 60000 });

// ✅ GOOD: Reasonable timeout, fix the actual issue
await expect(element).toBeVisible({ timeout: 5000 });
```

### 2. Ignoring Errors

```typescript
// ❌ BAD: Swallowing errors
try {
  await api.createCampaign(data);
} catch (e) {
  // Ignore
}

// ✅ GOOD: Assert on errors
await expect(api.createCampaign(invalidData)).rejects.toThrow();
```

### 3. Magic Numbers

```typescript
// ❌ BAD: Unclear what 2 means
await expect(rows).toHaveCount(2);

// ✅ GOOD: Use descriptive constants
const EXPECTED_RECIPIENT_COUNT = 2;
await expect(rows).toHaveCount(EXPECTED_RECIPIENT_COUNT);
```

### 4. Testing Multiple Things

```typescript
// ❌ BAD: One test for everything
test('campaign system works', async () => {
  // Test creation
  // Test update
  // Test deletion
  // Test recipients
  // Test activation
  // ... 100 more lines
});

// ✅ GOOD: One test per behavior
test('creates campaign with valid data', async () => {});
test('updates campaign name', async () => {});
test('deletes campaign', async () => {});
test('adds recipients to campaign', async () => {});
test('activates campaign', async () => {});
```

### 5. Copy-Paste Tests

```typescript
// ❌ BAD: Duplicated test code
test('creates campaign A', async () => {
  const campaign = await api.createCampaign({ name: 'A' });
  expect(campaign.id).toBeDefined();
  // ... 20 lines of assertions
});

test('creates campaign B', async () => {
  const campaign = await api.createCampaign({ name: 'B' });
  expect(campaign.id).toBeDefined();
  // ... same 20 lines of assertions
});

// ✅ GOOD: Extract helper function
async function assertValidCampaign(campaign: Campaign) {
  expect(campaign.id).toBeDefined();
  // ... 20 lines of assertions
}

test('creates campaign A', async () => {
  const campaign = await api.createCampaign({ name: 'A' });
  await assertValidCampaign(campaign);
});

test('creates campaign B', async () => {
  const campaign = await api.createCampaign({ name: 'B' });
  await assertValidCampaign(campaign);
});
```

## Performance Patterns

### 1. Parallel Test Execution

```typescript
// Use describe.concurrent for independent tests
describe.concurrent('Campaign API', () => {
  test('creates campaign A', async () => {});
  test('creates campaign B', async () => {});
  test('creates campaign C', async () => {});
});
```

### 2. Shared Setup (When Appropriate)

```typescript
// Share setup ONLY for read-only operations
describe('Campaign Display', () => {
  let testCampaign: Campaign;

  beforeAll(async () => {
    // Create once for all read-only tests
    testCampaign = await api.createCampaign({ name: 'Test' });
  });

  afterAll(async () => {
    await api.deleteCampaign(testCampaign.id);
  });

  test('displays campaign name', async () => {
    // Read-only test
  });

  test('displays campaign objective', async () => {
    // Read-only test
  });
});
```

### 3. Database Transactions (Unit Tests)

```typescript
// Use transactions for unit test isolation
describe('Campaign Service', () => {
  let tx: Transaction;

  beforeEach(async () => {
    tx = await db.transaction();
  });

  afterEach(async () => {
    await tx.rollback();
  });

  test('creates campaign', async () => {
    const campaign = await campaignService.create(tx, data);
    // Changes rolled back after test
  });
});
```
