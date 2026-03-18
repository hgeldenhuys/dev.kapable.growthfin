/**
 * Code Search Routes
 * API endpoints for ripgrep-based code search
 */

import { Elysia, t } from 'elysia';
import { Pool } from 'pg';
import { CodeSearchService } from '../services/code-search.service';
import { CliStatusService } from '../../cli/services/cli-status.service';

// PostgreSQL connection pool for SSE streaming
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Validate UUID format (lenient - accepts any valid UUID structure)
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export const codeSearchRoutes = new Elysia({
  prefix: '/workspaces/:workspaceId/code-search',
})
  /**
   * GET /workspaces/:workspaceId/code-search/debug/concurrent-count
   * Get current concurrent search count (for testing/debugging)
   */
  .get(
    '/debug/concurrent-count',
    ({ params }) => {
      const { workspaceId } = params;
      const count = CodeSearchService.getConcurrentCount(workspaceId);
      return {
        workspaceId,
        currentCount: count,
        maxLimit: 10,
      };
    },
    {
      params: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Code Search'],
        summary: 'Get concurrent search count',
        description: 'Debug endpoint to check current concurrent search count for a workspace',
      },
    }
  )

  /**
   * POST /workspaces/:workspaceId/code-search/debug/reset-limits
   * Reset rate limits and concurrent counters (for testing)
   */
  .post(
    '/debug/reset-limits',
    () => {
      CodeSearchService.resetRateLimits();
      return {
        success: true,
        message: 'Rate limits and concurrent counters reset',
      };
    },
    {
      detail: {
        tags: ['Code Search'],
        summary: 'Reset rate limits',
        description: 'Debug endpoint to reset rate limits and concurrent counters (for testing)',
      },
    }
  )

  /**
   * POST /workspaces/:workspaceId/code-search
   * Create a new code search request
   */
  .post(
    '/',
    async ({ params, body, query, set }) => {
      try {
        const { workspaceId } = params;

        // Validate workspace UUID format first
        if (!isValidUUID(workspaceId)) {
          set.status = 400;
          return {
            error: 'INVALID_WORKSPACE_ID',
            message: 'Workspace ID must be a valid UUID',
          };
        }

        // TODO: Get userId from authenticated session
        const userId = query.userId || 'test-user-id';

        // Check if CLI is connected
        // Note: CLI sessions are tracked by projectId, using workspaceId as projectId for now
        const isConnected = await CliStatusService.isCliConnected(workspaceId);

        if (!isConnected) {
          set.status = 503;
          return {
            error: 'NO_CLI_CONNECTED',
            message: 'No CLI connected to this workspace',
          };
        }

        // Create search request
        const result = await CodeSearchService.createSearch(
          workspaceId,
          userId,
          {
            query: body.query,
            caseSensitive: body.caseSensitive,
            filePattern: body.filePattern,
            contextLines: body.contextLines,
            maxResults: body.maxResults,
          },
          isConnected
        );

        if (result.error) {
          // Determine status code based on error type
          if (result.error === 'NO_CLI_CONNECTED') {
            set.status = 503;
          } else if (result.error.includes('Rate limit')) {
            set.status = 429;
          } else if (result.error.includes('Concurrent')) {
            set.status = 429;
          } else {
            set.status = 400;
          }

          return {
            error: result.error,
            message: result.error,
          };
        }

        // Return search ID and SSE URL
        return {
          searchId: result.searchId,
          sseUrl: `/api/v1/ai-assistant/workspaces/${workspaceId}/code-search/${result.searchId}/sse`,
        };
      } catch (error) {
        console.error('[POST /code-search] Error:', error);
        set.status = 500;
        return {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      params: t.Object({
        workspaceId: t.String({ description: 'Workspace ID' }),
      }),
      query: t.Object({
        userId: t.Optional(t.String({ description: 'User ID (temporary, will use auth)' })),
      }),
      body: t.Object({
        query: t.String({
          minLength: 1,
          maxLength: 500,
          description: 'Search query (substring or regex pattern)',
        }),
        caseSensitive: t.Optional(
          t.Boolean({
            description: 'Whether to perform case-sensitive search',
            default: false,
          })
        ),
        filePattern: t.Optional(
          t.String({
            description: "Glob pattern for files to search (e.g., '*.{ts,tsx}' or '*.md')",
            default: '*.{ts,tsx,js,jsx,md,json,yaml,yml}',
          })
        ),
        contextLines: t.Optional(
          t.Number({
            minimum: 0,
            maximum: 5,
            description: 'Number of context lines before and after match',
            default: 0,
          })
        ),
        maxResults: t.Optional(
          t.Number({
            minimum: 1,
            maximum: 1000,
            description: 'Maximum number of results to return',
            default: 500,
          })
        ),
      }),
      detail: {
        tags: ['Code Search'],
        summary: 'Create code search request',
        description:
          'Create a new code search request. Returns searchId for tracking results via SSE.',
      },
    }
  )

  /**
   * GET /workspaces/:workspaceId/code-search/:searchId/sse
   * Stream search results via Server-Sent Events
   */
  .get(
    '/:searchId/sse',
    async function* ({ params, set }) {
      // DEBUG: Log at the very start to confirm handler is called
      const debugPrefix = `[code-search/sse ${params.searchId?.substring(0, 8)}]`;
      console.log(`${debugPrefix} *** SSE HANDLER CALLED ***`, { params });

      const { workspaceId, searchId } = params;

      // Validate UUID formats first
      if (!isValidUUID(workspaceId)) {
        set.status = 400;
        yield `data: ${JSON.stringify({
          type: 'error',
          error: 'INVALID_WORKSPACE_ID',
          message: 'Workspace ID must be a valid UUID',
        })}\n\n`;
        return;
      }

      if (!isValidUUID(searchId)) {
        set.status = 400;
        yield `data: ${JSON.stringify({
          type: 'error',
          error: 'INVALID_SEARCH_ID',
          message: 'Search ID must be a valid UUID',
        })}\n\n`;
        return;
      }

      // Check if CLI is connected
      const isConnected = await CliStatusService.isCliConnected(workspaceId);
      if (!isConnected) {
        set.status = 503;
        yield `data: ${JSON.stringify({
          type: 'error',
          error: 'NO_CLI_CONNECTED',
          message: 'No CLI connected to this workspace',
        })}\n\n`;
        return;
      }

      // Set SSE headers - match working pattern exactly
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(
        `[code-search/sse] Starting stream for search ${searchId} in workspace ${workspaceId}`
      );

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      // Get a dedicated PostgreSQL connection for LISTEN
      const client = await pool.connect();

      try {
        // Listen for code search results
        const channelName = `code_search_${searchId}`;
        await client.query(`LISTEN "${channelName}"`);

        console.log(`[code-search/sse] Listening for channel: ${channelName}`);

        // Create async iterator for notifications
        const notificationQueue: string[] = [];
        let resolveNext: ((value: string) => void) | null = null;
        let isComplete = false;

        client.on('notification', (msg) => {
          if (msg.channel === channelName && msg.payload) {
            try {
              const event = JSON.parse(msg.payload);

              console.log(`[code-search/sse] Received event:`, {
                type: event.type,
                searchId,
                dataLength: event.type === 'results_batch' && Array.isArray(event.data) ? event.data.length : undefined,
              });

              // Handle results_batch event - expand into individual result events
              if (event.type === 'results_batch' && Array.isArray(event.data)) {
                console.log(`[code-search/sse] Expanding batch of ${event.data.length} results`);

                for (const result of event.data) {
                  const resultEvent = {
                    type: 'result',
                    data: result,
                    timestamp: event.timestamp,
                  };
                  const sseMessage = `data: ${JSON.stringify(resultEvent)}\n\n`;

                  if (resolveNext) {
                    resolveNext(sseMessage);
                    resolveNext = null;
                  } else {
                    notificationQueue.push(sseMessage);
                  }
                }
              } else {
                // Format SSE message for other event types
                const sseMessage = `data: ${JSON.stringify(event)}\n\n`;

                // Check if this is the complete event
                if (event.type === 'complete' || event.type === 'error') {
                  isComplete = true;
                  // Decrement concurrent counter
                  CodeSearchService.markSearchComplete(workspaceId);
                }

                if (resolveNext) {
                  resolveNext(sseMessage);
                  resolveNext = null;
                } else {
                  notificationQueue.push(sseMessage);
                }
              }
            } catch (parseError) {
              console.error('[code-search/sse] Error parsing notification:', parseError);
            }
          }
        });

        // Heartbeat interval (every 5 seconds)
        const heartbeatInterval = setInterval(() => {
          const heartbeat = `: heartbeat at ${new Date().toISOString()}\n\n`;
          if (resolveNext) {
            resolveNext(heartbeat);
            resolveNext = null;
          } else {
            notificationQueue.push(heartbeat);
          }
        }, 5000);

        // Timeout after 15 seconds if no results
        const timeoutMs = 15000;
        const timeoutTimer = setTimeout(() => {
          if (!isComplete) {
            const timeoutEvent = {
              type: 'error',
              error: 'TIMEOUT',
              message: 'Search timed out after 15 seconds',
              timestamp: new Date().toISOString(),
            };
            const sseMessage = `data: ${JSON.stringify(timeoutEvent)}\n\n`;

            if (resolveNext) {
              resolveNext(sseMessage);
              resolveNext = null;
            } else {
              notificationQueue.push(sseMessage);
            }

            isComplete = true;
            CodeSearchService.markSearchComplete(workspaceId);
          }
        }, timeoutMs);

        // Stream notifications
        try {
          while (true) {
            // First, drain the notification queue completely
            while (notificationQueue.length > 0) {
              const message = notificationQueue.shift();
              if (message) {
                yield message;
              }
            }

            // Check if we're complete AFTER draining the queue
            if (isComplete) {
              break;
            }

            // Wait for next notification
            const message = await new Promise<string>((resolve) => {
              resolveNext = resolve;
            });
            yield message;

            // Check again if this message marked us complete
            if (isComplete) {
              // Drain any remaining messages that arrived while we were yielding
              while (notificationQueue.length > 0) {
                const msg = notificationQueue.shift();
                if (msg) {
                  yield msg;
                }
              }
              break;
            }
          }

          // Send final empty line to close connection gracefully
          yield '\n';
        } finally {
          clearInterval(heartbeatInterval);
          clearTimeout(timeoutTimer);
        }
      } catch (error) {
        console.error('[code-search/sse] Error:', error);
        yield `data: ${JSON.stringify({
          type: 'error',
          error: 'STREAM_ERROR',
          message: String(error),
          timestamp: new Date().toISOString(),
        })}\n\n`;
        CodeSearchService.markSearchComplete(workspaceId);
      } finally {
        // Cleanup
        try {
          const channelName = `code_search_${searchId}`;
          await client.query(`UNLISTEN "${channelName}"`);
        } catch (e) {
          console.error('[code-search/sse] Error unlistening:', e);
        }
        client.release();
        console.log('[code-search/sse] Connection closed');
      }
    },
    {
      params: t.Object({
        workspaceId: t.String({ description: 'Workspace ID' }),
        searchId: t.String({ description: 'Search ID from POST request' }),
      }),
      detail: {
        tags: ['Code Search'],
        summary: 'Stream search results',
        description:
          'Stream code search results via Server-Sent Events. Results are sent as they are found.',
      },
    }
  );
