/**
 * Visual test for context-aware navigation
 */
import { chromium } from 'playwright';

async function testContextNav() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🧪 Testing Context-Aware Navigation\n');

  try {
    // Navigate directly to chat route with context
    console.log('1. Navigating to /dashboard/project/_/persona/_/chat...');
    await page.goto('http://localhost:5173/dashboard/project/_/persona/_/chat');
    await page.waitForTimeout(5000); // Wait for data to load

    // Take screenshot
    await page.screenshot({ path: '/tmp/chat-page.png', fullPage: true });
    console.log('   📸 Screenshot saved to /tmp/chat-page.png');

    // Check if page loaded
    const title = await page.title();
    console.log(`   Page title: ${title}`);

    // Check URL
    console.log(`   Current URL: ${page.url()}`);

    // Check if workspace selector visible
    const projectsText = await page.locator('text=All Projects').count();
    const personasText = await page.locator('text=All Personas').count();

    if (projectsText > 0) {
      console.log('   ✅ Project selector found');
    } else {
      console.log('   ⚠️  Project selector not visible (may still be loading)');
    }

    if (personasText > 0) {
      console.log('   ✅ Persona selector found');
    } else {
      console.log('   ⚠️  Persona selector not visible (may still be loading)');
    }

    // Check if chat messages heading exists
    const chatHeading = await page.locator('h1:has-text("Chat Messages")').count();
    if (chatHeading > 0) {
      console.log('   ✅ Chat Messages heading found');
    } else {
      console.log('   ❌ Chat Messages heading NOT found');
    }

    // Navigate to hooks
    console.log('\n2. Navigating to /dashboard/project/_/persona/_/hooks...');
    await page.goto('http://localhost:5173/dashboard/project/_/persona/_/hooks');
    await page.waitForTimeout(5000);

    await page.screenshot({ path: '/tmp/hooks-page.png', fullPage: true });
    console.log('   📸 Screenshot saved to /tmp/hooks-page.png');

    const hooksHeading = await page.locator('h1:has-text("Hook Events")').count();
    if (hooksHeading > 0) {
      console.log('   ✅ Hook Events heading found');
    } else {
      console.log('   ❌ Hook Events heading NOT found');
    }

    console.log('\n✅ Testing complete!');
    console.log('   Check screenshots at /tmp/chat-page.png and /tmp/hooks-page.png');
    console.log('\nPress Ctrl+C to close browser.');

    // Keep browser open
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testContextNav();
