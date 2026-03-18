import { test } from '@playwright/test';

test('take screenshot of landing-alt-16', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing-alt-16');
  // Wait for animations to settle
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'landing-alt-16-check.png', fullPage: false });
});
