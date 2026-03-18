import { test } from '@playwright/test';

test('take final screenshot of landing-alt-24', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing-alt-24');
  // Wait for animations and layout to settle
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'landing-alt-24-check.png', fullPage: false });
});
