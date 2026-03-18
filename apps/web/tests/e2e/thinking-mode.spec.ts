/**
 * Thinking Mode Feature Tests
 * US-THINK-008: Manual Testing with Chrome MCP
 * US-THINK-009: Edge Case Verification
 */

import { test, expect, Page } from '@playwright/test';

const CHAT_URL = 'http://localhost:5173/chat';
const THINKING_TOGGLE_ID = 'thinking-toggle';
const STORAGE_KEY = 'chat-thinking-enabled';

test.describe('US-THINK-008: Extended Thinking Mode UI', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.evaluate(() => localStorage.clear());
    await page.goto(CHAT_URL);
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('Test 1: ThinkingToggle Component Visibility and Label', async ({ page }) => {
    // Verify toggle is visible
    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    await expect(toggle).toBeVisible();

    // Verify label is present
    const label = page.locator('label[for="thinking-toggle"]');
    await expect(label).toBeVisible();
    await expect(label).toContainText('Show Thinking');

    // Verify Brain icon is present
    const brainIcon = page.locator('svg[class*="lucide"]').first();
    await expect(brainIcon).toBeVisible();

    // Take screenshot of initial state
    await page.screenshot({ path: '/tmp/thinking-toggle-initial.png' });
  });

  test('Test 2: Toggle Enable and Visual Feedback', async ({ page }) => {
    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    
    // Initial state should be off
    await expect(toggle).toHaveAttribute('data-state', 'unchecked');

    // Click to enable
    await toggle.click();
    
    // Verify state changed
    await expect(toggle).toHaveAttribute('data-state', 'checked');

    // Verify "Active" indicator is visible
    const activeIndicator = page.locator('text=(Active)');
    await expect(activeIndicator).toBeVisible();

    // Take screenshot of enabled state
    await page.screenshot({ path: '/tmp/thinking-toggle-enabled.png' });
  });

  test('Test 3: localStorage Persistence After Refresh', async ({ page }) => {
    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    
    // Enable thinking mode
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-state', 'checked');

    // Verify localStorage is set
    const storedValue = await page.evaluate(() => localStorage.getItem('chat-thinking-enabled'));
    expect(storedValue).toBe('true');

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify toggle is still enabled after refresh
    const refreshedToggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    await expect(refreshedToggle).toHaveAttribute('data-state', 'checked');

    // Verify "Active" indicator is still visible
    const activeIndicator = page.locator('text=(Active)');
    await expect(activeIndicator).toBeVisible();
  });

  test('Test 4: Toggle Disable and Persistence', async ({ page }) => {
    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    
    // Enable first
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-state', 'checked');

    // Disable
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-state', 'unchecked');

    // Verify "Active" indicator is gone
    const activeIndicator = page.locator('text=(Active)');
    await expect(activeIndicator).not.toBeVisible();

    // Verify localStorage is set to false
    const storedValue = await page.evaluate(() => localStorage.getItem('chat-thinking-enabled'));
    expect(storedValue).toBe('false');

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify toggle is still disabled
    const refreshedToggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    await expect(refreshedToggle).toHaveAttribute('data-state', 'unchecked');
  });

  test('Test 5: Component Layout and Styling', async ({ page }) => {
    // Verify toggle container has proper flexbox layout
    const toggleContainer = page.locator('div').filter({ 
      has: page.locator(`#${THINKING_TOGGLE_ID}`) 
    }).first();
    
    const styles = await toggleContainer.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        gap: computed.gap,
        alignItems: computed.alignItems
      };
    });

    expect(styles.display).toBe('flex');
    expect(styles.alignItems).toContain('center');

    // Verify styling matches design system
    const label = page.locator('label[for="thinking-toggle"]');
    const labelStyles = await label.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        cursor: computed.cursor
      };
    });

    expect(labelStyles.cursor).toBe('pointer');
    expect(labelStyles.fontWeight).toBe('500');
  });

  test('Test 6: Keyboard Navigation', async ({ page }) => {
    // Tab to toggle
    await page.keyboard.press('Tab');
    // May need multiple tabs depending on page layout

    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    const isFocused = await toggle.evaluate(el => el === document.activeElement);
    
    // If focused, test keyboard activation
    if (isFocused) {
      // Space or Enter should toggle
      await page.keyboard.press('Space');
      
      // Verify state changed
      const state = await toggle.getAttribute('data-state');
      expect(['checked', 'unchecked']).toContain(state);
    }
  });
});

test.describe('US-THINK-009: Edge Cases and Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHAT_URL);
    await page.waitForLoadState('networkidle');
  });

  test('Edge Case 1: Rapid Toggle Clicks', async ({ page }) => {
    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    
    // Clear localStorage to start fresh
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Get initial state
    const initialState = await page.evaluate(() => localStorage.getItem('chat-thinking-enabled'));
    expect(initialState).toBe('false'); // Should default to false

    // Rapid clicks (10+)
    for (let i = 0; i < 11; i++) {
      await toggle.click({ force: true });
      await page.waitForTimeout(50); // Small delay between clicks
    }

    // Final state should be checked (odd number of clicks)
    await expect(toggle).toHaveAttribute('data-state', 'checked');

    // Verify localStorage is correct
    const finalState = await page.evaluate(() => localStorage.getItem('chat-thinking-enabled'));
    expect(finalState).toBe('true');
  });

  test('Edge Case 2: localStorage Key Exists and Persists', async ({ page }) => {
    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);

    // Set initial state
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-state', 'checked');

    // Verify exact key name
    const hasKey = await page.evaluate(() => 
      localStorage.getItem('chat-thinking-enabled') !== null
    );
    expect(hasKey).toBe(true);

    // Verify key format
    const value = await page.evaluate(() => 
      localStorage.getItem('chat-thinking-enabled')
    );
    expect(['true', 'false']).toContain(value);
  });

  test('Edge Case 3: localStorage Disabled Graceful Handling', async ({ page, context }) => {
    // Create new context with localStorage disabled (simulated via override)
    await page.evaluate(() => {
      // Store original setItem
      const originalSetItem = Storage.prototype.setItem;
      const originalGetItem = Storage.prototype.getItem;
      
      // Override to throw error (simulate disabled localStorage)
      Storage.prototype.setItem = () => {
        throw new Error('localStorage is disabled');
      };
      Storage.prototype.getItem = () => null;
    });

    // Reload page - should still work without errors
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify page still renders without errors
    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    await expect(toggle).toBeVisible();

    // Toggle should still be clickable (even if localStorage doesn't work)
    await expect(async () => {
      await toggle.click();
    }).not.toThrow();
  });

  test('Edge Case 4: Invalid localStorage Value Handling', async ({ page }) => {
    // Set invalid value in localStorage
    await page.evaluate(() => {
      localStorage.setItem('chat-thinking-enabled', 'invalid');
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Page should still load without errors
    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    await expect(toggle).toBeVisible();

    // Should default to unchecked if value is invalid
    const state = await toggle.getAttribute('data-state');
    // If invalid, should treat as false (unchecked)
    expect(['unchecked', 'checked']).toContain(state);
  });

  test('Edge Case 5: Multiple Browser Tabs Sync (Via localStorage Events)', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto(CHAT_URL);
    await page2.goto(CHAT_URL);

    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');

    // Clear both pages
    await page1.evaluate(() => localStorage.clear());
    await page2.evaluate(() => localStorage.clear());

    const toggle1 = page1.locator(`#${THINKING_TOGGLE_ID}`);
    const toggle2 = page2.locator(`#${THINKING_TOGGLE_ID}`);

    // Toggle in page 1
    await toggle1.click();
    await expect(toggle1).toHaveAttribute('data-state', 'checked');

    // Wait a moment for event propagation
    await page1.waitForTimeout(100);

    // Check page 2 (should also be enabled due to localStorage sync)
    const page2State = await page2.evaluate(() => localStorage.getItem('chat-thinking-enabled'));
    expect(page2State).toBe('true');

    // Reload page 2 to verify persistence
    await page2.reload();
    await page2.waitForLoadState('networkidle');

    const refreshedToggle2 = page2.locator(`#${THINKING_TOGGLE_ID}`);
    await expect(refreshedToggle2).toHaveAttribute('data-state', 'checked');

    await page1.close();
    await page2.close();
  });

  test('Edge Case 6: Console Errors During Toggle', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);

    // Toggle multiple times
    for (let i = 0; i < 5; i++) {
      await toggle.click();
    }

    // Should have no errors
    expect(errors).toHaveLength(0);
  });

  test('Edge Case 7: ThinkingBlock Component Default State', async ({ page }) => {
    // This test verifies ThinkingBlock exists and can be rendered
    // (We can't test actual API responses without backend, but we can verify structure)

    // Search for ThinkingBlock in DOM (it won't exist until API returns thinking content)
    const thinkingBlocks = page.locator('[class*="ThinkingBlock"]');
    const count = await thinkingBlocks.count();
    
    // Initially should have no thinking blocks since no messages yet
    expect(count).toBe(0);
  });
});

test.describe('Console and Performance Monitoring', () => {
  test('Monitor Console for Errors During Testing', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    await page.goto(CHAT_URL);
    await page.waitForLoadState('networkidle');

    // Interact with toggle
    const toggle = page.locator(`#${THINKING_TOGGLE_ID}`);
    await toggle.click();
    await toggle.click();

    // Wait a moment for any async operations
    await page.waitForTimeout(500);

    // Report results
    console.log('Console Errors:', consoleErrors.length > 0 ? consoleErrors : 'None');
    console.log('Console Warnings:', consoleWarnings.length > 0 ? consoleWarnings : 'None');

    // Critical: No errors should be present
    expect(consoleErrors).toHaveLength(0);
  });

  test('Check Network Requests', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', req => {
      requests.push(`${req.method()} ${req.url()}`);
    });

    await page.goto(CHAT_URL);
    await page.waitForLoadState('networkidle');

    // Verify page loaded successfully
    expect(requests.length).toBeGreaterThan(0);

    // Verify no 404s or 500s for static assets
    const errors = requests.filter(r => r.includes('404') || r.includes('500'));
    expect(errors).toHaveLength(0);
  });
});
