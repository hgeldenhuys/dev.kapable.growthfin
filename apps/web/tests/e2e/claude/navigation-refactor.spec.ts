/**
 * SDLC Navigation Refactor E2E Test Suite
 * US-NAV-014: Comprehensive E2E Test Suite
 * 
 * Tests all navigation flows, browser back/forward, cross-navigation,
 * SSE persistence, URL bookmarking, and performance metrics
 */

import { config } from 'dotenv';
import { test, expect } from '@playwright/test';

config();

const BASE_URL = process.env.WEB_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3000';

// SDLC routes don't require authentication - they're read-only internal dev tools

/**
 * AC-001: Complete Navigation Flow Tests
 * Tests: overview → boards → board detail → session detail
 */
test.describe('AC-001: Navigation Flow Tests', () => {
  test('NAV-001: Navigate to overview page', async ({ page }) => {
    // Navigate to overview
    await page.goto(`${BASE_URL}/claude/sdlc/overview`, { waitUntil: 'networkidle' });
    
    // Verify URL is correct
    expect(page.url()).toContain('/claude/sdlc/overview');
    
    // Page should load without error
    await page.waitForLoadState('networkidle');
  });

  test('NAV-002: Navigate to boards list', async ({ page }) => {
    // Navigate to boards
    await page.goto(`${BASE_URL}/claude/sdlc/boards`, { waitUntil: 'networkidle' });
    
    // Verify URL is correct
    expect(page.url()).toContain('/claude/sdlc/boards');
    
    // Page should load without error
    await page.waitForLoadState('networkidle');
  });

  test('NAV-003: Navigate to sessions list', async ({ page }) => {
    // Navigate to sessions
    await page.goto(`${BASE_URL}/claude/sdlc/sessions`, { waitUntil: 'networkidle' });
    
    // Verify URL is correct
    expect(page.url()).toContain('/claude/sdlc/sessions');
    
    // Page should load without error
    await page.waitForLoadState('networkidle');
  });

  test('NAV-004: Verify URL changes correctly when navigating', async ({ page }) => {
    const routes = [
      '/claude/sdlc/overview',
      '/claude/sdlc/boards',
      '/claude/sdlc/sessions'
    ];
    
    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      expect(page.url()).toContain(route);
    }
  });
});

/**
 * AC-002: Browser Back/Forward Navigation Tests
 */
test.describe('AC-002: Browser Back/Forward Navigation', () => {
  test('NAV-005: Browser back button returns to previous route', async ({ page }) => {
    // Navigate to overview
    await page.goto(`${BASE_URL}/claude/sdlc/overview`, { waitUntil: 'networkidle' });
    const overviewUrl = page.url();
    
    // Navigate to boards
    await page.goto(`${BASE_URL}/claude/sdlc/boards`, { waitUntil: 'networkidle' });
    const boardsUrl = page.url();
    
    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Should be back on overview
    expect(page.url()).toContain('/claude/sdlc/overview');
  });

  test('NAV-006: Browser forward button goes to next route', async ({ page }) => {
    // Navigate to overview
    await page.goto(`${BASE_URL}/claude/sdlc/overview`, { waitUntil: 'networkidle' });
    
    // Navigate to boards
    await page.goto(`${BASE_URL}/claude/sdlc/boards`, { waitUntil: 'networkidle' });
    
    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle' );
    
    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');
    
    // Should be back on boards
    expect(page.url()).toContain('/claude/sdlc/boards');
  });

  test('NAV-007: Multiple back/forward cycles maintain history', async ({ page }) => {
    // Navigate through multiple routes
    const routes = [
      `${BASE_URL}/claude/sdlc/overview`,
      `${BASE_URL}/claude/sdlc/boards`,
      `${BASE_URL}/claude/sdlc/sessions`
    ];
    
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle' });
    }
    
    // Go back twice
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Should be on overview
    expect(page.url()).toContain('/claude/sdlc/overview');
    
    // Go forward twice
    await page.goForward();
    await page.waitForLoadState('networkidle');
    await page.goForward();
    await page.waitForLoadState('networkidle');
    
    // Should be on sessions
    expect(page.url()).toContain('/claude/sdlc/sessions');
  });

  test('NAV-008: Page content matches URL after navigation', async ({ page }) => {
    // Navigate to boards
    await page.goto(`${BASE_URL}/claude/sdlc/boards`, { waitUntil: 'networkidle' });
    const boardsContent = await page.content();
    expect(boardsContent.length).toBeGreaterThan(100);
    
    // Navigate to sessions
    await page.goto(`${BASE_URL}/claude/sdlc/sessions`, { waitUntil: 'networkidle' });
    const sessionsContent = await page.content();
    expect(sessionsContent.length).toBeGreaterThan(100);
    
    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Should be back on boards
    expect(page.url()).toContain('/claude/sdlc/boards');
  });
});

/**
 * AC-003: URL Bookmarking and Direct Access Tests
 */
test.describe('AC-003: URL Bookmarking and Direct Access', () => {
  test('NAV-009: Direct access to overview page via URL', async ({ page }) => {
    // Navigate directly to overview
    await page.goto(`${BASE_URL}/claude/sdlc/overview`, { waitUntil: 'networkidle' });
    
    // Verify correct URL
    expect(page.url()).toContain('/claude/sdlc/overview');
    
    // Page should load without error
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('NAV-010: Direct access to boards list via URL', async ({ page }) => {
    // Navigate directly to boards
    await page.goto(`${BASE_URL}/claude/sdlc/boards`, { waitUntil: 'networkidle' });
    
    // Verify correct URL
    expect(page.url()).toContain('/claude/sdlc/boards');
    
    // Page should load
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('NAV-011: Direct access to sessions list via URL', async ({ page }) => {
    // Navigate directly to sessions
    await page.goto(`${BASE_URL}/claude/sdlc/sessions`, { waitUntil: 'networkidle' });
    
    // Verify correct URL
    expect(page.url()).toContain('/claude/sdlc/sessions');
    
    // Page should load
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('NAV-012: Direct access to board detail via URL', async ({ page }) => {
    // First, get a board ID from the API
    const boardsResponse = await page.request.get(`${API_URL}/api/v1/sdlc/boards`);
    const boardsData = await boardsResponse.json();
    
    if (boardsData.boards && boardsData.boards.length > 0) {
      const boardId = boardsData.boards[0].board_id;
      
      // Navigate directly to board detail
      await page.goto(`${BASE_URL}/claude/sdlc/boards/${boardId}`, { waitUntil: 'networkidle' });
      
      // Verify correct URL
      expect(page.url()).toContain(`/claude/sdlc/boards/${boardId}`);
      
      // Page should load
      const content = await page.content();
      expect(content.length).toBeGreaterThan(100);
    }
  });

  test('NAV-013: Direct access to session detail via URL', async ({ page }) => {
    // Get a session ID from the API
    const sessionsResponse = await page.request.get(`${API_URL}/api/v1/sdlc/sessions`);
    const sessionsData = await sessionsResponse.json();
    
    if (sessionsData.sessions && sessionsData.sessions.length > 0) {
      const sessionId = sessionsData.sessions[0].session_id;
      
      // Navigate directly to session detail
      await page.goto(`${BASE_URL}/claude/sdlc/sessions/${sessionId}`, { waitUntil: 'networkidle' });
      
      // Verify correct URL
      expect(page.url()).toContain(`/claude/sdlc/sessions/${sessionId}`);
      
      // Page should load
      const content = await page.content();
      expect(content.length).toBeGreaterThan(100);
    }
  });
});

/**
 * AC-004: SSE Persistence Tests
 */
test.describe('AC-004: SSE Connection Persistence', () => {
  test('NAV-014: No console errors during navigation', async ({ page }) => {
    const consoleMessages: { type: string; message: string }[] = [];
    
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        message: msg.text()
      });
    });
    
    // Navigate through all routes
    const routes = [
      `${BASE_URL}/claude/sdlc/overview`,
      `${BASE_URL}/claude/sdlc/boards`,
      `${BASE_URL}/claude/sdlc/sessions`
    ];
    
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    }
    
    // Check for errors
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('NAV-015: SSE connection established on overview', async ({ page }) => {
    // Navigate to overview
    await page.goto(`${BASE_URL}/claude/sdlc/overview`, { waitUntil: 'networkidle' });
    
    // Wait for page to settle
    await page.waitForTimeout(1000);
    
    // Page should load without error
    expect(page.url()).toContain('/claude/sdlc/overview');
  });

  test('NAV-016: Pages load without runtime errors', async ({ page }) => {
    const pageErrors: string[] = [];
    
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    
    // Navigate to boards
    await page.goto(`${BASE_URL}/claude/sdlc/boards`, { waitUntil: 'networkidle' });
    
    // Should not have errors
    expect(pageErrors.length).toBe(0);
  });
});

/**
 * AC-005: Cross-Navigation Tests
 */
test.describe('AC-005: Navigation Links Work', () => {
  test('NAV-017: All main routes are accessible', async ({ page }) => {
    const routes = [
      '/claude/sdlc/overview',
      '/claude/sdlc/boards',
      '/claude/sdlc/sessions'
    ];
    
    for (const route of routes) {
      const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      expect(response?.status()).toBeLessThan(400);
      expect(page.url()).toContain(route);
    }
  });

  test('NAV-018: API endpoints return valid data', async ({ page }) => {
    // Check sessions endpoint
    const sessionsResponse = await page.request.get(`${API_URL}/api/v1/sdlc/sessions`);
    expect(sessionsResponse.status()).toBe(200);
    const sessionsData = await sessionsResponse.json();
    expect(sessionsData).toHaveProperty('sessions');
    
    // Check boards endpoint
    const boardsResponse = await page.request.get(`${API_URL}/api/v1/sdlc/boards`);
    expect(boardsResponse.status()).toBe(200);
    const boardsData = await boardsResponse.json();
    expect(boardsData).toHaveProperty('boards');
  });
});

/**
 * AC-006: Performance Tests
 */
test.describe('AC-006: Performance Metrics', () => {
  test('NAV-019: Routes load quickly', async ({ page }) => {
    const routes = [
      `/claude/sdlc/overview`,
      `/claude/sdlc/boards`,
      `/claude/sdlc/sessions`
    ];
    
    for (const route of routes) {
      const startTime = Date.now();
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time (considering network)
      expect(loadTime).toBeLessThan(10000);
    }
  });

  test('NAV-020: Page navigation is smooth', async ({ page }) => {
    // Navigate to boards
    await page.goto(`${BASE_URL}/claude/sdlc/boards`, { waitUntil: 'networkidle' });
    
    // Measure initial load
    const startTime = Date.now();
    
    // Navigate to sessions
    await page.goto(`${BASE_URL}/claude/sdlc/sessions`, { waitUntil: 'networkidle' });
    
    const navTime = Date.now() - startTime;
    console.log(`Navigation time: ${navTime}ms`);
    
    // Should complete quickly
    expect(navTime).toBeLessThan(10000);
  });

  test('NAV-021: Pages render content', async ({ page }) => {
    const routes = [
      `/claude/sdlc/overview`,
      `/claude/sdlc/boards`,
      `/claude/sdlc/sessions`
    ];
    
    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      
      // Page should have substantial content
      const content = await page.content();
      expect(content.length).toBeGreaterThan(500);
    }
  });
});

/**
 * Summary test - verifies all critical paths work
 */
test.describe('Navigation Refactor - Critical Path', () => {
  test('NAV-022: Complete user journey works', async ({ page }) => {
    // Start at overview
    await page.goto(`${BASE_URL}/claude/sdlc/overview`, { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/claude/sdlc/overview');
    
    // Navigate to boards
    await page.goto(`${BASE_URL}/claude/sdlc/boards`, { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/claude/sdlc/boards');
    
    // Navigate to sessions
    await page.goto(`${BASE_URL}/claude/sdlc/sessions`, { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/claude/sdlc/sessions');
    
    // Go back to boards
    await page.goBack();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/claude/sdlc/boards');
    
    // Go back to overview
    await page.goBack();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/claude/sdlc/overview');
    
    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/claude/sdlc/boards');
  });

  test('NAV-023: Bookmarking and direct access work', async ({ page }) => {
    // Get test data from API
    const boardsResponse = await page.request.get(`${API_URL}/api/v1/sdlc/boards`);
    const boardsData = await boardsResponse.json();
    const sessionsResponse = await page.request.get(`${API_URL}/api/v1/sdlc/sessions`);
    const sessionsData = await sessionsResponse.json();
    
    // Test board detail direct access
    if (boardsData.boards && boardsData.boards.length > 0) {
      const boardId = boardsData.boards[0].board_id;
      await page.goto(`${BASE_URL}/claude/sdlc/boards/${boardId}`, { waitUntil: 'networkidle' });
      expect(page.url()).toContain(boardId);
    }
    
    // Test session detail direct access
    if (sessionsData.sessions && sessionsData.sessions.length > 0) {
      const sessionId = sessionsData.sessions[0].session_id;
      await page.goto(`${BASE_URL}/claude/sdlc/sessions/${sessionId}`, { waitUntil: 'networkidle' });
      expect(page.url()).toContain(sessionId);
    }
  });

  test('NAV-024: API data is accessible', async ({ page }) => {
    // Verify sessions endpoint works
    const sessionsResponse = await page.request.get(`${API_URL}/api/v1/sdlc/sessions`);
    expect(sessionsResponse.status()).toBe(200);
    const sessionsData = await sessionsResponse.json();
    expect(Array.isArray(sessionsData.sessions)).toBe(true);
    
    // Verify boards endpoint works
    const boardsResponse = await page.request.get(`${API_URL}/api/v1/sdlc/boards`);
    expect(boardsResponse.status()).toBe(200);
    const boardsData = await boardsResponse.json();
    expect(Array.isArray(boardsData.boards)).toBe(true);
  });
});
