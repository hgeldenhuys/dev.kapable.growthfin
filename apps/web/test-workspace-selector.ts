/**
 * Test script for HooksWorkspaceSelector and context-aware navigation
 */
import { chromium } from 'playwright';

async function testWorkspaceSelector() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🧪 Testing HooksWorkspaceSelector and Context Navigation\n');

  try {
    // Navigate to dashboard
    console.log('1. Navigating to dashboard...');
    await page.goto('http://localhost:5173/dashboard');
    await page.waitForTimeout(2000);

    // Check if workspace selector is visible
    console.log('2. Checking if workspace selector is visible...');
    const workspaceSelectorVisible = await page.locator('text=All Projects').isVisible();
    if (workspaceSelectorVisible) {
      console.log('   ✅ Workspace selector is visible');
    } else {
      console.log('   ❌ Workspace selector NOT visible');
    }

    // Navigate to Chat Messages via navigation
    console.log('\n3. Clicking Chat Messages in navigation...');
    await page.click('text=Chat Messages');
    await page.waitForTimeout(1000);

    const chatUrl = page.url();
    console.log(`   Current URL: ${chatUrl}`);
    if (chatUrl.includes('/project/_/persona/_/chat')) {
      console.log('   ✅ Navigated to correct context URL');
    } else {
      console.log(`   ❌ Wrong URL! Expected /project/_/persona/_/chat, got ${chatUrl}`);
    }

    // Check if page content loaded
    const chatMessagesHeading = await page.locator('text=Chat Messages').first().isVisible();
    if (chatMessagesHeading) {
      console.log('   ✅ Chat Messages page loaded');
    } else {
      console.log('   ❌ Chat Messages page did NOT load');
    }

    // Test workspace selector functionality
    console.log('\n4. Testing Project dropdown...');
    const projectDropdown = page.locator('button').filter({ hasText: 'All Projects' }).first();
    await projectDropdown.click();
    await page.waitForTimeout(500);

    // Check if dropdown opened
    const dropdownOpen = await page.locator('[role="listbox"]').isVisible();
    if (dropdownOpen) {
      console.log('   ✅ Project dropdown opened');

      // Get list of projects
      const projectItems = await page.locator('[role="option"]').allTextContents();
      console.log(`   Found ${projectItems.length} items:`, projectItems);
    } else {
      console.log('   ❌ Project dropdown did NOT open');
    }

    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Navigate to Hook Events
    console.log('\n5. Clicking Hook Events in navigation...');
    await page.click('text=Hook Events');
    await page.waitForTimeout(1000);

    const hooksUrl = page.url();
    console.log(`   Current URL: ${hooksUrl}`);
    if (hooksUrl.includes('/project/_/persona/_/hooks')) {
      console.log('   ✅ Navigated to correct hooks URL');
    } else {
      console.log(`   ❌ Wrong URL! Expected /project/_/persona/_/hooks, got ${hooksUrl}`);
    }

    // Check if context is preserved
    console.log('\n6. Checking if context is preserved across navigation...');
    const projectSelectorValue = await page.locator('button').filter({ hasText: 'All Projects' }).first().textContent();
    const personaSelectorValue = await page.locator('button').filter({ hasText: 'All Personas' }).first().textContent();

    console.log(`   Project: ${projectSelectorValue?.trim()}`);
    console.log(`   Persona: ${personaSelectorValue?.trim()}`);

    if (projectSelectorValue?.includes('All Projects') && personaSelectorValue?.includes('All Personas')) {
      console.log('   ✅ Context preserved across navigation');
    } else {
      console.log('   ❌ Context NOT preserved');
    }

    console.log('\n✅ Testing complete!');
    console.log('\nBrowser will remain open for manual inspection. Press Ctrl+C to close.');

    // Keep browser open for manual inspection
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('\n❌ Error during testing:', error);
  } finally {
    await browser.close();
  }
}

// Run tests
testWorkspaceSelector();
