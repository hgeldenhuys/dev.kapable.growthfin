import { test } from '@playwright/test';

test('take final centered screenshot of landing-alt-26', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing-alt-26');
  // Wait for animations and layout to settle
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'landing-alt-26-check.png', fullPage: false });
});
