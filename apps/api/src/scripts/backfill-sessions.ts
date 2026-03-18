/**
 * Backfill Sessions Script
 * Creates session records from all existing SessionStart events
 */

import { db } from '@agios/db/client';
import { hookEvents, claudeSessions } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

async function backfillSessions() {
  console.log('🔄 Starting sessions backfill...');

  // 1. Get all SessionStart events
  const sessionStartEvents = await db
    .select({
      id: hookEvents.id,
      sessionId: hookEvents.sessionId,
      projectId: hookEvents.projectId,
      payload: hookEvents.payload,
      createdAt: hookEvents.createdAt,
    })
    .from(hookEvents)
    .where(eq(hookEvents.eventName, 'SessionStart'));

  console.log(`📊 Found ${sessionStartEvents.length} SessionStart events`);

  // 2. Get all existing sessions
  const existingSessions = await db
    .select({ id: claudeSessions.id })
    .from(claudeSessions);

  const existingSessionIds = new Set(existingSessions.map(s => s.id));
  console.log(`💾 Found ${existingSessionIds.size} existing sessions`);

  // 3. Filter to only sessions that don't exist
  const sessionsToCreate = sessionStartEvents.filter(
    e => !existingSessionIds.has(e.sessionId)
  );
  console.log(`⚙️  Need to create ${sessionsToCreate.length} sessions`);

  // 4. Create sessions
  let sessionsCreated = 0;
  let errors = 0;

  for (const event of sessionsToCreate) {
    try {
      const payload = event.payload as any;
      const cwd = payload?.event?.cwd || payload?.conversation?.cwd || '/';
      const gitBranch = payload?.conversation?.gitBranch || 'unknown';

      await db.insert(claudeSessions).values({
        id: event.sessionId,
        projectId: event.projectId,
        cwd,
        gitBranch,
        startedAt: new Date(event.createdAt),
        createdAt: new Date(),
      });

      sessionsCreated++;

      if (sessionsCreated % 50 === 0) {
        console.log(`   ✅ Created ${sessionsCreated}/${sessionsToCreate.length} sessions...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to create session ${event.sessionId}:`, error);
      errors++;
    }
  }

  console.log('\n✅ Backfill complete!');
  console.log(`   📊 Sessions created: ${sessionsCreated}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   💾 Total sessions now: ${existingSessionIds.size + sessionsCreated}`);
}

// Run backfill
await backfillSessions();

process.exit(0);
