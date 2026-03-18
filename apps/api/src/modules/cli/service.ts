/**
 * CLI Sessions Service
 * Manages active CLI sessions for heartbeat monitoring
 */

import { db } from '@agios/db/client';
import { cliSessions, type NewCliSession } from '@agios/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';

/**
 * Upsert a CLI session heartbeat
 * Creates new session or updates last_heartbeat timestamp
 */
export async function upsertHeartbeat(data: {
  sessionId: string;
  projectId: string;
  command: string;
  metadata?: Record<string, any>;
}) {
  // Check if session exists
  const existing = await db
    .select()
    .from(cliSessions)
    .where(
      and(
        eq(cliSessions.sessionId, data.sessionId),
        eq(cliSessions.command, data.command)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing session
    const updated = await db
      .update(cliSessions)
      .set({
        lastHeartbeat: new Date(),
        metadata: data.metadata,
      })
      .where(
        and(
          eq(cliSessions.sessionId, data.sessionId),
          eq(cliSessions.command, data.command)
        )
      )
      .returning();

    return updated[0];
  } else {
    // Create new session
    const newSession: NewCliSession = {
      sessionId: data.sessionId,
      projectId: data.projectId,
      command: data.command,
      metadata: data.metadata,
    };

    const created = await db.insert(cliSessions).values(newSession).returning();
    return created[0];
  }
}

/**
 * Get active CLI sessions for a project
 * Active = last heartbeat within last 2 minutes
 */
export async function getActiveSessions(projectId?: string) {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const conditions = [];
  if (projectId) {
    conditions.push(eq(cliSessions.projectId, projectId));
  }

  // Get sessions that are still active (heartbeat within last 2 minutes)
  // We want sessions where lastHeartbeat is GREATER than twoMinutesAgo (i.e., recent)
  let query = db
    .select()
    .from(cliSessions)
    .orderBy(desc(cliSessions.lastHeartbeat));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const allSessions = await query;

  // Filter to only active sessions (heartbeat within last 2 minutes)
  const sessions = allSessions.filter(
    (session) => session.lastHeartbeat.getTime() > twoMinutesAgo.getTime()
  );

  // Calculate uptime for each session
  return sessions.map((session) => ({
    ...session,
    uptime: Date.now() - session.createdAt.getTime(),
    lastHeartbeatAgo: Date.now() - session.lastHeartbeat.getTime(),
  }));
}

/**
 * Delete a CLI session
 * Called when CLI exits gracefully
 */
export async function deleteSession(sessionId: string) {
  await db.delete(cliSessions).where(eq(cliSessions.sessionId, sessionId));
}

/**
 * Clean up stale sessions (no heartbeat for > 5 minutes)
 * Should be called periodically by a background job
 */
export async function cleanupStaleSessions() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const deleted = await db
    .delete(cliSessions)
    .where(lt(cliSessions.lastHeartbeat, fiveMinutesAgo))
    .returning();

  return deleted.length;
}
