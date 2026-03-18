---
name: Writing Tests with Environment Configuration
description: Protocol for writing reliable tests in Agios project. ALWAYS checks .env first before writing tests, uses hard assertions to prevent false positives, and tests HTTP API contracts to catch response format bugs. Use when creating unit tests, integration tests, API tests, or E2E tests. Use when debugging test failures or when tests pass but bugs exist in production.
---

# Writing Tests with Environment Configuration

Write reliable tests that catch real bugs instead of creating false positives. This skill enforces critical lessons learned from production bugs where tests passed but the UI was broken.

## Core Principle

**ALWAYS check `.env` FIRST before writing ANY test.** Environment configuration is the source of truth for database connections, API URLs, workspace IDs, and all external dependencies. Never hardcode values that exist in `.env`.

## Critical Lessons (Must Not Be Lost)

These patterns were discovered from **real production bugs** where:
- E2E tests passed ✅
- UI showed "Recipients (0)" ❌
- API tests failed with database connection errors ❌

**Root causes**:
1. Didn't check `.env` before writing tests
2. Used soft assertions that skipped verification
3. Tested service layer but not HTTP contract

## Protocol for Writing Tests

### Step 1: ALWAYS Read `.env` First

**Before writing a single test, read the `.env` file:**

```bash
# Read the .env file
cat .env

# Look for:
- DATABASE_URL
- API URLs (VITE_API_URL, API_BASE_URL)
- Workspace IDs (TEST_WORKSPACE_ID, default workspace)
- Port numbers (POSTGRES_PORT, etc.)
- Authentication credentials
```

### Step 2: Load Environment in Test File

```typescript
// ✅ CORRECT: Load environment at the top of test file
import { config } from 'dotenv';
config(); // Load .env file

// Extract values
const DATABASE_URL = process.env.DATABASE_URL!;
const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID || 'dev-workspace';

// Verify configuration in beforeAll
beforeAll(() => {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not found in environment. Check .env file.');
  }
  console.log('Test config loaded from .env:');
  console.log('  DATABASE_URL:', DATABASE_URL);
  console.log('  API_URL:', API_URL);
  console.log('  WORKSPACE_ID:', WORKSPACE_ID);
});
```

### Step 3: NEVER Hardcode Configuration

```typescript
// ❌ WRONG: Hardcoded assumptions
const TEST_DB_USER = 'postgres';
const TEST_DB_PASSWORD = 'password';
const API_URL = 'http://localhost:3000';
const WORKSPACE_ID = 'default';

// ❌ WRONG: Inline connection string
const db = drizzle(postgres('postgresql://postgres:password@localhost:5432/test'));

// ✅ CORRECT: Use environment values
const db = drizzle(postgres(process.env.DATABASE_URL!));
const API_URL = process.env.VITE_API_URL!;
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID!;
```

### Step 4: Use Hard Assertions Only

**NEVER use soft assertions** - they create false positives.

```typescript
// ❌ WRONG: Soft assertion pattern
if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
  await expect(element).toBeVisible();
  console.log('✓ verified');
} else {
  console.log('not found, skipping verification'); // ← Test passes when it should fail!
}

// ✅ CORRECT: Hard assertion
await expect(element).toBeVisible({ timeout: 5000 });
console.log('✓ verified');
```

**Why hard assertions matter:**
- Test fails immediately when element missing
- Forces you to fix the actual bug
- Prevents false positives
- Makes test suite reliable

### Step 5: Test HTTP API Contracts

**Don't just test service layer** - test the actual HTTP response format.

```typescript
// ❌ INSUFFICIENT: Only testing service layer
test('service returns recipients', async () => {
  const recipients = await campaignService.getRecipients(db, campaignId);
  expect(Array.isArray(recipients)).toBe(true); // ✅ Passes
});

// ✅ CORRECT: Test HTTP endpoint response format
test('API returns { recipients: [...] } not raw array', async () => {
  const response = await fetch(
    `${API_URL}/crm/campaigns/${campaignId}/recipients?workspaceId=${WORKSPACE_ID}`
  );

  expect(response.status).toBe(200);
  const data = await response.json();

  // CRITICAL: Verify contract structure
  expect(data).toHaveProperty('recipients');
  expect(Array.isArray(data.recipients)).toBe(true);

  // NOT a raw array at top level
  expect(Array.isArray(data)).toBe(false);
});
```

**Real bug this would have caught:**

```typescript
// Backend bug (campaigns.ts:471)
return campaignService.getRecipients(db, params.id); // Returns raw array

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

### Step 6: Verify Counts Explicitly

```typescript
// ❌ INSUFFICIENT: Only checks presence
const recipientsHeading = page.getByRole('heading', { name: /Recipients/ });
await expect(recipientsHeading).toBeVisible();

// ✅ CORRECT: Verify actual data
const recipientsHeading = page.getByRole('heading', { name: /Recipients/ });
await expect(recipientsHeading).toBeVisible({ timeout: 5000 });
await expect(recipientsHeading).toContainText('(2)'); // Explicit count check!

// Also verify table rows
const rows = page.locator('table tbody tr');
await expect(rows).toHaveCount(2);
```

## Supporting Documentation

For detailed patterns, examples, and troubleshooting:

- **[PATTERNS.md](./PATTERNS.md)** - Testing patterns and anti-patterns
- **[EXAMPLES.md](./EXAMPLES.md)** - Real-world test examples and case studies

## Test Organization

```
apps/api/
  src/
    modules/crm/
      routes/
        campaigns.ts              # Implementation
        campaigns.api.test.ts     # HTTP endpoint tests
      services/
        campaigns.ts              # Business logic
        campaigns.test.ts         # Unit tests

test/
  e2e/
    drip-campaign.spec.ts        # E2E tests
  utils/
    api-helpers.ts               # Test utilities
```

## Environment Setup Checklist

Before running tests:

- [ ] `.env` file exists in project root
- [ ] Read `.env` to understand configuration
- [ ] Test file imports and loads `.env` (`config()`)
- [ ] Environment variables verified in `beforeAll`
- [ ] No hardcoded connection strings
- [ ] No hardcoded workspace IDs
- [ ] No hardcoded API URLs
- [ ] Test runner configured to load `.env`

## When to Use This Skill

**Auto-trigger when**:
- Writing new unit tests
- Writing integration tests
- Writing API route tests
- Writing E2E tests
- Debugging test failures
- Tests pass but bugs exist in UI/production
- Getting database connection errors in tests
- Getting "workspace not found" errors
- Any test that needs external configuration

**Specific error patterns**:
- "role postgres does not exist"
- "workspace not found"
- "connection refused"
- Tests pass but UI broken
- "Recipients (0)" despite data existing

## Success Metrics

A well-written test:
- ✅ Loads configuration from `.env`
- ✅ Uses hard assertions only
- ✅ Tests HTTP contracts for API endpoints
- ✅ Verifies counts explicitly
- ✅ Fails when bugs exist
- ✅ Never creates false positives
- ✅ Can be run independently
- ✅ Cleans up after itself

## Quick Reference

### Environment Loading Pattern

```typescript
import { config } from 'dotenv';
config();

const DATABASE_URL = process.env.DATABASE_URL!;
const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID!;

beforeAll(() => {
  if (!DATABASE_URL) throw new Error('Missing DATABASE_URL in .env');
});
```

### Hard Assertion Pattern

```typescript
// Always use hard assertions
await expect(element).toBeVisible({ timeout: 5000 });
await expect(element).toContainText('Expected Text');
await expect(rows).toHaveCount(2);
```

### API Contract Test Pattern

```typescript
test('API returns correct format', async () => {
  const response = await fetch(`${API_URL}/endpoint`);
  const data = await response.json();

  expect(data).toHaveProperty('expectedKey');
  expect(Array.isArray(data.items)).toBe(true);
});
```

## References

- [TESTING-STANDARDS.md](../.claude/TESTING-STANDARDS.md) - Comprehensive testing guide
- [TESTING-IMPROVEMENTS-SUMMARY.md](../../TESTING-IMPROVEMENTS-SUMMARY.md) - Real bug case study
- [.env](../../.env) - Always check this FIRST!

---

**Version**: 1.0
**Created**: 2025-10-23
**Last Updated**: 2025-10-23
**Lesson Source**: Production bug where E2E tests passed but UI was broken
