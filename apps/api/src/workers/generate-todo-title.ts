/**
 * Generate Todo Title Worker
 * Generates concise titles for todo lists using LLM based on user prompt context
 */

import { db } from '@agios/db/client';
import { hookEvents, claudeSessions } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { jobQueue, type GenerateTodoTitleJob } from '../lib/queue';
import { llmService } from '../lib/llm';

export async function registerGenerateTodoTitleWorker() {
  await jobQueue.work<GenerateTodoTitleJob>(
    'generate-todo-title',
    {
      teamSize: 1, // Single worker for title generation
      teamConcurrency: 1,
    },
    async (job) => {
      const { sessionId, projectId, userPromptSubmitEventId } = job.data;

      // 1. Fetch the session
      const [session] = await db
        .select()
        .from(claudeSessions)
        .where(eq(claudeSessions.id, sessionId))
        .limit(1);

      if (!session || !session.todos || session.todos.length === 0) {
        console.log(`No todos found for session ${sessionId}`);
        return;
      }

      // 2. Fetch the UserPromptSubmit event for context
      const [promptEvent] = await db
        .select()
        .from(hookEvents)
        .where(eq(hookEvents.id, userPromptSubmitEventId))
        .limit(1);

      if (!promptEvent) {
        console.error(`UserPromptSubmit event not found: ${userPromptSubmitEventId}`);
        return;
      }

      // 3. Extract user message from event
      const payload = promptEvent.payload as any;
      const conversationLine = payload?.conversation;

      // Handle both array and string content formats
      let userMessage = '';
      if (conversationLine?.message?.content) {
        const content = conversationLine.message.content;
        if (Array.isArray(content)) {
          userMessage = content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
        } else if (typeof content === 'string') {
          userMessage = content;
        }
      }

      if (!userMessage) {
        console.log(`No user message found in event ${userPromptSubmitEventId}`);
        return;
      }

      // 4. Generate title using LLM
      const todoContents = session.todos.map((t) => t.content).join('\n- ');

      try {
        const response = await llmService.complete(
          'todo-title-generator',
          [
            {
              role: 'user',
              content: `User Request:\n${userMessage}\n\nTodo List:\n- ${todoContents}`,
            },
          ],
          projectId
        );

        const title = response.content.trim();

        // 5. Update session with generated title
        await db
          .update(claudeSessions)
          .set({
            currentTodoTitle: title,
            updatedAt: new Date(),
          })
          .where(eq(claudeSessions.id, sessionId));

        console.log(`✅ Generated todo title for session ${sessionId}: "${title}"`);
      } catch (error) {
        console.error(`❌ Failed to generate todo title for session ${sessionId}:`, error);
        throw error; // Retry via pgboss
      }
    }
  );

  console.log('✅ Generate Todo Title worker registered');
}
