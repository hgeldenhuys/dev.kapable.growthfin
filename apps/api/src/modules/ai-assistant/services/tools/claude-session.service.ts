/**
 * Claude Code Session Management
 */

import { db } from '@agios/db/client';
import { aiClaudeCodeSessions } from '@agios/db';
import { eq, and, lt } from 'drizzle-orm';

export class ClaudeSessionService {
  /**
   * Create new session
   */
  static async createSession(data: {
    workspaceId: string;
    sessionId: string;
    conversationId?: string;
    prompt: string;
    result: any;
    filesModified: string[];
  }) {
    const [session] = await db
      .insert(aiClaudeCodeSessions)
      .values({
        workspaceId: data.workspaceId,
        sessionId: data.sessionId,
        conversationId: data.conversationId,
        status: 'active',
        prompt: data.prompt,
        result: data.result,
        filesModified: data.filesModified,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      })
      .returning();

    return session;
  }

  /**
   * Get session by ID
   */
  static async getSession(sessionId: string) {
    const [session] = await db
      .select()
      .from(aiClaudeCodeSessions)
      .where(eq(aiClaudeCodeSessions.sessionId, sessionId))
      .limit(1);

    return session || null;
  }

  /**
   * Update session activity
   */
  static async updateActivity(sessionId: string, result?: any) {
    await db
      .update(aiClaudeCodeSessions)
      .set({
        lastActive: new Date(),
        result,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Extend expiration by 1 hour
      })
      .where(eq(aiClaudeCodeSessions.sessionId, sessionId));
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpired() {
    const result = await db
      .delete(aiClaudeCodeSessions)
      .where(
        and(
          eq(aiClaudeCodeSessions.status, 'active'),
          lt(aiClaudeCodeSessions.expiresAt, new Date())
        )
      )
      .returning();

    return result.length;
  }
}
