import { test } from '@playwright/test';

test('take final centered screenshot of landing-alt-23', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing-alt-23');
  // Wait for animations and layout to settle
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'landing-alt-23-fixed.png', fullPage: false });
});
