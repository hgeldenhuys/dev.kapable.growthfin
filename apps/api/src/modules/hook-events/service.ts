/**
 * Hook Events Service
 * Business logic for hook event operations
 */

import type { Database } from '@agios/db';
import { hookEvents, claudeSessions, projects, type NewHookEvent } from '@agios/db';
import { desc, eq, isNull, gt, gte, and, sql } from 'drizzle-orm';
import { jobQueue } from '../../lib/queue';
import { todoService } from '../todos/service';
import { tagsService } from '../ai-assistant/services/tags.service';
import { appendFileSync } from 'fs';
import { join } from 'path';

/**
 * Log binary data detection to file for debugging
 */
function logBinaryDetection(context: string, data: any, path: string[] = []) {
  try {
    const logFile = join(process.cwd(), 'logs', 'binary-detection.log');
    const timestamp = new Date().toISOString();
    const pathStr = path.length > 0 ? ` at ${path.join('.')}` : '';
    const preview = typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data).substring(0, 200);

    appendFileSync(
      logFile,
      `[${timestamp}] ${context}${pathStr}\n` +
      `  Length: ${typeof data === 'string' ? data.length : JSON.stringify(data).length} bytes\n` +
      `  Preview: ${preview}\n` +
      `  Has null byte: ${typeof data === 'string' && data.includes('\u0000')}\n\n`,
      'utf-8'
    );
  } catch (error) {
    // Don't let logging failures break the service
    console.error('[Binary Detection] Failed to write log:', error);
  }
}

/**
 * Check if string contains binary data (null bytes or excessive non-printable chars)
 */
function isBinaryContent(str: string): boolean {
  if (str.includes('\u0000')) return true; // Null byte
  const nonPrintable = str.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g);
  return nonPrintable && nonPrintable.length > str.length * 0.1; // >10% non-printable
}

/**
 * Sanitize payload to remove binary data before database insertion
 * Prevents PostgreSQL UTF-8 encoding errors
 */
function sanitizePayload(obj: any, path: string[] = []): any {
  if (typeof obj === 'string') {
    if (isBinaryContent(obj)) {
      logBinaryDetection('Binary content detected in payload', obj, path);
      return `[Binary content removed, ${obj.length} bytes]`;
    }
    // Also truncate extremely long strings to prevent bloat
    return obj.length > 50000 ? obj.substring(0, 50000) + '... [truncated]' : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item, index) => sanitizePayload(item, [...path, `[${index}]`]));
  }
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizePayload(value, [...path, key]);
    }
    return sanitized;
  }
  return obj;
}

export const hookEventService = {
  async list(db: Database, options: { limit: number; offset: number }) {
    return db
      .select()
      .from(hookEvents)
      .orderBy(desc(hookEvents.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  },

  async listUnprocessed(db: Database, options: { limit: number; offset: number }) {
    return db
      .select()
      .from(hookEvents)
      .where(isNull(hookEvents.processedAt))
      .orderBy(desc(hookEvents.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  },

  async create(db: Database, data: NewHookEvent) {
    // Record when API received the request
    const receivedAt = new Date();

    // Sanitize ALL fields, not just payload - binary data can leak through any text field
    const sanitizedData = {
      ...data,
      eventName: typeof data.eventName === 'string' ? sanitizePayload(data.eventName) : data.eventName,
      toolName: typeof data.toolName === 'string' ? sanitizePayload(data.toolName) : data.toolName,
      sessionId: typeof data.sessionId === 'string' ? sanitizePayload(data.sessionId) : data.sessionId,
      projectId: typeof data.projectId === 'string' ? sanitizePayload(data.projectId) : data.projectId,
      payload: sanitizePayload(data.payload),
      tags: Array.isArray(data.tags) ? data.tags.map(tag => typeof tag === 'string' ? sanitizePayload(tag) : tag) : data.tags,
    };

    // Extract agent type from Task tool payload
    let agentType: string | null = null;
    if (sanitizedData.toolName === 'Task') {
      const payload = sanitizedData.payload as any;
      if (payload?.event?.tool_input?.subagent_type) {
        agentType = payload.event.tool_input.subagent_type;
      }
    }

    let event;
    try {
      const results = await db.insert(hookEvents).values({
        ...sanitizedData,
        agentType,
        receivedAt,
      }).returning();
      event = results[0];
    } catch (error) {
      // Log database insertion error with full context
      const logFile = join(process.cwd(), 'logs', 'binary-detection.log');
      const timestamp = new Date().toISOString();

      // Log which field contained binary data
      let binaryFieldAnalysis = '';
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && isBinaryContent(value)) {
          binaryFieldAnalysis += `  BINARY in field "${key}": ${value.substring(0, 100)}\n`;
        }
      }

      appendFileSync(
        logFile,
        `[${timestamp}] DATABASE INSERT ERROR\n` +
        `  Event: ${typeof data.eventName === 'string' ? data.eventName.substring(0, 50) : data.eventName}\n` +
        `  Tool: ${data.toolName || 'N/A'}\n` +
        `  Session: ${typeof data.sessionId === 'string' ? data.sessionId.substring(0, 50) : data.sessionId}\n` +
        `  Project: ${typeof data.projectId === 'string' ? data.projectId.substring(0, 50) : data.projectId}\n` +
        `  Error: ${error instanceof Error ? error.message : String(error)}\n` +
        `  Binary field analysis:\n${binaryFieldAnalysis || '  (No binary fields detected)'}\n` +
        `  Stack: ${error instanceof Error ? error.stack : 'N/A'}\n\n`,
        'utf-8'
      );
      throw error; // Re-throw to maintain existing error handling
    }

    // AC-008: Update tags table if tags present (fire-and-forget)
    if (event.tags && event.tags.length > 0) {
      tagsService.upsertTags(db, event.tags).catch((error) => {
        console.error(`[HookEventService] Failed to upsert tags for event ${event.id}:`, error);
      });
    }

    // Trigger jobs based on event type (fire-and-forget, don't await)
    this.triggerJobs(db, event).catch((error) => {
      console.error(`Failed to trigger jobs for event ${event.id}:`, error);
    });

    return event;
  },

  /**
   * Trigger background jobs for an event
   */
  async triggerJobs(db: Database, event: typeof hookEvents.$inferSelect) {
    const { id, sessionId, projectId, eventName, toolName, payload } = event;

    // Note: No longer updating queuedAt to keep hook_events immutable (INSERT-only)
    // Performance metrics can be tracked elsewhere if needed

    // 0. Create session if SessionStart event
    if (eventName === 'SessionStart') {
      try {
        const sessionData = payload as any;
        const cwd = sessionData?.event?.cwd || sessionData?.conversation?.cwd || '/';
        const gitBranch = sessionData?.conversation?.gitBranch || 'unknown';

        // 0a. Ensure project exists (auto-create if needed)
        const existingProject = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

        if (!existingProject || existingProject.length === 0) {
          // Get the first workspace (or create one if none exist)
          // TODO: In the future, map projects to specific workspaces based on user/team
          const workspaces = await db.query.workspaces.findFirst();

          if (workspaces) {
            // Extract git details from session payload (top level of payload)
            const eventData = payload as any;
            const gitRepo = eventData?.gitRepo || null;
            const machineHost = eventData?.machineHost || null;
            const gitUser = eventData?.gitUser || null;
            const gitBranch = eventData?.gitBranch || null;

            // Create the project with git details if available
            await db.insert(projects).values({
              id: projectId,
              name: gitRepo || `Project ${projectId.slice(0, 8)}`, // Use git repo name if available
              workspaceId: workspaces.id,
              gitRepo,
              machineHost,
              gitUser,
              gitBranch,
            }).onConflictDoNothing();

            console.log(`✅ Auto-created project ${projectId}${gitRepo ? ` (${gitRepo})` : ''}`);
          }
        } else {
          // Project exists - update git details if provided in payload
          const eventData = payload as any;
          const gitRepo = eventData?.gitRepo;
          const machineHost = eventData?.machineHost;
          const gitUser = eventData?.gitUser;
          const gitBranch = eventData?.gitBranch;

          // Only update if we have git details in the payload
          if (gitRepo || machineHost || gitUser || gitBranch) {
            await db.update(projects)
              .set({
                name: gitRepo || existingProject[0].name,
                gitRepo: gitRepo || existingProject[0].gitRepo,
                machineHost: machineHost || existingProject[0].machineHost,
                gitUser: gitUser || existingProject[0].gitUser,
                gitBranch: gitBranch || existingProject[0].gitBranch,
                updatedAt: new Date(),
              })
              .where(eq(projects.id, projectId));

            console.log(`✅ Updated project ${projectId} with git details${gitRepo ? ` (${gitRepo})` : ''}`);
          }
        }

        // 0b. Extract agent type from session metadata (default to 'main')
        const sessionMetadata = sessionData?.event?.metadata || sessionData?.metadata || {};
        const agentType = sessionMetadata.agentType || 'main';

        // 0c. Create session with agent type
        await db.insert(claudeSessions).values({
          id: sessionId,
          projectId,
          currentAgentType: agentType,
          createdAt: new Date(),
        }).onConflictDoNothing();

        console.log(`✅ Created session ${sessionId} for project ${projectId} with agent type '${agentType}'`);

        // 0d. Find previous session for this project+agent to migrate todos
        const previousSessions = await db
          .select({ id: claudeSessions.id })
          .from(claudeSessions)
          .where(
            and(
              eq(claudeSessions.projectId, projectId),
              eq(claudeSessions.currentAgentType, agentType)
            )
          )
          .orderBy(desc(claudeSessions.createdAt))
          .limit(2); // Get current + previous

        // The second one is the previous session (first is the one we just created)
        const previousSessionId = previousSessions.length > 1 ? previousSessions[1].id : undefined;

        // 0e. Trigger todo migration
        try {
          const migratedTodos = await todoService.startSession(
            db,
            sessionId,
            projectId,
            agentType,
            previousSessionId
          );

          if (migratedTodos.length > 0) {
            console.log(`✅ Migrated ${migratedTodos.length} todos from previous session to ${sessionId}`);
          } else {
            console.log(`ℹ️ No todos to migrate for session ${sessionId}`);
          }
        } catch (migrationError) {
          console.error(`❌ Failed to migrate todos for session ${sessionId}:`, migrationError);
          // Don't throw - session creation succeeded, migration failure is non-critical
        }
      } catch (error) {
        console.error(`❌ Failed to create session ${sessionId}:`, error);
      }
    }

    // 1. Always summarize the event
    await jobQueue.send('summarize-event', {
      hookEventId: id,
      sessionId,
      projectId,
      eventName,
    });

    // 2. Extract todos if TodoWrite event
    if (eventName === 'PostToolUse' && toolName === 'TodoWrite') {
      await jobQueue.send('extract-todos', {
        hookEventId: id,
        sessionId,
        projectId,
      });
    }

    // 3. Create chat messages for Stop/UserPromptSubmit
    if (eventName === 'Stop' || eventName === 'UserPromptSubmit') {
      await jobQueue.send('create-chat-messages', {
        hookEventId: id,
        sessionId,
        projectId,
        transactionId: event.transactionId || null,
        eventName: eventName as 'Stop' | 'UserPromptSubmit',
      });
    }

    // 4. Generate audio for Stop/UserPromptSubmit (for CLI listen command)
    if (eventName === 'Stop' || eventName === 'UserPromptSubmit') {
      // Note: Audio generation is handled via /speak endpoint which calls audioService.getAudio()
      // The audioService will check cache and queue generate-audio job if needed
      // We don't trigger it here because:
      // 1. It would duplicate work (CLI already calls /speak)
      // 2. We want cache-first behavior (don't generate if already cached)
      // 3. Voice settings might vary per request
      //
      // However, for better UX we could optionally pre-generate with default voice:
      // await jobQueue.send('generate-audio', { hookEventId: id });
    }

    // 5. Generate todo title on UserPromptSubmit (if todos exist and hash changed)
    if (eventName === 'UserPromptSubmit') {
      // Title generation will be triggered by the extract-todos worker
      // when it detects a hash change
      await jobQueue.send('generate-todo-title', {
        sessionId,
        projectId,
        userPromptSubmitEventId: id,
      });
    }
  },

  // markAsProcessed removed to maintain hook_events immutability (INSERT-only)
  // Performance tracking should be done in a separate table if needed

  /**
   * Get a single hook event by ID
   */
  async getById(db: Database, id: string) {
    const results = await db
      .select()
      .from(hookEvents)
      .where(eq(hookEvents.id, id))
      .limit(1);

    return results.length > 0 ? results[0] : null;
  },

  /**
   * Get recent events (last N seconds)
   * Used for initial state in Electric-SQL pattern
   * AC-001, AC-004, AC-005: Support tag filtering with GIN index
   */
  async listRecent(db: Database, options: { seconds: number; projectId?: string; agentType?: string; tag?: string }) {
    const since = new Date(Date.now() - options.seconds * 1000);

    const conditions = [gte(hookEvents.createdAt, since)];

    // AC-004: Tag takes precedence over projectId
    if (options.tag) {
      // AC-005: Use GIN index for tag containment query
      conditions.push(sql`${options.tag} = ANY(${hookEvents.tags})`);
      // If both tag and projectId are provided, still filter by tag only (tag takes precedence)
    } else if (options.projectId) {
      // Only filter by projectId if tag is not provided
      conditions.push(eq(hookEvents.projectId, options.projectId));
    }

    // If agentType is provided and not "_", filter by agent type
    if (options.agentType && options.agentType !== '_') {
      conditions.push(eq(hookEvents.agentType, options.agentType));
    }

    // Return all matching events
    return db
      .select()
      .from(hookEvents)
      .where(and(...conditions))
      .orderBy(desc(hookEvents.createdAt));
  },

  /**
   * Get events after a specific timestamp
   * Used for delta streaming in Electric-SQL pattern
   */
  async listAfterTimestamp(db: Database, options: { timestamp: Date; projectId?: string }) {
    const conditions = [gt(hookEvents.createdAt, options.timestamp)];

    // Optional project filter
    if (options.projectId) {
      conditions.push(eq(hookEvents.projectId, options.projectId));
    }

    return db
      .select()
      .from(hookEvents)
      .where(and(...conditions))
      .orderBy(hookEvents.createdAt); // ascending for chronological stream
  },
};
