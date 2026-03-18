/**
 * Agent Identification Routes
 * Receives self-identification from agents via /identify slash command
 */

import { Elysia, t } from 'elysia';

// In-memory store for agent identities
// In production, this could use Redis or database
const agentIdentities = new Map<string, {
  agentType: string;
  timestamp: Date;
  projectId: string;
}>();

export const agentIdentifyRoutes = new Elysia({ prefix: '/agent-identify' })
  /**
   * POST /agent-identify
   * Receive agent self-identification
   */
  .post('/', async ({ body, set }) => {
    const { agentType, sessionId, projectId, timestamp } = body;

    // Store agent identity
    agentIdentities.set(sessionId, {
      agentType,
      timestamp: new Date(timestamp),
      projectId,
    });

    console.log(`🎭 Agent identified: ${agentType} (session: ${sessionId.slice(0, 8)}..., project: ${projectId.slice(0, 8)}...)`);

    return {
      success: true,
      agentType,
      sessionId,
      message: `Agent ${agentType} successfully registered`,
    };
  }, {
    body: t.Object({
      agentType: t.String(),
      sessionId: t.String(),
      projectId: t.String(),
      timestamp: t.String(),
    }),
  })

  /**
   * GET /agent-identify/:sessionId
   * Get current agent type for a session
   */
  .get('/:sessionId', async ({ params: { sessionId } }) => {
    const identity = agentIdentities.get(sessionId);

    if (!identity) {
      return {
        success: false,
        agentType: null,
        message: 'No agent identity found for this session',
      };
    }

    return {
      success: true,
      ...identity,
    };
  }, {
    params: t.Object({
      sessionId: t.String(),
    }),
  })

  /**
   * GET /agent-identify
   * List all active agent identities
   */
  .get('/', async () => {
    const identities = Array.from(agentIdentities.entries()).map(([sessionId, data]) => ({
      sessionId,
      ...data,
    }));

    return {
      success: true,
      count: identities.length,
      identities,
    };
  });

/**
 * Helper function to get current agent type for a session
 * Can be imported by other modules
 */
export function getCurrentAgentType(sessionId: string): string | null {
  return agentIdentities.get(sessionId)?.agentType || null;
}
