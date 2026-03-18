/**
 * Summarize Event Worker
 * Creates LLM-generated summaries for all hook events
 */

import { db } from '@agios/db/client';
import { hookEvents, eventSummaries, claudeSessions, projects, type HookEventName } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { jobQueue, type SummarizeEventJob } from '../lib/queue';
import { llmService } from '../lib/llm';

export async function registerSummarizeEventWorker() {
  await jobQueue.work<SummarizeEventJob>(
    'summarize-event',
    {
      teamSize: 3, // Process multiple events in parallel
      teamConcurrency: 1,
    },
    async (job) => {
      const { hookEventId, sessionId, projectId, eventName} = job.data;

      // Note: No longer updating hook_events to keep it immutable (INSERT-only)

      // 1. Check if already summarized
      const existingSummary = await db.query.eventSummaries.findFirst({
        where: eq(eventSummaries.hookEventId, hookEventId),
      });

      if (existingSummary) {
        console.log(`Event ${hookEventId} already summarized, skipping`);
        return;
      }

      // 2. Fetch the hook event
      const [event] = await db
        .select()
        .from(hookEvents)
        .where(eq(hookEvents.id, hookEventId))
        .limit(1);

      if (!event) {
        console.error(`Hook event not found: ${hookEventId}`);
        return;
      }

      // 3. Ensure session exists (create if needed to prevent FK violation)
      // This handles race condition where events arrive before SessionStart
      await db
        .insert(claudeSessions)
        .values({
          id: sessionId,
          projectId,
          currentAgentType: 'main', // Default, will be updated by SessionStart if needed
          createdAt: new Date(),
        })
        .onConflictDoNothing();

      // 3b. Fetch session and project for context
      const [session] = await db
        .select()
        .from(claudeSessions)
        .where(eq(claudeSessions.id, sessionId))
        .limit(1);

      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      // 4. Extract relevant content from event payload
      const payload = event.payload as any;
      let eventContent = '';
      let role = 'assistant'; // Default

      // Helper: Check if string contains binary data (null bytes or excessive non-printable chars)
      const isBinaryContent = (str: string): boolean => {
        if (str.includes('\u0000')) return true; // Null byte
        const nonPrintable = str.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g);
        return nonPrintable && nonPrintable.length > str.length * 0.1; // >10% non-printable
      };

      // Helper: Sanitize content to remove binary data
      const sanitizeContent = (obj: any): any => {
        if (typeof obj === 'string') {
          if (isBinaryContent(obj)) {
            return `[Binary content, ${obj.length} bytes]`;
          }
          return obj.length > 10000 ? obj.substring(0, 10000) + '... [truncated]' : obj;
        }
        if (Array.isArray(obj)) {
          return obj.map(sanitizeContent);
        }
        if (obj && typeof obj === 'object') {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeContent(value);
          }
          return sanitized;
        }
        return obj;
      };

      switch (eventName as HookEventName) {
        case 'PreToolUse':
        case 'PostToolUse':
          const toolName = event.toolName || 'Unknown';
          const sanitizedInput = sanitizeContent(payload?.event?.tool_input || {});
          const toolInput = JSON.stringify(sanitizedInput, null, 2);
          const toolResponse = payload?.event?.tool_response
            ? JSON.stringify(sanitizeContent(payload.event.tool_response), null, 2)
            : '';

          eventContent = `Tool: ${toolName}\nInput: ${toolInput}${
            toolResponse ? `\nResponse: ${toolResponse}` : ''
          }`;
          break;

        case 'UserPromptSubmit':
          // Extract from event.prompt (the actual user prompt), not conversation
          eventContent = payload?.event?.prompt || '';
          role = 'user';
          break;

        case 'Stop':
        case 'SubagentStop':
          const assistantMessage = payload?.conversation?.message?.content
            ? payload.conversation.message.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => sanitizeContent(c.text))
                .join('\n')
            : '';
          eventContent = assistantMessage;
          role = 'assistant';
          break;

        case 'Notification':
          eventContent = JSON.stringify(payload?.event || {}, null, 2);
          role = 'system';
          break;

        case 'SessionStart':
        case 'SessionEnd':
        case 'PreCompact':
          eventContent = `Session ${sessionId} - ${eventName}`;
          role = 'system';
          break;

        default:
          eventContent = JSON.stringify(payload, null, 2);
      }

      if (!eventContent) {
        console.log(`No content to summarize for event ${hookEventId}`);
        return;
      }

      // 5. Generate summary using LLM (or bypass for testing)
      let summary: string;

      // Magic word bypass for deterministic testing
      if (eventContent.startsWith('TEST:')) {
        // Skip LLM, use the text after "TEST:" as summary
        summary = eventContent.slice(5).trim();
        console.log(`🧪 Test mode: Using magic word bypass for event ${hookEventId}`);
      } else {
        // Normal LLM summarization
        try {
          const response = await llmService.complete(
            'event-summarizer',
            [
              {
                role: 'user',
                content: `Event Type: ${eventName}\nProject: ${project?.name || projectId}\nSession: ${sessionId}\n\nEvent Content:\n${eventContent}`,
              },
            ],
            projectId
          );

          summary = response.content.trim();
        } catch (error) {
          console.error(`❌ Failed to summarize event ${hookEventId}:`, error);
          throw error; // Retry via pgboss
        }
      }

      // 6. Get LLM config ID for tracking
      const llmConfig = await llmService.getConfig('event-summarizer', projectId);

      // 7. Save summary
      await db.insert(eventSummaries).values({
        hookEventId,
        hookEventType: eventName as HookEventName,
        summary,
        sessionId,
        projectId,
        transactionId: event.transactionId!,
        agentType: session?.currentAgentType || 'main',
        role,
        llmConfigId: llmConfig.id,
        createdAt: new Date(),
      });

      console.log(`✅ Generated summary for event ${hookEventId}: ${summary.substring(0, 50)}...`);
    }
  );

  console.log('✅ Summarize Event worker registered');
}
