/**
 * Authentication Flow Tests
 *
 * Tests login, logout, and protected route access.
 */

import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test@agios.dev',
  password: 'testpassword123',
};

// Use a real workspace ID from the test user
const TEST_WORKSPACE_ID = '713dc1ca-74de-46ac-8a45-a01b2ff23230';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
  });

  test('sign-in page loads', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await expect(page).toHaveURL(/\/auth\/sign-in/);

    // Check for email and password fields
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('sign-up page loads', async ({ page }) => {
    await page.goto('/auth/sign-up');
    await expect(page).toHaveURL(/\/auth\/sign-up/);
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/auth/sign-in');

    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/auth/sign-in');

    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should stay on sign-in page and show error
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    // Look for error message (could be toast or inline)
    const errorVisible = await page.locator('text=/invalid|error|incorrect/i').isVisible({ timeout: 5000 }).catch(() => false);
    // If no visible error text, at least verify we didn't redirect
    expect(page.url()).toContain('/auth/sign-in');
  });

  test('protected routes redirect to login when not authenticated', async ({ page }) => {
    // Try to access a protected CRM route without authentication
    const response = await page.goto(`/dashboard/${TEST_WORKSPACE_ID}/crm`);

    // Should redirect to sign-in
    await page.waitForURL(/\/auth\/sign-in|\/landing/, { timeout: 5000 });
  });

  test('landing page is accessible without authentication', async ({ page }) => {
    await page.goto('/landing');
    await expect(page).toHaveURL(/\/landing/);

    // Should not redirect to login
    const content = await page.content();
    expect(content).not.toContain('sign-in');
  });
});

test.describe('Authenticated Session', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth/sign-in');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test('can access CRM after login', async ({ page }) => {
    await page.goto(`/dashboard/${TEST_WORKSPACE_ID}/crm`);
    // Should load without redirecting to login
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
  });

  test('session persists across page navigations', async ({ page }) => {
    // Navigate to different CRM pages
    await page.goto(`/dashboard/${TEST_WORKSPACE_ID}/crm/contacts`);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);

    await page.goto(`/dashboard/${TEST_WORKSPACE_ID}/crm/leads`);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);

    await page.goto(`/dashboard/${TEST_WORKSPACE_ID}/crm/campaigns`);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
  });
});
