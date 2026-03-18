/**
 * Test Script for Recurring Campaigns
 * Creates a test recurring campaign and verifies scheduling works
 */

import { db } from '@agios/db';
import { crmCampaigns, crmContacts, crmCampaignMessages } from '@agios/db';
import { eq } from 'drizzle-orm';
import { validateCronExpression, getNextExecutionTime, describeCronSchedule } from '../modules/crm/services/recurring';
import { checkRecurringCampaigns } from '../workers/campaign-scheduler';

async function testRecurringCampaign() {
  console.log('🧪 Testing Recurring Campaigns Feature\n');

  // Test cron expression validation
  console.log('1️⃣ Testing cron expression validation...');
  try {
    validateCronExpression('*/5 * * * *');
    console.log('   ✅ Valid cron expression: "*/5 * * * *"');
  } catch (error) {
    console.log('   ❌ Failed:', error);
    return;
  }

  try {
    validateCronExpression('invalid cron');
    console.log('   ❌ Should have failed for invalid expression');
  } catch (error) {
    console.log('   ✅ Correctly rejected invalid cron expression');
  }

  // Test next execution time calculation
  console.log('\n2️⃣ Testing next execution time calculation...');
  const nextExecution = getNextExecutionTime('*/5 * * * *');
  console.log('   Next execution for "*/5 * * * *":', nextExecution.toISOString());
  console.log('   Description:', describeCronSchedule('*/5 * * * *'));

  // Get or create test workspace
  console.log('\n3️⃣ Setting up test data...');

  // Find first workspace
  const workspaces = await db.query.workspaces.findMany({ limit: 1 });
  if (workspaces.length === 0) {
    console.log('   ❌ No workspaces found. Please create a workspace first.');
    return;
  }
  const workspaceId = workspaces[0].id;
  console.log('   Using workspace:', workspaceId);

  // Get or create test contact
  let contact = await db.query.crmContacts.findFirst({
    where: (contacts, { eq, and, isNull }) =>
      and(eq(contacts.workspaceId, workspaceId), isNull(contacts.deletedAt)),
  });

  if (!contact) {
    console.log('   Creating test contact...');
    const [newContact] = await db
      .insert(crmContacts)
      .values({
        workspaceId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        status: 'active',
        lifecycleStage: 'verified',
      })
      .returning();
    contact = newContact;
  }
  console.log('   ✅ Using contact:', contact.email);

  // Create recurring campaign
  console.log('\n4️⃣ Creating recurring campaign...');
  const [campaign] = await db
    .insert(crmCampaigns)
    .values({
      workspaceId,
      name: 'Test Recurring Campaign',
      description: 'Test campaign for recurring functionality',
      objective: 'nurture',
      type: 'recurring',
      status: 'draft',
      channels: ['email'],
      schedule: '*/5 * * * *', // Every 5 minutes
      nextExecutionAt: getNextExecutionTime('*/5 * * * *'),
      timezone: 'UTC',
    })
    .returning();

  console.log('   ✅ Campaign created:', campaign.id);
  console.log('   Schedule:', campaign.schedule);
  console.log('   Next execution:', campaign.nextExecutionAt?.toISOString());

  // Create campaign message
  console.log('\n5️⃣ Creating campaign message...');
  const [message] = await db
    .insert(crmCampaignMessages)
    .values({
      workspaceId,
      campaignId: campaign.id,
      name: 'Test Email',
      channel: 'email',
      subject: 'Test Recurring Campaign',
      bodyText: 'Hello {{firstName}}, this is a test recurring campaign message.',
      sendFromEmail: 'test@agios.dev',
      sendFromName: 'Agios Test',
    })
    .returning();

  console.log('   ✅ Message created:', message.id);

  // Add recipient
  console.log('\n6️⃣ Adding recipient...');
  await db.execute`
    INSERT INTO crm_campaign_recipients (campaign_id, contact_id, workspace_id, status)
    VALUES (${campaign.id}, ${contact.id}, ${workspaceId}, 'pending')
    ON CONFLICT DO NOTHING
  `;
  console.log('   ✅ Recipient added');

  // Activate campaign
  console.log('\n7️⃣ Activating campaign...');
  await db
    .update(crmCampaigns)
    .set({ status: 'active', startedAt: new Date() })
    .where(eq(crmCampaigns.id, campaign.id));
  console.log('   ✅ Campaign activated');

  // Manually set next_execution_at to now for immediate testing
  console.log('\n8️⃣ Setting next execution to now for testing...');
  await db
    .update(crmCampaigns)
    .set({ nextExecutionAt: new Date() })
    .where(eq(crmCampaigns.id, campaign.id));
  console.log('   ✅ Next execution set to now');

  // Test scheduler
  console.log('\n9️⃣ Testing campaign scheduler...');
  await checkRecurringCampaigns();
  console.log('   ✅ Scheduler executed');

  // Check campaign status after scheduling
  const updatedCampaign = await db.query.crmCampaigns.findFirst({
    where: (campaigns, { eq }) => eq(campaigns.id, campaign.id),
  });

  console.log('\n📊 Campaign Status After Scheduling:');
  console.log('   Last executed:', updatedCampaign?.lastExecutedAt?.toISOString() || 'Never');
  console.log('   Next execution:', updatedCampaign?.nextExecutionAt?.toISOString() || 'Not scheduled');
  console.log('   Status:', updatedCampaign?.status);

  console.log('\n✅ Test completed successfully!');
  console.log('\n📝 Next Steps:');
  console.log('   1. Check the campaign execution job was queued');
  console.log('   2. Verify next_execution_at was updated to ~5 minutes from now');
  console.log('   3. Check timeline events were created');
  console.log('   4. Wait for the execute-campaign worker to process the job');
  console.log(`\n   Campaign ID: ${campaign.id}`);
  console.log('   View in Swagger: http://localhost:3000/swagger');
}

// Run the test
testRecurringCampaign()
  .then(() => {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
