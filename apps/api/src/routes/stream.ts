/**
 * Generic SSE Stream Routes
 *
 * Multiplexed SSE endpoint that can stream any table via SignalDB real-time.
 * Replaces the need for separate /workspaces/stream, /personas/stream, etc.
 *
 * Query Parameters:
 * - table: Table name (required)
 * - where: SQL where clause (optional)
 * - columns: Comma-separated column list (optional)
 */

import { Elysia, t } from 'elysia';
import { createSignalDBStream } from '../lib/signaldb-stream';

// Whitelist of allowed tables for security
const ALLOWED_TABLES = [
  // Observability tables
  'workspaces',
  'projects',
  'claude_sessions',
  'chat_messages',
  'event_summaries',
  'hook_events',
  'audio_cache', // Audio generation events

  // CRM tables (added in TWEAK-002)
  'crm_leads',
  'crm_contacts',
  'crm_accounts',
  'crm_opportunities',
  'crm_activities',
  'crm_contact_lists',
  'crm_timeline_events', // Timeline events for contact history
  'crm_batches', // Batch execution progress tracking (US-014)
  'work_items', // Work items for batch/task semantic separation (US-014)

  // CRM enrichment tables (Sprint 4 - AI enrichment)
  'crm_enrichment_jobs',
  'crm_enrichment_results',
  'crm_tool_calls',
  'crm_scoring_models',
  'crm_enrichment_ab_tests',
  'crm_enrichment_pipelines',
  'crm_pipeline_stages',

  // Lead enrichment tables (US-LEAD-AI-009)
  'lead_enrichments',
  'lead_enrichment_configs',

  // Job logging tables (US-008)
  'job_logs',

  // Compliance tables
  'kyc_records',
  'consent_records',
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];

export const streamRoutes = new Elysia({ prefix: '/stream', tags: ['Streaming'] })
  /**
   * GET /stream - Generic multiplexed SSE endpoint
   *
   * Examples:
   *   GET /api/v1/stream?table=workspaces
   *   GET /api/v1/stream?table=hook_events&where=agent_type='Explore'
   *   GET /api/v1/stream?table=claude_sessions&ids=id1,id2,id3
   *   GET /api/v1/stream?table=claude_sessions&where=project_id='abc'&columns=id,currentAgentType
   */
  .get('/', async function* ({ query, set }) {
    const { table, where, columns, ids } = query;

    // Validate table parameter
    if (!table) {
      set.status = 400;
      yield `data: ${JSON.stringify({ error: 'Missing required parameter: table' })}\n\n`;
      return;
    }

    if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
      set.status = 400;
      yield `data: ${JSON.stringify({
        error: 'Invalid table',
        allowed: ALLOWED_TABLES
      })}\n\n`;
      return;
    }

    // Set SSE headers
    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';

    const subscriptionTimestamp = new Date();

    // Build WHERE clause from ids parameter if provided
    let finalWhere = where;
    if (ids) {
      const idList = ids.split(',').map(id => `'${id.trim()}'`).join(',');
      const idsWhere = `id IN (${idList})`;
      finalWhere = where ? `(${where}) AND (${idsWhere})` : idsWhere;
    }

    console.log(`[stream] Starting SSE for table=${table}, where=${finalWhere || 'none'}, ids=${ids || 'none'}, columns=${columns || 'all'} at ${subscriptionTimestamp.toISOString()}`);

    // Send initial connection confirmation
    yield `: connected to ${table} at ${subscriptionTimestamp.toISOString()}\n\n`;

    try {
      // Parse columns if provided
      const columnList = columns ? columns.split(',').map(c => c.trim()) : undefined;

      // Create SignalDB stream
      const signalStream = createSignalDBStream({
        table,
        where: finalWhere,
        columns: columnList,
        subscriptionTimestamp,
      });

      // Stream updates
      for await (const sseMessage of signalStream.stream()) {
        yield sseMessage;
      }
    } catch (error) {
      console.error(`[stream] Error streaming ${table}:`, error);
      yield `data: ${JSON.stringify({
        error: 'Stream error',
        table,
        message: String(error)
      })}\n\n`;
    }
  }, {
    query: t.Object({
      table: t.String({ description: 'Table name to stream' }),
      where: t.Optional(t.String({ description: 'SQL WHERE clause' })),
      ids: t.Optional(t.String({ description: 'Comma-separated ID list to filter by' })),
      columns: t.Optional(t.String({ description: 'Comma-separated column list' })),
    }),
  });
