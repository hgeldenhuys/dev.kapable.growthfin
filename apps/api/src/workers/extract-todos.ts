/**
 * Extract Todos Worker
 * Processes TodoWrite tool events and updates claude_sessions with todos
 */

import { db } from '@agios/db/client';
import { hookEvents, claudeSessions, todos, type TodoItem } from '@agios/db/schema';
import { eq, and } from 'drizzle-orm';
import { jobQueue, type ExtractTodosJob } from '../lib/queue';
import crypto from 'crypto';

export async function registerExtractTodosWorker() {
  await jobQueue.work<ExtractTodosJob>(
    'extract-todos',
    {
      teamSize: 2, // Process 2 jobs in parallel
      teamConcurrency: 1, // One job per worker at a time
    },
    async (job) => {
      const { hookEventId, sessionId, projectId } = job.data;

      // 1. Fetch the hook event
      const [event] = await db
        .select()
        .from(hookEvents)
        .where(eq(hookEvents.id, hookEventId))
        .limit(1);

      if (!event) {
        console.error(`Hook event not found: ${hookEventId}`);
        return;
      }

      // 2. Extract todos from payload
      const payload = event.payload as any;
      const toolInput = payload?.event?.tool_input;

      if (!toolInput || !toolInput.todos) {
        console.log(`No todos found in event ${hookEventId}`);
        return;
      }

      const todoItems: TodoItem[] = toolInput.todos.map((todo: any, index: number) => ({
        content: todo.content,
        activeForm: todo.activeForm,
        status: todo.status as 'pending' | 'in_progress' | 'completed',
        order: index,
      }));

      // 3. Calculate hash of todo contents
      const todoHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(todoItems.map((t) => ({ content: t.content, status: t.status }))))
        .digest('hex');

      // 4. Fetch existing session to get agent type
      const [existingSession] = await db
        .select()
        .from(claudeSessions)
        .where(eq(claudeSessions.id, sessionId))
        .limit(1);

      if (!existingSession) {
        console.error(`Session not found: ${sessionId}. Session should be created by SessionStart event.`);
        return;
      }

      const agentType = existingSession.currentAgentType || 'main';
      const hashChanged = existingSession.currentTodoHash !== todoHash;

      // 5. DUAL-WRITE: Write to both claude_sessions (backward compatibility) and todos tables

      // 5a. Update claude_sessions table (existing behavior)
      await db
        .update(claudeSessions)
        .set({
          todos: todoItems,
          currentTodoHash: todoHash,
          updatedAt: new Date(),
          // Clear title if hash changed - will trigger title generation
          ...(hashChanged && { currentTodoTitle: null }),
        })
        .where(eq(claudeSessions.id, sessionId));

      console.log(`✅ Updated todos for session ${sessionId} in claude_sessions (hash changed: ${hashChanged})`);

      // 5b. Write to todos table (NEW persistent storage)
      if (hashChanged) {
        // Mark ALL previous todos for this project+agent as not latest
        // BUG FIX: Remove sessionId constraint to properly mark all old todos
        await db
          .update(todos)
          .set({ isLatest: false })
          .where(
            and(
              eq(todos.projectId, projectId),
              eq(todos.agentId, agentType)
            )
          );

        // Insert new todos
        const newTodos = todoItems.map((item) => ({
          sessionId,
          projectId,
          agentId: agentType,
          content: item.content,
          activeForm: item.activeForm,
          status: item.status,
          order: item.order,
          isLatest: true,
          migratedFrom: null, // Not a migration, this is a fresh write
        }));

        await db.insert(todos).values(newTodos);

        console.log(`✅ Wrote ${newTodos.length} todos to persistent todos table`);
      }

      // 6. If hash changed, trigger todo title generation
      if (hashChanged && !existingSession.currentTransactionId) {
        // We need a UserPromptSubmit event for context - will be triggered later
        console.log(`📝 Todo hash changed for session ${sessionId} - title generation pending`);
      }

    }
  );

  console.log('✅ Extract Todos worker registered');
}
