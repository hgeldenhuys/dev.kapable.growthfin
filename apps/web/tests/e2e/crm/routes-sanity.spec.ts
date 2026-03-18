/**
 * CRM Routes Sanity Test Suite
 *
 * Tests that all CRM routes load without errors.
 * This is a smoke test to catch routing/rendering issues early.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration - use a real workspace ID from the test user
const TEST_WORKSPACE_ID = '713dc1ca-74de-46ac-8a45-a01b2ff23230';
const BASE_CRM_PATH = `/dashboard/${TEST_WORKSPACE_ID}/crm`;

// Test user credentials
const TEST_USER = {
  email: 'test@agios.dev',
  password: 'testpassword123',
};

/**
 * Helper to login
 */
async function login(page: Page) {
  await page.goto('/auth/sign-in');
  await page.fill('input[name="email"]', TEST_USER.email);
  await page.fill('input[name="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

/**
 * Helper to check if a route loads without critical errors
 */
async function assertRouteLoads(page: Page, path: string, options?: {
  expectRedirect?: boolean;
  expectedStatus?: number;
}) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

  // Check response status
  const status = response?.status() ?? 0;
  if (options?.expectedStatus) {
    expect(status).toBe(options.expectedStatus);
  } else if (!options?.expectRedirect) {
    expect(status).toBeLessThan(400);
  }

  // Check for React error boundaries or crash screens
  const errorBoundary = await page.locator('[data-testid="error-boundary"]').count();
  expect(errorBoundary).toBe(0);

  // Check for common error indicators
  const pageContent = await page.content();
  expect(pageContent).not.toContain('Application error');
  expect(pageContent).not.toContain('Unhandled Runtime Error');
  expect(pageContent).not.toContain('Internal Server Error');
}

// Shared context for all tests
let sharedContext: BrowserContext;
let sharedPage: Page;

test.describe('CRM Routes Sanity Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    // Create a shared context and login once
    sharedContext = await browser.newContext();
    sharedPage = await sharedContext.newPage();
    await login(sharedPage);
  });

  test.afterAll(async () => {
    await sharedContext?.close();
  });

  // Use the shared page for all tests
  test.beforeEach(async () => {
    // Tests will use sharedPage
  });

  test.describe('CRM Index', () => {
    test('CRM dashboard loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}`);
    });
  });

  test.describe('Contacts Module', () => {
    test('contacts list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/contacts`);
    });

    test('new contact form loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/contacts/new`);
    });

    test('contact import page loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/contacts/import`);
    });
  });

  test.describe('Leads Module', () => {
    test('leads list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/leads`);
    });

    test('new lead form loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/leads/new`);
    });

    test('lead import page loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/leads/import`);
    });

    test('lead segments list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/leads/segments`);
    });

    test('new segment form loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/leads/segments/new`);
    });

    test('lead lists page loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/leads/lists`);
    });

    test('my queue page loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/leads/my-queue`);
    });

    test('bulk operations page loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/leads/bulk`);
    });

    test('data quality page loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/leads/data-quality`);
    });
  });

  test.describe('Accounts Module', () => {
    test('accounts list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/accounts`);
    });

    test('new account form loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/accounts/new`);
    });
  });

  test.describe('Opportunities Module', () => {
    test('opportunities list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/opportunities`);
    });
  });

  test.describe('Campaigns Module', () => {
    test('campaigns list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/campaigns`);
    });

    test('new campaign form loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/campaigns/new`);
    });

    test('campaign templates list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/campaigns/templates`);
    });
  });

  test.describe('Lists Module', () => {
    test('lists page loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/lists`);
    });
  });

  test.describe('Activities Module', () => {
    test('activities list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/activities`);
    });
  });

  test.describe('Analytics Module', () => {
    test('analytics dashboard loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/analytics`);
    });
  });

  test.describe('Enrichment Module', () => {
    test('enrichment list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/enrichment`);
    });

    test('new enrichment job loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/enrichment/new`);
    });

    test('enrichment templates loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/enrichment/templates`);
    });
  });

  test.describe('Automation Module', () => {
    test('workflows list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/automation/workflows`);
    });

    test('new workflow form loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/automation/workflows/new`);
    });
  });

  test.describe('Compliance Module', () => {
    test('compliance dashboard loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/compliance`);
    });

    test('consent management loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/compliance/consent`);
    });

    test('KYC management loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/compliance/kyc`);
    });
  });

  test.describe('Research Module', () => {
    test('research sessions list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/research`);
    });
  });

  test.describe('Predictions Module', () => {
    test('predictions dashboard loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/predictions`);
    });
  });

  test.describe('Agent Module', () => {
    test('agent dashboard loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/agent`);
    });

    test('agent performance loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/agent/performance`);
    });
  });

  test.describe('Batches Module', () => {
    test('batches list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/batches`);
    });
  });

  test.describe('Email Templates Module', () => {
    test('email templates list loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/email-templates`);
    });
  });

  test.describe('Timeline Module', () => {
    test('timeline view loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/timeline`);
    });
  });

  test.describe('Tasks Module', () => {
    test('tasks view loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/tasks`);
    });
  });

  test.describe('Search Module', () => {
    test('search page loads', async () => {
      await assertRouteLoads(sharedPage, `${BASE_CRM_PATH}/search`);
    });
  });
});
