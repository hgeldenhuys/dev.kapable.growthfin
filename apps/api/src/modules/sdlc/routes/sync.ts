/**
 * SDLC Sync Route
 * Receives file change events from hooks and stores them in database for ElectricSQL sync
 */

import { Elysia, t } from 'elysia';
import { readSDLCFile } from '../services/file-scanner';
import { clearCache } from '../services/cache';
import type { FileChangeEvent, SDLCStreamEvent } from '../types';
import { db } from '@agios/db/client';
import { sdlcFiles, claudeSessions } from '@agios/db';

/**
 * Check if string contains binary data (null bytes or excessive non-printable chars)
 * Defense-in-depth: SDK filters by extension, but binary data can be embedded in text files
 */
function isBinaryContent(str: string): boolean {
  if (!str || str.length === 0) return false;
  // Null byte is definitive binary indicator
  if (str.includes('\u0000')) return true;
  // Check for non-printable chars (excluding common ones like newline, tab)
  const nonPrintable = str.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g);
  return nonPrintable !== null && nonPrintable.length > str.length * 0.1; // >10% non-printable
}

/**
 * Sanitize content by removing binary sequences
 * Keeps text readable while preventing PostgreSQL UTF-8 errors
 */
function sanitizeContent(str: string): string {
  if (!str) return str;
  // Remove null bytes and other problematic binary sequences
  return str
    .replace(/\u0000/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, ''); // Remove non-printable
}

/**
 * Determine category from file path
 */
function categorizeFilePath(filePath: string): SDLCStreamEvent['category'] {
  // Remove .claude/sdlc/ prefix if present
  const cleanPath = filePath.replace(/^\.claude\/sdlc\//, '');

  if (cleanPath.startsWith('stories/')) return 'stories';
  if (cleanPath.startsWith('epics/')) return 'epics';
  if (cleanPath.startsWith('kanban/')) return 'kanban';
  if (cleanPath.startsWith('knowledge/graph/')) return 'knowledgeGraph';
  if (cleanPath.startsWith('coherence/') || cleanPath.includes('coherence-check') || cleanPath.startsWith('audits/')) return 'coherence';
  if (cleanPath.startsWith('logs/retrospectives/')) return 'retrospectives';
  if (cleanPath.startsWith('backlog/')) return 'backlog';
  if (cleanPath.startsWith('prds/') || cleanPath.startsWith('prd/')) return 'prds';

  return 'unknown';
}

/**
 * Determine event type from operation
 */
function getEventType(operation: string): SDLCStreamEvent['type'] {
  switch (operation) {
    case 'created':
      return 'sdlc:file-created';
    case 'updated':
      return 'sdlc:file-updated';
    case 'deleted':
      return 'sdlc:file-deleted';
    default:
      return 'sdlc:file-updated';
  }
}

export const syncRoute = new Elysia()
  .post('/sync/snapshot', async ({ body, set }) => {
    console.log('[SDLC Sync] Received bulk snapshot upload request');

    try {
      const { sessionId, files } = body;

      if (!files || files.length === 0) {
        set.status = 400;
        return {
          error: 'No files provided',
          message: 'The files array must contain at least one file'
        };
      }

      console.log(`[SDLC Sync] Processing ${files.length} files for session ${sessionId}`);

      // Ensure session exists (upsert)
      try {
        await db.insert(claudeSessions).values({
          id: sessionId,
          projectId: '0ebfac28-1680-4ec1-a587-836660140055', // TODO: get from request
        }).onConflictDoNothing();
      } catch (error) {
        console.error('[SDLC Sync] Error creating session:', error);
        // Continue anyway - session might already exist
      }

      const results = [];
      const errors = [];

      // Process each file in the snapshot
      for (const file of files) {
        try {
          const category = categorizeFilePath(file.path);
          const relativePath = file.path.replace(/^\.claude\/sdlc\//, '');

          // Check for binary content - skip files with binary data
          if (isBinaryContent(file.content)) {
            console.warn(`[SDLC Sync] Skipping binary content in file: ${file.path}`);
            errors.push({
              path: file.path,
              error: 'File contains binary data (null bytes or non-printable characters)',
            });
            continue;
          }

          // Sanitize content to remove any stray binary sequences
          const sanitizedContent = sanitizeContent(file.content);

          // Insert into database
          await db.insert(sdlcFiles).values({
            sessionId,
            path: relativePath,
            category,
            operation: file.operation || 'updated',
            content: sanitizedContent,
            eventTimestamp: file.timestamp ? new Date(file.timestamp) : new Date(),
          });

          results.push({
            path: relativePath,
            category,
            operation: file.operation || 'updated',
            success: true,
          });
        } catch (error) {
          console.error(`[SDLC Sync] Error processing file ${file.path}:`, error);
          errors.push({
            path: file.path,
            error: String(error),
          });
        }
      }

      // Clear cache to force re-scan on next snapshot request
      clearCache();

      console.log(`[SDLC Sync] Bulk upload complete: ${results.length} succeeded, ${errors.length} failed`);

      return {
        success: errors.length === 0,
        processed: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error('[SDLC Sync] Error processing bulk snapshot:', error);
      set.status = 500;
      return {
        error: 'Failed to process bulk snapshot',
        message: String(error),
      };
    }
  }, {
    body: t.Object({
      sessionId: t.String(),
      files: t.Array(t.Object({
        path: t.String(),
        content: t.String(),
        operation: t.Optional(t.Union([t.Literal('created'), t.Literal('updated'), t.Literal('deleted')])),
        timestamp: t.Optional(t.String()),
      })),
    }),
    detail: {
      tags: ['SDLC'],
      summary: 'Upload complete SDLC snapshot',
      description: 'Bulk upload of multiple SDLC files for a session. Used for initial sync from filesystem.',
    },
  })
  .post('/sync', async ({ body, set }) => {
    console.log('[SDLC Sync] Received file change event:', body.filePath);

    try {
      const event = body as FileChangeEvent;

      // Determine category and event type
      const category = categorizeFilePath(event.filePath);
      const eventType = getEventType(event.operation);

      // Get relative path for reading
      const relativePath = event.filePath.replace(/^\.claude\/sdlc\//, '');

      // Read file content (unless deleted)
      let content: string | null = null;
      if (event.operation !== 'deleted') {
        try {
          const rawContent = await readSDLCFile(relativePath);
          if (rawContent && isBinaryContent(rawContent)) {
            console.warn(`[SDLC Sync] Skipping binary content in file: ${event.filePath}`);
            set.status = 400;
            return {
              error: 'File contains binary data',
              message: 'File contains null bytes or excessive non-printable characters',
            };
          }
          content = rawContent ? sanitizeContent(rawContent) : null;
        } catch (error) {
          console.error('[SDLC Sync] Error reading file:', error);
          // Continue without content - SSE clients will know file changed
        }
      }

      // Insert into database - ElectricSQL will automatically sync to web dashboard
      await db.insert(sdlcFiles).values({
        sessionId: event.sessionId,
        path: relativePath,
        category,
        operation: event.operation as 'created' | 'updated' | 'deleted',
        content,
        eventTimestamp: new Date(event.timestamp),
      });

      // Clear cache to force re-scan on next snapshot request
      clearCache();

      console.log('[SDLC Sync] Successfully stored file change:', eventType, relativePath);

      return {
        success: true,
        path: relativePath,
        category,
        operation: event.operation,
      };
    } catch (error) {
      console.error('[SDLC Sync] Error processing sync:', error);
      set.status = 500;
      return {
        error: 'Failed to process file sync',
        message: String(error),
      };
    }
  }, {
    body: t.Object({
      sessionId: t.String(),
      tool: t.Union([t.Literal('Write'), t.Literal('Edit'), t.Literal('MultiEdit')]),
      filePath: t.String(),
      operation: t.Union([t.Literal('created'), t.Literal('updated'), t.Literal('deleted')]),
      timestamp: t.String(),
    }),
    detail: {
      tags: ['SDLC'],
      summary: 'Sync file changes',
      description: 'Receives file change events from hooks SDK and broadcasts to SSE clients',
    },
  });
