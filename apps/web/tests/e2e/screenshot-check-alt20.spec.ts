import { test } from '@playwright/test';

test('take final screenshot of landing-alt-20', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/landing-alt-20');
  // Wait for animations and layout to settle
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'landing-alt-20-final.png', fullPage: false });
});
