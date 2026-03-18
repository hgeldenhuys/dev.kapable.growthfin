import { test } from '@playwright/test';

test('take final screenshot of landing-alt-32 fixed', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/landing-alt-32');
  // Wait for animations and layout to settle
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'landing-alt-32-fixed.png', fullPage: false });
});
