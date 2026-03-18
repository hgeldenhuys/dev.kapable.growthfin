/**
 * Extract Context Usage Worker
 * Extracts token usage and context metrics from Stop events
 */

import { db } from '@agios/db/client';
import { hookEvents, contextUsageEvents, type ContextUsageEvent } from '@agios/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { jobQueue, type ExtractContextUsageJob } from '../lib/queue';

// Pricing per million tokens (as of Claude Sonnet 4.5)
const PRICING = {
  input: 3.0, // $3 per million input tokens
  output: 15.0, // $15 per million output tokens
  cacheWrite: 3.75, // $3.75 per million cache write tokens
  cacheRead: 0.30, // $0.30 per million cache read tokens
};

export async function registerExtractContextUsageWorker() {
  await jobQueue.work<ExtractContextUsageJob>(
    'extract-context-usage',
    {
      teamSize: 3, // Process multiple in parallel
      teamConcurrency: 1,
    },
    async (job) => {
      const { hookEventId, sessionId, projectId, transactionId, agentType } = job.data;

      // 1. Check if already processed
      const existingUsage = await db.query.contextUsageEvents.findFirst({
        where: eq(contextUsageEvents.hookEventId, hookEventId),
      });

      if (existingUsage) {
        console.log(`Context usage already extracted for event ${hookEventId}, skipping`);
        return;
      }

      // 2. Fetch the Stop event
      const [event] = await db
        .select()
        .from(hookEvents)
        .where(eq(hookEvents.id, hookEventId))
        .limit(1);

      if (!event) {
        console.error(`Hook event not found: ${hookEventId}`);
        return;
      }

      // 3. Extract usage info from payload
      const payload = event.payload as any;
      const conversation = payload?.conversation;

      if (!conversation || conversation.type !== 'assistant') {
        console.log(`No assistant conversation found in Stop event ${hookEventId}`);
        return;
      }

      const usage = conversation.message?.usage;
      if (!usage) {
        console.log(`No usage info found in Stop event ${hookEventId}`);
        return;
      }

      // Extract token metrics
      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      const cacheCreationInputTokens = usage.cache_creation_input_tokens || 0;
      const cacheReadInputTokens = usage.cache_read_input_tokens || 0;
      const cacheCreation5mTokens = usage.cache_creation?.ephemeral_5m_input_tokens || 0;
      const cacheCreation1hTokens = usage.cache_creation?.ephemeral_1h_input_tokens || 0;

      const totalTokens = inputTokens + outputTokens;

      // Calculate cache hit rate
      const totalCacheableTokens = inputTokens + cacheReadInputTokens;
      const cacheHitRate = totalCacheableTokens > 0
        ? (cacheReadInputTokens / totalCacheableTokens) * 100
        : 0;

      // Estimate cost in USD
      const inputCost = (inputTokens / 1_000_000) * PRICING.input;
      const outputCost = (outputTokens / 1_000_000) * PRICING.output;
      const cacheWriteCost = (cacheCreationInputTokens / 1_000_000) * PRICING.cacheWrite;
      const cacheReadCost = (cacheReadInputTokens / 1_000_000) * PRICING.cacheRead;
      const costEstimate = inputCost + outputCost + cacheWriteCost + cacheReadCost;

      // 4. Get transaction context (tools used, duration)
      let toolsUsed: string[] = [];
      let toolUseCount = 0;
      let transactionStartedAt: Date | null = null;
      let durationMs: number | null = null;

      if (transactionId) {
        // Find all events in this transaction
        const transactionEvents = await db
          .select()
          .from(hookEvents)
          .where(eq(hookEvents.transactionId, transactionId))
          .orderBy(hookEvents.createdAt);

        if (transactionEvents.length > 0) {
          // Get first event timestamp as transaction start
          transactionStartedAt = transactionEvents[0].createdAt;

          // Calculate duration from first event to Stop event
          durationMs = event.createdAt.getTime() - transactionStartedAt.getTime();

          // Extract unique tools used in this transaction
          const toolSet = new Set<string>();
          for (const evt of transactionEvents) {
            if (evt.toolName) {
              toolSet.add(evt.toolName);
              if (evt.eventName === 'PostToolUse') {
                toolUseCount++;
              }
            }
          }
          toolsUsed = Array.from(toolSet);
        }
      }

      // Extract model info
      const model = conversation.message?.model || null;
      const serviceTier = usage.service_tier || null;

      // 5. Create context usage event
      await db.insert(contextUsageEvents).values({
        hookEventId,
        sessionId,
        projectId,
        transactionId,
        agentType: agentType || event.agentType || null,

        // Token metrics
        inputTokens,
        outputTokens,
        cacheCreationInputTokens,
        cacheReadInputTokens,
        cacheCreation5mTokens,
        cacheCreation1hTokens,

        // Derived metrics
        totalTokens,
        cacheHitRate: cacheHitRate.toFixed(2),
        costEstimate: costEstimate.toFixed(6),

        // Transaction context
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : null,
        toolUseCount,

        // Timing
        durationMs,
        transactionStartedAt,

        // Model info
        model,
        serviceTier,

        createdAt: new Date(),
      });

      console.log(
        `✅ Extracted context usage for event ${hookEventId}: ${totalTokens} tokens (${inputTokens} in + ${outputTokens} out), cache hit: ${cacheHitRate.toFixed(1)}%, cost: $${costEstimate.toFixed(4)}`
      );
    }
  );

  console.log('✅ Extract Context Usage worker registered');
}
