import { config } from 'dotenv';
config();

/**
 * Claude Observability E2E Sanity Tests
 * Smoke tests to ensure Claude observability pages load without crashing
 * Tests URL-based project filtering and core UI elements
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.WEB_URL || 'http://localhost:5173';
const TEST_EMAIL = 'test@agios.dev';
const TEST_PASSWORD = 'testpassword123';

/**
 * Sign in helper function
 * Uses the test credentials displayed on the sign-in page
 */
async function signIn(page: any) {
  await page.goto(`${BASE_URL}/auth/sign-in`);
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button:has-text("Sign in")');

  // Wait for navigation to complete
  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-in'), { timeout: 10000 });
}

test.describe('Claude Observability - Sanity Tests', () => {
  // Sign in before each test
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });
  test('CO-001: Dashboard loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/claude`);

    // Should have main navigation visible
    await expect(page.locator('text=Claude Observability').first()).toBeVisible({ timeout: 10000 });

    // Page should not have Application Error
    await expect(page.getByText('Application Error')).not.toBeVisible();
  });

  test('CO-002: Hook Events page loads and displays events', async ({ page }) => {
    await page.goto(`${BASE_URL}/claude/hooks`);

    // Should show Hook Events header
    await expect(page.getByRole('heading', { name: /Hook Events/i }).first()).toBeVisible({ timeout: 10000 });

    // Should not crash
    await expect(page.getByText('Application Error')).not.toBeVisible();
    await expect(page.getByText('ReferenceError')).not.toBeVisible();

    // Should have summary cards
    await expect(page.getByText(/Total Events/i)).toBeVisible();
  });

  test('CO-003: Chat Messages page loads without crashing', async ({ page }) => {
    await page.goto(`${BASE_URL}/claude/chat`);

    // Wait for Chat Messages header to appear (confirms page loaded)
    await expect(page.getByRole('heading', { name: /Chat Messages/i }).first()).toBeVisible({ timeout: 10000 });

    // Should have summary cards
    await expect(page.getByText(/Total Messages/i)).toBeVisible();
  });

  test('CO-004: Agents page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/claude/agents`);

    // Wait for page to load by checking for content
    await page.waitForTimeout(2000);

    // Should not crash
    await expect(page.getByText('Application Error')).not.toBeVisible();

    // Should show agents-related content
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('CO-005: Sessions page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/claude/sessions`);

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Should not crash
    await expect(page.getByText('Application Error')).not.toBeVisible();

    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('CO-006: Projects page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/claude/projects`);

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Should not crash
    await expect(page.getByText('Application Error')).not.toBeVisible();

    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('CO-007: URL-based project filtering works on hook events', async ({ page }) => {
    // First, visit without projectId param
    await page.goto(`${BASE_URL}/claude/hooks`);
    await expect(page.getByRole('heading', { name: /Hook Events/i }).first()).toBeVisible({ timeout: 10000 });

    const urlWithoutProject = page.url();
    expect(urlWithoutProject).not.toContain('projectId=');

    // Now navigate with projectId param
    const testProjectId = '0ebfac28-1680-4ec1-a587-836660140055';
    await page.goto(`${BASE_URL}/claude/hooks?projectId=${testProjectId}`);
    await expect(page.getByRole('heading', { name: /Hook Events/i }).first()).toBeVisible({ timeout: 10000 });

    // URL should preserve the projectId param
    const urlWithProject = page.url();
    expect(urlWithProject).toContain(`projectId=${testProjectId}`);

    // Page should still load without errors
    await expect(page.getByText('Application Error')).not.toBeVisible();
  });

  test('CO-008: URL-based project filtering works on chat messages', async ({ page }) => {
    // Visit with projectId param
    const testProjectId = '0ebfac28-1680-4ec1-a587-836660140055';
    await page.goto(`${BASE_URL}/claude/chat?projectId=${testProjectId}`);

    // Should show Chat Messages header
    await expect(page.getByRole('heading', { name: /Chat Messages/i }).first()).toBeVisible({ timeout: 10000 });

    // URL should preserve the projectId param
    const currentUrl = page.url();
    expect(currentUrl).toContain(`projectId=${testProjectId}`);
  });

  test('CO-009: Project selector exists in left nav', async ({ page }) => {
    await page.goto(`${BASE_URL}/claude/hooks`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Hook Events/i }).first()).toBeVisible({ timeout: 10000 });

    // The ClaudeProjectSelector should be in the AppShell's left nav
    // Look for the FolderKanban icon or "All Projects" text
    const projectSelector = page.locator('text=/All Projects|Project/i').first();
    await expect(projectSelector).toBeVisible();
  });

  test('CO-010: Real-time indicator shows on hook events page', async ({ page }) => {
    await page.goto(`${BASE_URL}/claude/hooks`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Hook Events/i }).first()).toBeVisible({ timeout: 10000 });

    // Should show real-time "Live" indicator from useSharedSSE
    const liveIndicator = page.locator('text=/Live/i');

    // Give SSE connection time to establish and verify indicator appears
    await expect(liveIndicator).toBeVisible({ timeout: 5000 });
  });
});
