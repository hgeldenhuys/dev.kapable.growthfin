#!/usr/bin/env bun
/**
 * Migration Script: Migrate todos from claude_sessions to todos table
 *
 * This script performs a one-time migration of existing todos stored
 * in the claude_sessions JSONB column to the normalized todos table
 * for cross-session persistence support.
 */

import { db } from '@agios/db/client';
import { claudeSessions, todos, type TodoItem } from '@agios/db/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';

async function migrateTodos() {
  console.log('🚀 Starting todo migration from claude_sessions to todos table...\n');

  try {
    // 1. Get all sessions with todos
    const sessionsWithTodos = await db
      .select({
        id: claudeSessions.id,
        projectId: claudeSessions.projectId,
        todos: claudeSessions.todos,
        createdAt: claudeSessions.createdAt,
        currentAgentType: claudeSessions.currentAgentType,
      })
      .from(claudeSessions)
      .where(isNotNull(claudeSessions.todos));

    console.log(`📊 Found ${sessionsWithTodos.length} sessions with todos\n`);

    if (sessionsWithTodos.length === 0) {
      console.log('✅ No todos to migrate. Exiting...');
      return;
    }

    // 2. Group sessions by projectId + agentType to identify latest
    const sessionGroups = new Map<string, typeof sessionsWithTodos>();

    for (const session of sessionsWithTodos) {
      const agentType = session.currentAgentType || 'main';
      const key = `${session.projectId}-${agentType}`;

      if (!sessionGroups.has(key)) {
        sessionGroups.set(key, []);
      }
      sessionGroups.get(key)!.push(session);
    }

    console.log(`📂 Found ${sessionGroups.size} project+agent combinations\n`);

    let totalMigrated = 0;
    let sessionsProcessed = 0;

    // 3. Process each project+agent group
    for (const [key, sessions] of sessionGroups) {
      const [projectId, agentType] = key.split('-');

      // Sort sessions by createdAt (newest first)
      const sortedSessions = sessions.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      console.log(`\n🔄 Processing ${key}:`);
      console.log(`  - Sessions: ${sortedSessions.length}`);

      // 4. Check if todos already exist in the todos table for this group
      const existingTodos = await db
        .select({ id: todos.id })
        .from(todos)
        .where(and(
          eq(todos.projectId, projectId),
          eq(todos.agentId, agentType)
        ))
        .limit(1);

      if (existingTodos.length > 0) {
        console.log(`  ⚠️  Todos already exist in todos table, skipping...`);
        continue;
      }

      // 5. Process sessions (newest is latest)
      for (let i = 0; i < sortedSessions.length; i++) {
        const session = sortedSessions[i];
        const isLatest = i === 0; // First session in sorted list is the latest
        const sessionTodos = session.todos as TodoItem[] || [];

        if (sessionTodos.length === 0) continue;

        console.log(`  - Session ${session.id.slice(0, 8)}... (${isLatest ? 'LATEST' : 'historical'}): ${sessionTodos.length} todos`);

        // 6. Prepare todos for insertion
        const todosToInsert = sessionTodos.map((todo, index) => ({
          sessionId: session.id,
          projectId: session.projectId,
          agentId: agentType,
          content: todo.content,
          activeForm: todo.activeForm,
          status: todo.status as 'pending' | 'in_progress' | 'completed',
          order: todo.order ?? index,
          isLatest: isLatest,
          migratedFrom: isLatest && i < sortedSessions.length - 1
            ? sortedSessions[i + 1].id
            : null, // If latest, mark as migrated from previous session
          createdAt: session.createdAt,
          updatedAt: new Date(),
        }));

        // 7. Insert todos into the todos table
        await db.insert(todos).values(todosToInsert);

        totalMigrated += todosToInsert.length;
        sessionsProcessed++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Migration completed successfully!`);
    console.log(`📊 Stats:`);
    console.log(`  - Sessions processed: ${sessionsProcessed}`);
    console.log(`  - Todos migrated: ${totalMigrated}`);
    console.log(`  - Project+Agent groups: ${sessionGroups.size}`);
    console.log('='.repeat(50));

    // 8. Verify migration
    console.log('\n🔍 Verifying migration...');

    const latestTodosCount = await db
      .select({ count: todos.id })
      .from(todos)
      .where(eq(todos.isLatest, true));

    const historicalTodosCount = await db
      .select({ count: todos.id })
      .from(todos)
      .where(eq(todos.isLatest, false));

    console.log(`  - Latest todos: ${latestTodosCount.length} records`);
    console.log(`  - Historical todos: ${historicalTodosCount.length} records`);
    console.log('\n✨ Migration verification complete!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
console.log('=' + '='.repeat(50));
console.log('TODO MIGRATION SCRIPT');
console.log('=' + '='.repeat(50));

migrateTodos()
  .then(() => {
    console.log('\n👍 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });