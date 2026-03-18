/**
 * Search Routes (Phase O)
 * Unified full-text search across leads, contacts, and transcripts
 *
 * Features:
 * - Multi-entity search (leads, contacts, AI call transcripts)
 * - PostgreSQL full-text search with ts_rank
 * - Highlighting of matched terms
 * - Type filtering
 */

import { Elysia, t } from 'elysia';
import { sql, and, eq, or, desc } from 'drizzle-orm';
import { crmLeads, crmContacts, crmAiCalls } from '@agios/db';

export type SearchResultType = 'lead' | 'contact' | 'transcript';

/**
 * Helper to extract rows from db.execute() result
 * Handles both array (Bun/production) and object with rows property (Node.js/dev)
 */
function getRows(result: any): any[] {
  return Array.isArray(result) ? result : (result?.rows || []);
}

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  highlight?: string;
  metadata: Record<string, any>;
  rank: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  types: SearchResultType[];
}

export const searchRoutes = new Elysia({ prefix: '/search' })
  /**
   * GET / - Unified search endpoint
   */
  .get(
    '/',
    async ({ db, query: params, set }) => {
      const { q, types, workspaceId, limit = '20', offset = '0' } = params;

      if (!q || q.trim().length < 2) {
        set.status = 400;
        return { error: 'Search query must be at least 2 characters' };
      }

      // Parse search types
      const searchTypes: SearchResultType[] = types
        ? (types.split(',') as SearchResultType[])
        : ['lead', 'contact', 'transcript'];

      // Convert search query to tsquery format
      // Handle special characters and multiple words
      const searchTerms = q
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 0)
        .map((term) => term.replace(/[^a-z0-9]/g, ''))
        .filter((term) => term.length > 0);

      if (searchTerms.length === 0) {
        return { results: [], total: 0, query: q, types: searchTypes };
      }

      // Create tsquery with OR for partial matching
      const tsQueryString = searchTerms.map((term) => `${term}:*`).join(' | ');

      const results: SearchResult[] = [];
      const limitNum = parseInt(limit, 10);
      const offsetNum = parseInt(offset, 10);

      // Search leads
      if (searchTypes.includes('lead')) {
        const leadResults = await db.execute(sql`
          SELECT
            id,
            first_name,
            last_name,
            email,
            company_name,
            phone,
            status,
            ts_rank(search_vector, to_tsquery('english', ${tsQueryString})) as rank,
            ts_headline('english',
              COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' ||
              COALESCE(email, '') || ' ' || COALESCE(company_name, ''),
              to_tsquery('english', ${tsQueryString}),
              'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
            ) as headline
          FROM crm_leads
          WHERE
            workspace_id = ${workspaceId}
            AND search_vector @@ to_tsquery('english', ${tsQueryString})
            AND deleted_at IS NULL
          ORDER BY rank DESC
          LIMIT ${limitNum}
          OFFSET ${offsetNum}
        `);

        for (const row of getRows(leadResults)) {
          results.push({
            id: row.id,
            type: 'lead',
            title: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown Lead',
            subtitle: row.company_name || row.email || '',
            highlight: row.headline,
            rank: parseFloat(row.rank) || 0,
            metadata: {
              email: row.email,
              phone: row.phone,
              company: row.company_name,
              status: row.status,
            },
          });
        }
      }

      // Search contacts
      if (searchTypes.includes('contact')) {
        const contactResults = await db.execute(sql`
          SELECT
            id,
            first_name,
            last_name,
            email,
            phone,
            title,
            department,
            account_id,
            ts_rank(search_vector, to_tsquery('english', ${tsQueryString})) as rank,
            ts_headline('english',
              COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' ||
              COALESCE(email, '') || ' ' || COALESCE(department, ''),
              to_tsquery('english', ${tsQueryString}),
              'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
            ) as headline
          FROM crm_contacts
          WHERE
            workspace_id = ${workspaceId}
            AND search_vector @@ to_tsquery('english', ${tsQueryString})
            AND deleted_at IS NULL
          ORDER BY rank DESC
          LIMIT ${limitNum}
          OFFSET ${offsetNum}
        `);

        for (const row of getRows(contactResults)) {
          results.push({
            id: row.id,
            type: 'contact',
            title: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown Contact',
            subtitle: row.email || row.department || '',
            highlight: row.headline,
            rank: parseFloat(row.rank) || 0,
            metadata: {
              email: row.email,
              phone: row.phone,
              title: row.title,
              department: row.department,
              accountId: row.account_id,
            },
          });
        }
      }

      // Search AI call transcripts
      if (searchTypes.includes('transcript')) {
        const transcriptResults = await db.execute(sql`
          SELECT
            c.id,
            c.identified_entity_type,
            c.identified_entity_id,
            c.caller_phone_number,
            c.call_outcome,
            c.audio_seconds,
            c.created_at,
            c.transcript,
            ts_rank(c.transcript_vector, to_tsquery('english', ${tsQueryString})) as rank,
            ts_headline('english',
              COALESCE(c.transcript, ''),
              to_tsquery('english', ${tsQueryString}),
              'StartSel=<mark>, StopSel=</mark>, MaxWords=75, MinWords=25'
            ) as headline,
            CASE
              WHEN c.identified_entity_type = 'lead' THEN l.first_name
              WHEN c.identified_entity_type = 'contact' THEN ct.first_name
            END as entity_first_name,
            CASE
              WHEN c.identified_entity_type = 'lead' THEN l.last_name
              WHEN c.identified_entity_type = 'contact' THEN ct.last_name
            END as entity_last_name
          FROM crm_ai_calls c
          LEFT JOIN crm_leads l ON c.identified_entity_type = 'lead' AND c.identified_entity_id = l.id
          LEFT JOIN crm_contacts ct ON c.identified_entity_type = 'contact' AND c.identified_entity_id = ct.id
          WHERE
            c.workspace_id = ${workspaceId}
            AND c.transcript_vector @@ to_tsquery('english', ${tsQueryString})
            AND c.transcript IS NOT NULL
          ORDER BY rank DESC
          LIMIT ${limitNum}
          OFFSET ${offsetNum}
        `);

        for (const row of getRows(transcriptResults)) {
          const entityName = row.entity_first_name
            ? `${row.entity_first_name} ${row.entity_last_name}`.trim()
            : row.caller_phone_number || 'Unknown';

          const createdAt = new Date(row.created_at);
          const timeAgo = getTimeAgo(createdAt);

          results.push({
            id: row.id,
            type: 'transcript',
            title: `Call with ${entityName}`,
            subtitle: `${timeAgo} - ${row.call_outcome || 'unknown outcome'}`,
            highlight: row.headline,
            rank: parseFloat(row.rank) || 0,
            metadata: {
              entityType: row.identified_entity_type,
              entityId: row.identified_entity_id,
              phoneNumber: row.caller_phone_number,
              outcome: row.call_outcome,
              audioSeconds: row.audio_seconds,
              createdAt: row.created_at,
            },
          });
        }
      }

      // Sort all results by rank
      results.sort((a, b) => b.rank - a.rank);

      return {
        results: results.slice(0, limitNum),
        total: results.length,
        query: q,
        types: searchTypes,
      };
    },
    {
      query: t.Object({
        q: t.String({ description: 'Search query' }),
        types: t.Optional(t.String({ description: 'Comma-separated types: lead,contact,transcript' })),
        workspaceId: t.String({ description: 'Workspace ID' }),
        limit: t.Optional(t.String({ description: 'Results limit (default 20)' })),
        offset: t.Optional(t.String({ description: 'Results offset (default 0)' })),
      }),
      detail: {
        tags: ['Search'],
        summary: 'Unified search',
        description: 'Search across leads, contacts, and AI call transcripts',
      },
    }
  )

  /**
   * GET /suggestions - Get search suggestions (autocomplete)
   */
  .get(
    '/suggestions',
    async ({ db, query: params, set }) => {
      const { q, workspaceId, limit = '10' } = params;

      if (!q || q.trim().length < 1) {
        return { suggestions: [] };
      }

      const searchTerm = q.trim().toLowerCase();
      const limitNum = parseInt(limit, 10);

      // Get suggestions from leads
      const leadSuggestions = await db.execute(sql`
        SELECT DISTINCT
          COALESCE(first_name || ' ' || last_name, email) as suggestion,
          'lead' as type
        FROM crm_leads
        WHERE
          workspace_id = ${workspaceId}
          AND deleted_at IS NULL
          AND (
            LOWER(first_name) LIKE ${searchTerm + '%'}
            OR LOWER(last_name) LIKE ${searchTerm + '%'}
            OR LOWER(email) LIKE ${searchTerm + '%'}
            OR LOWER(company_name) LIKE ${searchTerm + '%'}
          )
        LIMIT ${Math.ceil(limitNum / 2)}
      `);

      // Get suggestions from contacts
      const contactSuggestions = await db.execute(sql`
        SELECT DISTINCT
          COALESCE(first_name || ' ' || last_name, email) as suggestion,
          'contact' as type
        FROM crm_contacts
        WHERE
          workspace_id = ${workspaceId}
          AND deleted_at IS NULL
          AND (
            LOWER(first_name) LIKE ${searchTerm + '%'}
            OR LOWER(last_name) LIKE ${searchTerm + '%'}
            OR LOWER(email) LIKE ${searchTerm + '%'}
          )
        LIMIT ${Math.ceil(limitNum / 2)}
      `);

      const suggestions = [
        ...getRows(leadSuggestions).map((r) => ({ text: r.suggestion, type: r.type })),
        ...getRows(contactSuggestions).map((r) => ({ text: r.suggestion, type: r.type })),
      ]
        .filter((s) => s.text)
        .slice(0, limitNum);

      return { suggestions };
    },
    {
      query: t.Object({
        q: t.String({ description: 'Partial search query for autocomplete' }),
        workspaceId: t.String({ description: 'Workspace ID' }),
        limit: t.Optional(t.String({ description: 'Max suggestions (default 10)' })),
      }),
      detail: {
        tags: ['Search'],
        summary: 'Search suggestions',
        description: 'Get autocomplete suggestions for search',
      },
    }
  );

/**
 * Helper function to format time ago
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks ago`;
  return `${Math.floor(seconds / 2592000)} months ago`;
}
