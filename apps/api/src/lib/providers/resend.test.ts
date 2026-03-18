import { config } from 'dotenv';
config();

/**
 * Resend Provider Test
 * Simple test to verify Resend integration is working
 */

import { getResendProvider } from './resend';

async function testResendProvider() {
  console.log('🧪 Testing Resend Provider...\n');

  const provider = getResendProvider();

  try {
    // Test sending a single email
    console.log('Sending test email...');
    const result = await provider.sendEmail({
      to: 'delivered@resend.dev', // Use Resend test email
      subject: 'Test Campaign Email from Agios CRM',
      html: '<h1>Hello from Agios CRM!</h1><p>This is a test campaign email.</p>',
      from: 'Agios CRM <onboarding@resend.dev>', // Use Resend onboarding email
      tags: {
        campaign_id: 'test-campaign',
        test: 'true',
      },
    });

    console.log('✅ Email sent successfully!');
    console.log('Resend Email ID:', result.id);
    console.log('\n🎉 Test completed successfully!');
    console.log('\nNote: The email ID can be used to track delivery, opens, and clicks via webhooks.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testResendProvider();
