import { test } from '@playwright/test';

test('take final centered screenshot of landing-alt-30 fixed', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/landing-alt-30');
  // Wait for animations and layout to settle
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'landing-alt-30-fixed.png', fullPage: false });
});
