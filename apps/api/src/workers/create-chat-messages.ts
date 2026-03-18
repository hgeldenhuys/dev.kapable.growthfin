/**
 * Create Chat Messages Worker
 * Creates chat-style messages from Stop/UserPromptSubmit/thinking events
 */

import { db } from '@agios/db/client';
import { hookEvents, chatMessages, type ChatRole, type ChatMessageType } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { jobQueue, type CreateChatMessagesJob } from '../lib/queue';

export async function registerCreateChatMessagesWorker() {
  await jobQueue.work<CreateChatMessagesJob>(
    'create-chat-messages',
    {
      teamSize: 2, // Process multiple in parallel
      teamConcurrency: 1,
    },
    async (job) => {
      const { hookEventId, sessionId, projectId, transactionId, eventName } = job.data;

      // 1. Check if already processed
      const existingMessage = await db.query.chatMessages.findFirst({
        where: eq(chatMessages.hookEventId, hookEventId),
      });

      if (existingMessage) {
        console.log(`Chat message already exists for event ${hookEventId}, skipping`);
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

      // 3. Extract message content based on event type
      const payload = event.payload as any;
      let role: ChatRole;
      let messageType: ChatMessageType = 'message';
      let messageContent = '';
      let timestamp: Date;

      if (eventName === 'UserPromptSubmit') {
        // For UserPromptSubmit: extract from event.prompt (user's message)
        role = 'user';
        messageContent = payload?.event?.prompt || '';
        timestamp = payload?.timestamp ? new Date(payload.timestamp) : new Date(event.createdAt);

        if (!messageContent) {
          console.log(`No prompt found in UserPromptSubmit event ${hookEventId}`);
          return;
        }
      } else if (eventName === 'Stop') {
        // For Stop: extract from conversation.message (assistant's response)
        const conversationLine = payload?.conversation;

        if (!conversationLine) {
          console.log(`No conversation line found in Stop event ${hookEventId}`);
          return;
        }

        if (conversationLine.type !== 'assistant') {
          console.log(`Unexpected conversation type in Stop event: ${conversationLine.type}`);
          return;
        }

        role = 'assistant';
        timestamp = conversationLine.timestamp
          ? new Date(conversationLine.timestamp)
          : new Date(event.createdAt);

        // Extract text content or thinking
        if (conversationLine.message?.content) {
          for (const contentBlock of conversationLine.message.content) {
            if (contentBlock.type === 'text') {
              messageContent += contentBlock.text + '\n';
              messageType = 'message';
            } else if (contentBlock.type === 'thinking') {
              messageContent += contentBlock.thinking + '\n';
              messageType = 'thinking';
            }
          }
          messageContent = messageContent.trim();
        }

        if (!messageContent) {
          console.log(`No message content found in Stop event ${hookEventId}`);
          return;
        }
      } else {
        console.log(`Unexpected event type: ${eventName}`);
        return;
      }

      // 4. Create chat message
      try {
        await db.insert(chatMessages).values({
          hookEventId,
          sessionId,
          projectId,
          transactionId,
          role,
          message: messageContent,
          type: messageType,
          timestamp,
          createdAt: new Date(),
        });

        console.log(
          `✅ Created chat message for event ${hookEventId} (${role}/${messageType}): ${messageContent.substring(0, 50)}...`
        );
      } catch (error: any) {
        // Gracefully handle foreign key constraint errors (session may not exist in DB)
        if (error?.code === '23503') {
          console.log(`⚠️  Skipping chat message for event ${hookEventId}: session/project not in database`);
          return;
        }
        throw error; // Re-throw other errors for retry
      }

    }
  );

  console.log('✅ Create Chat Messages worker registered');
}
