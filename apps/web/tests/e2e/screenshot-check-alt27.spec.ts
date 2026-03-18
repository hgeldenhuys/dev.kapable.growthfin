import { test } from '@playwright/test';

test('take final screenshot of landing-alt-27', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/landing-alt-27');
  // Wait for animations and mesh to settle
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'landing-alt-27-final.png', fullPage: false });
});
