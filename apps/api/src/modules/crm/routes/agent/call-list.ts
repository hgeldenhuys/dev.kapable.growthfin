/**
 * Agent Call List Routes
 * REST endpoint for agent priority call list with CQRS pattern
 * US-AGENT-001: Priority Call List with Real-time Updates
 */

import { Elysia, t } from 'elysia';
import { db as database } from '@agios/db';
import { crmLeads, crmContacts, crmAccounts, crmCampaigns, crmActivities } from '@agios/db';
import { eq, and, or, isNull, lte, gte, desc, asc, sql, inArray, ilike } from 'drizzle-orm';
import { streamLeads } from '../../../../lib/electric-shapes';

/**
 * Priority sorting tiers for agent call list:
 * 1. Callbacks due today (callback_date <= today AND status = 'contacted')
 * 2. High propensity score (score >= 80)
 * 3. Medium propensity score (score 50-79)
 * 4. Low propensity score (score < 50)
 *
 * Within each tier:
 * - Callbacks first (soonest callback_date)
 * - Then by score (highest first)
 * - Then by created date (newest first)
 */

export const agentCallListRoutes = new Elysia({ prefix: '/agent' })
  .get(
    '/call-list',
    async ({ query }) => {
      const { workspaceId, userId, status, campaignId, minScore, search, limit = 50, offset = 0 } = query;

      // Build where conditions
      const conditions = [
        eq(crmLeads.workspaceId, workspaceId),
        eq(crmLeads.ownerId, userId), // Only show leads assigned to this agent
        isNull(crmLeads.deletedAt), // Exclude soft deleted
      ];

      // Filter by status (only show active leads)
      if (status) {
        conditions.push(eq(crmLeads.status, status));
      } else {
        // Default: only show new, contacted, and qualified leads
        conditions.push(inArray(crmLeads.status, ['new', 'contacted', 'qualified']));
      }

      // Filter by campaign
      if (campaignId) {
        conditions.push(eq(crmLeads.campaignId, campaignId));
      }

      // Search by name, company, or email across lead and joined tables
      if (search) {
        const searchPattern = `%${search}%`;
        conditions.push(
          or(
            ilike(crmLeads.firstName, searchPattern),
            ilike(crmLeads.lastName, searchPattern),
            ilike(crmLeads.companyName, searchPattern),
            ilike(crmLeads.email, searchPattern),
            ilike(crmContacts.firstName, searchPattern),
            ilike(crmContacts.lastName, searchPattern),
            ilike(crmAccounts.name, searchPattern),
          )!
        );
      }

      // Filter by minimum score (stored in customFields.propensity_score)
      // Note: We'll apply this in application layer after fetching, since it's in JSONB

      // Query with joins for all related data
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const leadsQuery = database
        .select({
          lead: crmLeads,
          contact: crmContacts,
          account: crmAccounts,
          campaign: crmCampaigns,
        })
        .from(crmLeads)
        .leftJoin(crmContacts, eq(crmLeads.convertedContactId, crmContacts.id))
        .leftJoin(crmAccounts, eq(crmContacts.accountId, crmAccounts.id))
        .leftJoin(crmCampaigns, eq(crmLeads.campaignId, crmCampaigns.id))
        .where(and(...conditions))
        .limit(limit)
        .offset(offset);

      const results = await leadsQuery;

      // Get last activity for each lead (in a separate optimized query)
      const leadIds = results.map((r) => r.lead.id);

      let lastActivities: Record<string, any> = {};
      if (leadIds.length > 0) {
        // Use SQL to get the most recent activity per lead efficiently
        const activitiesSubquery = database
          .select({
            leadId: crmActivities.leadId,
            id: crmActivities.id,
            type: crmActivities.type,
            disposition: crmActivities.disposition,
            createdAt: crmActivities.createdAt,
            // Row number partitioned by lead_id, ordered by created_at desc
            rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${crmActivities.leadId} ORDER BY ${crmActivities.createdAt} DESC)`.as('rn'),
          })
          .from(crmActivities)
          .where(
            and(
              inArray(crmActivities.leadId, leadIds),
              isNull(crmActivities.deletedAt)
            )
          )
          .as('ranked_activities');

        const recentActivities = await database
          .select({
            leadId: activitiesSubquery.leadId,
            id: activitiesSubquery.id,
            type: activitiesSubquery.type,
            disposition: activitiesSubquery.disposition,
            createdAt: activitiesSubquery.createdAt,
          })
          .from(activitiesSubquery)
          .where(eq(activitiesSubquery.rn, 1));

        // Index by leadId
        for (const activity of recentActivities) {
          lastActivities[activity.leadId!] = activity;
        }
      }

      // Format results and apply priority sorting
      const formatted = results.map((row) => {
        const lead = row.lead;
        const propensityScore = (lead.customFields as any)?.propensity_score
          ? parseInt((lead.customFields as any).propensity_score, 10)
          : 0;

        // Calculate priority tier
        let priorityTier = 3; // Low score by default
        const hasCallbackToday =
          lead.status === 'contacted' &&
          lead.callbackDate &&
          (() => {
            const callbackDateOnly = new Date(lead.callbackDate);
            callbackDateOnly.setHours(0, 0, 0, 0); // Strip time component for date-only comparison
            return callbackDateOnly <= today;
          })();

        if (hasCallbackToday) {
          priorityTier = 0; // Highest priority
        } else if (propensityScore >= 80) {
          priorityTier = 1;
        } else if (propensityScore >= 50) {
          priorityTier = 2;
        }

        const lastActivity = lastActivities[lead.id];

        return {
          id: lead.id,
          contact: row.contact
            ? {
                firstName: row.contact.firstName,
                lastName: row.contact.lastName,
                title: row.contact.title,
                phone: row.contact.phone,
                email: row.contact.email,
              }
            : {
                // For unconverted leads, use lead data
                firstName: lead.firstName,
                lastName: lead.lastName,
                title: null,
                phone: lead.phone,
                email: lead.email,
              },
          account: row.account
            ? {
                name: row.account.name,
                industry: row.account.industry,
                employeeCount: row.account.employeeCount,
              }
            : {
                // Use company name from lead
                name: lead.companyName,
                industry: null,
                employeeCount: null,
              },
          status: lead.status,
          propensityScore,
          callbackDate: lead.callbackDate ? lead.callbackDate.toISOString() : null,
          lastContactDate: lead.lastContactDate ? lead.lastContactDate.toISOString() : null,
          lastActivity: lastActivity
            ? {
                type: lastActivity.type,
                disposition: lastActivity.disposition,
                createdAt: lastActivity.createdAt.toISOString(),
              }
            : null,
          campaignName: row.campaign?.name || null,
          priorityTier, // For sorting
          _sortKey: {
            tier: priorityTier,
            callback: lead.callbackDate?.getTime() || Number.MAX_SAFE_INTEGER,
            score: propensityScore,
            created: lead.createdAt.getTime(),
          },
        };
      });

      // Apply minimum score filter (client-side since it's in JSONB)
      let filtered = formatted;
      if (minScore !== undefined) {
        const minScoreNum = parseInt(minScore, 10);
        filtered = formatted.filter((lead) => lead.propensityScore >= minScoreNum);
      }

      // Sort by priority tiers
      filtered.sort((a, b) => {
        // Primary: priority tier (lower is higher priority)
        if (a._sortKey.tier !== b._sortKey.tier) {
          return a._sortKey.tier - b._sortKey.tier;
        }

        // Secondary: callback date (sooner is higher priority)
        if (a._sortKey.callback !== b._sortKey.callback) {
          return a._sortKey.callback - b._sortKey.callback;
        }

        // Tertiary: propensity score (higher is higher priority)
        if (a._sortKey.score !== b._sortKey.score) {
          return b._sortKey.score - a._sortKey.score;
        }

        // Quaternary: created date (newer is higher priority)
        return b._sortKey.created - a._sortKey.created;
      });

      // Remove internal sort keys
      const response = filtered.map(({ _sortKey, priorityTier, ...lead }) => lead);

      return {
        leads: response,
        total: filtered.length,
        serverTimestamp: new Date().toISOString(),
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        status: t.Optional(t.String()),
        campaignId: t.Optional(t.String()),
        minScore: t.Optional(t.String()),
        search: t.Optional(t.String()),
        limit: t.Optional(t.Number()),
        offset: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Agent'],
        summary: 'Get prioritized call list for agent',
        description:
          'Returns leads assigned to agent, sorted by priority (callbacks, high score, medium score, low score). Supports filtering by status, campaign, and minimum score.',
      },
    }
  )
  .get(
    '/call-list/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(
        `[agent/call-list/stream] Starting stream for workspace ${query.workspaceId}, user ${query.userId}`
      );

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        // Stream ALL leads for the workspace, frontend will filter by userId
        // This ensures agents see real-time updates when leads are assigned/unassigned
        const electric = streamLeads(query.workspaceId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[agent/call-list/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
      }),
      detail: {
        tags: ['Agent'],
        summary: 'Stream lead updates for agent',
        description:
          'Stream real-time lead updates via ElectricSQL. Frontend filters by userId for agent-specific updates.',
      },
    }
  );
