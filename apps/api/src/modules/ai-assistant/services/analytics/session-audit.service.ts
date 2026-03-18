/**
 * Session Audit Service
 * Queries and filters Claude Code sessions for audit trail
 */

import { db, aiClaudeCodeSessions } from '@agios/db';
import { eq, and, gte, lte, desc, or, sql } from 'drizzle-orm';

export interface SessionAudit {
  id: string;
  sessionId: string;
  prompt: string; // Truncated to 100 chars
  status: 'active' | 'completed' | 'error';
  filesModified: string[];
  createdAt: string;
  lastActive: string;
  conversationId: string | null;
}

export interface SessionFilters {
  status?: 'active' | 'completed' | 'error';
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export class SessionAuditService {
  /**
   * Get sessions with filters and pagination
   */
  static async getSessions(
    workspaceId: string,
    filters?: SessionFilters,
    pagination?: PaginationParams
  ): Promise<{ sessions: SessionAudit[]; total: number }> {
    const conditions = [eq(aiClaudeCodeSessions.workspaceId, workspaceId)];

    // Apply filters
    if (filters?.status) {
      conditions.push(eq(aiClaudeCodeSessions.status, filters.status));
    }

    if (filters?.startDate) {
      conditions.push(gte(aiClaudeCodeSessions.createdAt, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(aiClaudeCodeSessions.createdAt, filters.endDate));
    }

    // Get total count
    const countResult = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(aiClaudeCodeSessions)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    // Get paginated sessions
    const limit = pagination?.limit || 50;
    const offset = pagination?.offset || 0;

    const sessions = await db
      .select({
        id: aiClaudeCodeSessions.id,
        sessionId: aiClaudeCodeSessions.sessionId,
        prompt: aiClaudeCodeSessions.prompt,
        status: aiClaudeCodeSessions.status,
        filesModified: aiClaudeCodeSessions.filesModified,
        createdAt: aiClaudeCodeSessions.createdAt,
        lastActive: aiClaudeCodeSessions.lastActive,
        conversationId: aiClaudeCodeSessions.conversationId,
      })
      .from(aiClaudeCodeSessions)
      .where(and(...conditions))
      .orderBy(desc(aiClaudeCodeSessions.lastActive))
      .limit(limit)
      .offset(offset);

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        prompt: this.truncatePrompt(s.prompt),
        status: s.status as 'active' | 'completed' | 'error',
        filesModified: s.filesModified || [],
        createdAt: s.createdAt.toISOString(),
        lastActive: s.lastActive.toISOString(),
        conversationId: s.conversationId,
      })),
      total,
    };
  }

  /**
   * Get session details by ID
   */
  static async getSessionById(
    workspaceId: string,
    sessionId: string
  ): Promise<SessionAudit | null> {
    const sessions = await db
      .select({
        id: aiClaudeCodeSessions.id,
        sessionId: aiClaudeCodeSessions.sessionId,
        prompt: aiClaudeCodeSessions.prompt,
        status: aiClaudeCodeSessions.status,
        filesModified: aiClaudeCodeSessions.filesModified,
        createdAt: aiClaudeCodeSessions.createdAt,
        lastActive: aiClaudeCodeSessions.lastActive,
        conversationId: aiClaudeCodeSessions.conversationId,
      })
      .from(aiClaudeCodeSessions)
      .where(
        and(
          eq(aiClaudeCodeSessions.workspaceId, workspaceId),
          eq(aiClaudeCodeSessions.sessionId, sessionId)
        )
      )
      .limit(1);

    const session = sessions[0];
    if (!session) return null;

    return {
      id: session.id,
      sessionId: session.sessionId,
      prompt: session.prompt || '',
      status: session.status as 'active' | 'completed' | 'error',
      filesModified: session.filesModified || [],
      createdAt: session.createdAt.toISOString(),
      lastActive: session.lastActive.toISOString(),
      conversationId: session.conversationId,
    };
  }

  /**
   * Truncate prompt for display
   */
  static truncatePrompt(prompt: string | null, maxLength = 100): string {
    if (!prompt) return '';
    if (prompt.length <= maxLength) return prompt;
    return prompt.substring(0, maxLength) + '...';
  }
}
