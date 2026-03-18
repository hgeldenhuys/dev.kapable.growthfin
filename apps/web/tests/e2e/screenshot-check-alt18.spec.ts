import { test } from '@playwright/test';

test('take screenshot of landing-alt-18', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing-alt-18');
  // Wait for animations and mesh to settle
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'landing-alt-18-check.png', fullPage: false });
});
