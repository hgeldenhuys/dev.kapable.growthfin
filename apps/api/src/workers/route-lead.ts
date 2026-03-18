/**
 * Route Lead Worker (US-LEAD-AI-011)
 * Processes lead routing jobs with automatic assignment to best-fit agent
 */

import { jobQueue, type RouteLeadJob } from '../lib/queue';
import { createRoutingService } from '../services/ai/routing-service';

/**
 * Register route-lead worker
 */
export async function registerRouteLeadWorker() {
  console.log('[Route Lead Worker] Registering worker...');

  try {
    await jobQueue.work<RouteLeadJob>(
      'route-lead',
      {
        teamSize: 3, // Process up to 3 routing decisions in parallel
        teamConcurrency: 5, // 5 leads per worker
      },
      async (job) => {
        const { leadId, workspaceId, trigger, routingStrategy } = job.data;

        console.log(`[Route Lead Worker] Routing lead ${leadId} (workspace: ${workspaceId})...`);
        console.log(`[Route Lead Worker] Trigger: ${trigger}, Strategy: ${routingStrategy || 'balanced'}`);

        try {
          // Get routing service
          const service = createRoutingService();

          // Route lead
          const result = await service.routeLead(leadId, workspaceId, {
            strategy: routingStrategy || 'balanced',
          });

          console.log(`[Route Lead Worker] Routed to agent ${result.assigned_agent_name}: ${result.routing_reason}`);
          console.log(`[Route Lead Worker] Routing score: ${result.routing_score.toFixed(2)}`);

          return { success: true, result };
        } catch (error: any) {
          console.error(`[Route Lead Worker] Failed:`, error);

          // Handle specific error cases
          if (error.message.includes('No available agents')) {
            console.log('[Route Lead Worker] No agents available, will retry later');
            // Throw to trigger retry
            throw new Error('NO_AGENTS_AVAILABLE');
          }

          if (error.message.includes('Lead not found')) {
            console.log('[Route Lead Worker] Lead not found, skipping');
            return { success: false, error: 'Lead not found' };
          }

          // Retry with exponential backoff (pg-boss handles this automatically)
          // Retry delays: 5s, 10s, 20s (3 retries total)
          throw error;
        }
      }
    );

    console.log('✅ Route lead worker registered successfully');
  } catch (error) {
    console.error('❌ Failed to register route lead worker:', error);
    throw error;
  }
}
