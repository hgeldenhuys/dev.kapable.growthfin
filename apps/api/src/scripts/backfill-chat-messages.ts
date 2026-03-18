/**
 * Backfill Chat Messages Script
 * Creates jobs for all existing Stop/UserPromptSubmit events that don't have chat messages yet
 */

import { db } from '@agios/db/client';
import { hookEvents, chatMessages } from '@agios/db/schema';
import { jobQueue } from '../lib/queue';
import { registerCreateChatMessagesWorker } from '../workers/create-chat-messages';
import { eq, inArray, sql } from 'drizzle-orm';

async function backfillChatMessages() {
  console.log('🔄 Starting chat messages backfill...');

  // 0. Start the job queue and register worker
  console.log('🚀 Starting job queue...');
  await jobQueue.start();
  console.log('✅ Job queue started');

  console.log('📋 Registering chat messages worker...');
  await registerCreateChatMessagesWorker();
  console.log('✅ Worker registered');

  // 1. Get all Stop and UserPromptSubmit events
  const relevantEvents = await db
    .select({
      id: hookEvents.id,
      sessionId: hookEvents.sessionId,
      projectId: hookEvents.projectId,
      transactionId: hookEvents.transactionId,
      eventName: hookEvents.eventName,
    })
    .from(hookEvents)
    .where(inArray(hookEvents.eventName, ['Stop', 'UserPromptSubmit']));

  console.log(`📊 Found ${relevantEvents.length} Stop/UserPromptSubmit events`);

  // 2. Get all existing chat messages (by hookEventId)
  const existingMessages = await db
    .select({ hookEventId: chatMessages.hookEventId })
    .from(chatMessages);

  const existingEventIds = new Set(existingMessages.map(m => m.hookEventId));
  console.log(`💾 Found ${existingEventIds.size} existing chat messages`);

  // 3. Filter to only events that don't have chat messages
  const eventsToProcess = relevantEvents.filter(e => !existingEventIds.has(e.id));
  console.log(`⚙️  Need to create ${eventsToProcess.length} chat messages`);

  // 4. Create jobs for each event
  let jobsCreated = 0;
  let errors = 0;

  for (const event of eventsToProcess) {
    try {
      await jobQueue.send('create-chat-messages', {
        hookEventId: event.id,
        sessionId: event.sessionId,
        projectId: event.projectId,
        transactionId: event.transactionId || null,
        eventName: event.eventName as 'Stop' | 'UserPromptSubmit',
      });
      jobsCreated++;

      if (jobsCreated % 50 === 0) {
        console.log(`   📝 Queued ${jobsCreated}/${eventsToProcess.length} jobs...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to queue job for event ${event.id}:`, error);
      errors++;
    }
  }

  console.log('\n✅ Backfill complete!');
  console.log(`   📊 Jobs created: ${jobsCreated}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   💾 Chat messages will be created by workers shortly`);
}

// Run backfill
await backfillChatMessages();

// Wait a bit for jobs to process
console.log('\n⏳ Waiting 10 seconds for jobs to process...');
await new Promise(resolve => setTimeout(resolve, 10000));

// Check results
const finalCount = await db
  .select({ count: sql<number>`count(*)` })
  .from(chatMessages);

console.log(`\n📊 Final chat message count: ${finalCount[0].count}`);

// Stop the queue
await jobQueue.stop();
console.log('✅ Job queue stopped');

process.exit(0);
