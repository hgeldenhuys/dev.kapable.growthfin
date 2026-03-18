/**
 * CLI Status Service
 * Check if CLI is connected and active for a workspace
 */

import { db } from '@agios/db';
import { cliSessions } from '@agios/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

// CLI is considered connected if heartbeat received in last 30 seconds
const HEARTBEAT_TIMEOUT_MS = 30 * 1000;

export class CliStatusService {
  /**
   * Check if any CLI is connected for a workspace (by projectId)
   * CLI sessions are tracked by projectId, not workspaceId
   */
  static async isCliConnected(projectId: string): Promise<boolean> {
    const cutoffTime = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);

    try {
      const activeSessions = await db
        .select({ id: cliSessions.id })
        .from(cliSessions)
        .where(
          and(
            eq(cliSessions.projectId, projectId),
            gte(cliSessions.lastHeartbeat, cutoffTime)
          )
        )
        .limit(1);

      return activeSessions.length > 0;
    } catch (error) {
      console.error('[CliStatusService] Error checking CLI connection:', error);
      return false;
    }
  }

  /**
   * Get active CLI session count for a workspace
   */
  static async getActiveSessionCount(projectId: string): Promise<number> {
    const cutoffTime = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);

    try {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cliSessions)
        .where(
          and(
            eq(cliSessions.projectId, projectId),
            gte(cliSessions.lastHeartbeat, cutoffTime)
          )
        );

      return result[0]?.count || 0;
    } catch (error) {
      console.error('[CliStatusService] Error counting active sessions:', error);
      return 0;
    }
  }

  /**
   * Get all active CLI sessions for a workspace
   */
  static async getActiveSessions(projectId: string) {
    const cutoffTime = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);

    try {
      return await db
        .select()
        .from(cliSessions)
        .where(
          and(
            eq(cliSessions.projectId, projectId),
            gte(cliSessions.lastHeartbeat, cutoffTime)
          )
        )
        .orderBy(cliSessions.lastHeartbeat);
    } catch (error) {
      console.error('[CliStatusService] Error getting active sessions:', error);
      return [];
    }
  }
}
