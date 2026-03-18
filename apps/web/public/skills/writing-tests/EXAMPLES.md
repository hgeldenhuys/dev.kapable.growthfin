# Testing Examples and Case Studies

This document contains real-world examples and case studies from actual production bugs.

## Real Production Bug Example

**Context**: Campaign recipients weren't displaying in UI

**Test status**:
- E2E tests: ✅ PASSED (false positive)
- Service tests: ✅ PASSED (not enough)
- API route tests: ❌ DIDN'T EXIST

**Root cause**:

```typescript
// apps/api/src/modules/crm/routes/campaigns.ts:471
return campaignService.getRecipients(db, params.id); // Returns [...]

// Should have been:
const recipients = await campaignService.getRecipients(db, params.id);
return { recipients }; // Returns { recipients: [...] }
```

**Frontend expected**:

```typescript
// apps/web/app/hooks/useCampaigns.ts
const data = await response.json();
return (data.recipients || []) as CampaignRecipient[];
// Expected { recipients: [...] }, got [...], so data.recipients = undefined
```

**Why tests passed**:
1. E2E test used soft assertion - skipped verification
2. No API route tests - didn't test HTTP contract
3. Service test passed - returned array as expected

**What would have caught it**:

```typescript
// API route test
test('returns { recipients: [...] } not raw array', async () => {
  const response = await fetch(`${API_URL}/campaigns/${id}/recipients`);
  const data = await response.json();

  expect(data).toHaveProperty('recipients'); // Would have failed!
  expect(Array.isArray(data)).toBe(false); // Would have failed!
});

// E2E test with hard assertion
await expect(recipientsHeading).toContainText('(2)'); // Would have failed!
```

## Complete Test Suite Example

### Unit Test Example

```typescript
// apps/api/src/modules/crm/services/campaigns.test.ts
import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as campaignService from './campaigns';

config();

describe('Campaign Service', () => {
  let db: ReturnType<typeof drizzle>;
  const createdIds: string[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not found in .env');
    }
    const client = postgres(process.env.DATABASE_URL);
    db = drizzle(client);

    console.log('✓ Database connection established');
  });

  afterEach(async () => {
    // Clean up test data
    for (const id of createdIds) {
      await campaignService.deleteCampaign(db, id);
    }
    createdIds.length = 0;
  });

  test('creates campaign with valid data', async () => {
    const workspaceId = process.env.TEST_WORKSPACE_ID!;
    const campaign = await campaignService.create(db, {
      workspaceId,
      name: 'Test Campaign',
      objective: 'sales',
      status: 'draft',
    });

    createdIds.push(campaign.id);

    expect(campaign.id).toBeDefined();
    expect(campaign.name).toBe('Test Campaign');
    expect(campaign.objective).toBe('sales');
    expect(campaign.status).toBe('draft');
    expect(campaign.workspaceId).toBe(workspaceId);
  });

  test('throws error when name is missing', async () => {
    await expect(
      campaignService.create(db, {
        workspaceId: process.env.TEST_WORKSPACE_ID!,
        // @ts-expect-error - intentionally missing name
        name: undefined,
        objective: 'sales',
      })
    ).rejects.toThrow();
  });

  test('updates campaign name', async () => {
    const campaign = await campaignService.create(db, {
      workspaceId: process.env.TEST_WORKSPACE_ID!,
      name: 'Original Name',
      objective: 'sales',
    });
    createdIds.push(campaign.id);

    const updated = await campaignService.update(db, campaign.id, {
      name: 'Updated Name',
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.id).toBe(campaign.id);
  });

  test('adds recipients to campaign', async () => {
    const campaign = await campaignService.create(db, {
      workspaceId: process.env.TEST_WORKSPACE_ID!,
      name: 'Campaign with Recipients',
      objective: 'sales',
    });
    createdIds.push(campaign.id);

    await campaignService.addRecipients(db, campaign.id, [
      { email: 'test1@example.com', name: 'Test User 1' },
      { email: 'test2@example.com', name: 'Test User 2' },
    ]);

    const recipients = await campaignService.getRecipients(db, campaign.id);
    expect(recipients).toHaveLength(2);
    expect(recipients[0].email).toBe('test1@example.com');
  });
});
```

### API Route Test Example

```typescript
// apps/api/src/modules/crm/routes/campaigns.api.test.ts
import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { config } from 'dotenv';

config();

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID!;

describe('Campaign API Routes', () => {
  const createdCampaignIds: string[] = [];

  beforeAll(() => {
    console.log('API URL:', API_URL);
    console.log('Workspace ID:', WORKSPACE_ID);
  });

  afterEach(async () => {
    // Clean up created campaigns
    for (const id of createdCampaignIds) {
      await fetch(`${API_URL}/api/v1/crm/campaigns/${id}`, {
        method: 'DELETE',
      });
    }
    createdCampaignIds.length = 0;
  });

  test('POST /campaigns creates campaign', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        name: 'API Test Campaign',
        objective: 'sales',
      }),
    });

    expect(response.status).toBe(201);
    const campaign = await response.json();

    expect(campaign.id).toBeDefined();
    expect(campaign.name).toBe('API Test Campaign');

    createdCampaignIds.push(campaign.id);
  });

  test('GET /campaigns/:id returns campaign', async () => {
    // Create campaign
    const createResponse = await fetch(`${API_URL}/api/v1/crm/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        name: 'Test Campaign',
        objective: 'sales',
      }),
    });
    const created = await createResponse.json();
    createdCampaignIds.push(created.id);

    // Get campaign
    const response = await fetch(
      `${API_URL}/api/v1/crm/campaigns/${created.id}?workspaceId=${WORKSPACE_ID}`
    );

    expect(response.status).toBe(200);
    const campaign = await response.json();

    expect(campaign.id).toBe(created.id);
    expect(campaign.name).toBe('Test Campaign');
  });

  test('GET /campaigns/:id/recipients returns correct format', async () => {
    // Create campaign with recipients
    const createResponse = await fetch(`${API_URL}/api/v1/crm/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        name: 'Campaign with Recipients',
        objective: 'sales',
      }),
    });
    const campaign = await createResponse.json();
    createdCampaignIds.push(campaign.id);

    // Add recipients
    await fetch(`${API_URL}/api/v1/crm/campaigns/${campaign.id}/recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: [
          { email: 'test1@example.com', name: 'Test 1' },
          { email: 'test2@example.com', name: 'Test 2' },
        ],
      }),
    });

    // Get recipients
    const response = await fetch(
      `${API_URL}/api/v1/crm/campaigns/${campaign.id}/recipients?workspaceId=${WORKSPACE_ID}`
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    // CRITICAL: Test contract structure
    expect(data).toHaveProperty('recipients');
    expect(Array.isArray(data.recipients)).toBe(true);
    expect(Array.isArray(data)).toBe(false); // NOT a raw array!
    expect(data.recipients).toHaveLength(2);
  });

  test('returns 404 for non-existent campaign', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/campaigns/non-existent-id?workspaceId=${WORKSPACE_ID}`
    );

    expect(response.status).toBe(404);
  });

  test('returns 400 when name is missing', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        // Missing name
        objective: 'sales',
      }),
    });

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error).toHaveProperty('message');
  });
});
```

### E2E Test Example

```typescript
// test/e2e/drip-campaign.spec.ts
import { test, expect } from '@playwright/test';
import { config } from 'dotenv';

config();

const API_URL = process.env.VITE_API_URL!;
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID!;

test.describe('Drip Campaign Management', () => {
  let campaignId: string;

  test.beforeEach(async ({ page }) => {
    // Create test campaign via API
    const response = await fetch(`${API_URL}/api/v1/crm/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        name: 'E2E Test Campaign',
        objective: 'sales',
      }),
    });
    const campaign = await response.json();
    campaignId = campaign.id;

    // Add test recipients
    await fetch(`${API_URL}/api/v1/crm/campaigns/${campaignId}/recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: [
          { email: 'user1@example.com', name: 'User One' },
          { email: 'user2@example.com', name: 'User Two' },
        ],
      }),
    });
  });

  test.afterEach(async () => {
    // Clean up
    await fetch(`${API_URL}/api/v1/crm/campaigns/${campaignId}`, {
      method: 'DELETE',
    });
  });

  test('displays campaign details correctly', async ({ page }) => {
    await page.goto(`/dashboard/crm/campaigns/${campaignId}`);

    // Hard assertion on heading
    const heading = page.getByRole('heading', { name: 'E2E Test Campaign' });
    await expect(heading).toBeVisible({ timeout: 5000 });

    // Verify campaign details
    await expect(page.getByText('Objective: sales')).toBeVisible();
    await expect(page.getByText('Status: draft')).toBeVisible();
  });

  test('displays recipients with correct count', async ({ page }) => {
    await page.goto(`/dashboard/crm/campaigns/${campaignId}`);

    // Hard assertion - must show "(2)" in heading
    const recipientsHeading = page.getByRole('heading', { name: /Recipients/ });
    await expect(recipientsHeading).toBeVisible({ timeout: 5000 });
    await expect(recipientsHeading).toContainText('(2)');

    // Verify table has exactly 2 rows
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(2);

    // Verify recipient data
    await expect(page.getByText('user1@example.com')).toBeVisible();
    await expect(page.getByText('user2@example.com')).toBeVisible();
  });

  test('allows adding new recipient', async ({ page }) => {
    await page.goto(`/dashboard/crm/campaigns/${campaignId}`);

    // Click add recipient button
    await page.getByRole('button', { name: 'Add Recipient' }).click();

    // Fill form
    await page.getByLabel('Email').fill('newuser@example.com');
    await page.getByLabel('Name').fill('New User');
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify count updated
    const recipientsHeading = page.getByRole('heading', { name: /Recipients/ });
    await expect(recipientsHeading).toContainText('(3)');

    // Verify new recipient appears
    await expect(page.getByText('newuser@example.com')).toBeVisible();
  });

  test('shows empty state when no recipients', async ({ page }) => {
    // Create campaign without recipients
    const response = await fetch(`${API_URL}/api/v1/crm/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        name: 'Empty Campaign',
        objective: 'sales',
      }),
    });
    const emptyCampaign = await response.json();

    await page.goto(`/dashboard/crm/campaigns/${emptyCampaign.id}`);

    // Should show (0) recipients
    const recipientsHeading = page.getByRole('heading', { name: /Recipients/ });
    await expect(recipientsHeading).toContainText('(0)');

    // Should show empty state message
    await expect(page.getByText(/No recipients yet/i)).toBeVisible();

    // Clean up
    await fetch(`${API_URL}/api/v1/crm/campaigns/${emptyCampaign.id}`, {
      method: 'DELETE',
    });
  });
});
```

## Test Helper Examples

### API Test Helpers

```typescript
// test/utils/api-helpers.ts
import { config } from 'dotenv';

config();

const API_URL = process.env.VITE_API_URL!;
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID!;

export const campaignApi = {
  async create(data: Partial<Campaign>) {
    const response = await fetch(`${API_URL}/api/v1/crm/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        ...data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create campaign: ${response.statusText}`);
    }

    return response.json();
  },

  async delete(id: string) {
    const response = await fetch(`${API_URL}/api/v1/crm/campaigns/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete campaign: ${response.statusText}`);
    }
  },

  async addRecipients(campaignId: string, recipients: Recipient[]) {
    const response = await fetch(
      `${API_URL}/api/v1/crm/campaigns/${campaignId}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to add recipients: ${response.statusText}`);
    }

    return response.json();
  },
};

// Usage in tests
test('campaign workflow', async () => {
  const campaign = await campaignApi.create({ name: 'Test' });
  await campaignApi.addRecipients(campaign.id, [
    { email: 'test@example.com', name: 'Test' },
  ]);
  await campaignApi.delete(campaign.id);
});
```

### Database Test Helpers

```typescript
// test/utils/db-helpers.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

config();

export function createTestDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not found in .env');
  }

  const client = postgres(process.env.DATABASE_URL);
  return drizzle(client);
}

export async function cleanupTestData(db: Database, table: string, ids: string[]) {
  for (const id of ids) {
    await db.delete(table).where(eq(table.id, id));
  }
}
```

## Summary

These examples demonstrate:
- ✅ Always loading from `.env`
- ✅ Hard assertions only
- ✅ Testing HTTP contracts
- ✅ Explicit count verification
- ✅ Test independence
- ✅ Proper cleanup
- ✅ Clear test organization
