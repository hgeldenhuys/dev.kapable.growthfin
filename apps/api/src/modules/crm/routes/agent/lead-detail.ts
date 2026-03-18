/**
 * Agent Lead Detail Routes
 * REST endpoint for complete lead context with full joins
 * US-AGENT-002: Lead Screen Pop with Full Context
 */

import { Elysia, t } from 'elysia';
import { db as database } from '@agios/db';
import {
  crmLeads,
  crmContacts,
  crmAccounts,
  crmCampaigns,
  crmActivities,
  workspaceMembers,
  workspaces,
} from '@agios/db';
import { eq, and, isNull, ne, desc, or } from 'drizzle-orm';

export const agentLeadDetailRoutes = new Elysia({ prefix: '/agent' })
  .get(
    '/leads/:leadId/detail',
    async ({ params, query, set }) => {
      const { leadId } = params;
      const { workspaceId, userId } = query;

      // Performance tracking
      const startTime = Date.now();

      // BUG-001 FIX: Verify workspace access BEFORE querying lead data
      // User must be either workspace owner OR workspace member
      const [workspaceOwner] = await database
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspaceOwner) {
        set.status = 404;
        return {
          error: 'NOT_FOUND',
          message: 'Workspace not found',
        };
      }

      const isOwner = workspaceOwner.ownerId === userId;

      if (!isOwner) {
        // Not owner, check if member
        const membershipResult = await database
          .select()
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.userId, userId)
            )
          )
          .limit(1);

        if (!membershipResult.length) {
          // Return 404 to avoid leaking workspace information
          set.status = 404;
          return {
            error: 'NOT_FOUND',
            message: 'Lead not found',
          };
        }
      }

      // BUG-002 FIX: Include authorization in WHERE clause (workspace isolation only)
      // Workspace access is already verified above - any workspace member can view any lead in the workspace
      // Fetch lead with all related data in a single optimized query
      const leadDetailQuery = database
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
        .where(
          and(
            eq(crmLeads.id, leadId),
            eq(crmLeads.workspaceId, workspaceId),
            // Removed owner check - any workspace member can view leads
            isNull(crmLeads.deletedAt)
          )
        )
        .limit(1);

      const leadDetailResult = await leadDetailQuery;

      if (!leadDetailResult.length) {
        set.status = 404;
        return {
          error: 'NOT_FOUND',
          message: 'Lead not found',
        };
      }

      const [detail] = leadDetailResult;

      // Fetch recent activities for this lead (last 10)
      // H.4: Include channelMetadata for call recording/transcription data
      const recentActivities = await database
        .select({
          id: crmActivities.id,
          type: crmActivities.type,
          subject: crmActivities.subject,
          description: crmActivities.description,
          disposition: crmActivities.disposition,
          outcome: crmActivities.outcome,
          status: crmActivities.status,
          duration: crmActivities.duration,
          channelMetadata: crmActivities.channelMetadata,
          createdAt: crmActivities.createdAt,
          createdBy: crmActivities.createdBy,
        })
        .from(crmActivities)
        .where(
          and(eq(crmActivities.leadId, leadId), isNull(crmActivities.deletedAt))
        )
        .orderBy(desc(crmActivities.createdAt))
        .limit(10);

      // Fetch related contacts at same account (if lead has been converted to contact)
      let relatedContacts: any[] = [];
      if (detail.contact && detail.contact.accountId) {
        relatedContacts = await database
          .select({
            id: crmContacts.id,
            firstName: crmContacts.firstName,
            lastName: crmContacts.lastName,
            title: crmContacts.title,
            department: crmContacts.department,
            phone: crmContacts.phone,
            email: crmContacts.email,
          })
          .from(crmContacts)
          .where(
            and(
              eq(crmContacts.accountId, detail.contact.accountId),
              ne(crmContacts.id, detail.contact.id), // Exclude current contact
              isNull(crmContacts.deletedAt)
            )
          )
          .limit(5);
      }

      // Extract AI intelligence from database columns and customFields
      const customFields = detail.lead.customFields as any || {};
      const propensityScore = detail.lead.propensityScore || 0;
      const scoreBreakdown = detail.lead.scoreBreakdown || {};
      const scoreUpdatedAt = detail.lead.propensityScoreUpdatedAt;
      const scoreFactors = customFields.score_factors || [];
      const businessIntelligence = customFields.business_intelligence || '';

      // Build response with all context
      const response = {
        lead: {
          id: detail.lead.id,
          status: detail.lead.status,
          callbackDate: detail.lead.callbackDate,
          lastContactDate: detail.lead.lastContactDate,
          createdAt: detail.lead.createdAt,
          source: detail.lead.source,
        },
        // BUG-003 FIX: Return null instead of object with id: null
        contact: detail.contact && detail.contact.id
          ? {
              id: detail.contact.id,
              firstName: detail.contact.firstName,
              lastName: detail.contact.lastName,
              title: detail.contact.title,
              phone: detail.contact.phone,
              email: detail.contact.email,
              mobile: detail.contact.mobile,
              department: detail.contact.department,
              // LinkedIn would be in customFields if available
              linkedin: (detail.contact.customFields as any)?.linkedin || null,
            }
          : null,
        // BUG-003 FIX: Return null instead of object with id: null
        account: detail.account && detail.account.id
          ? {
              id: detail.account.id,
              name: detail.account.name,
              industry: detail.account.industry,
              employeeCount: detail.account.employeeCount,
              website: detail.account.website,
              annualRevenue: detail.account.annualRevenue,
              // customFields may contain additional info
              customFields: detail.account.customFields,
            }
          : null,
        campaign: detail.campaign
          ? {
              id: detail.campaign.id,
              name: detail.campaign.name,
              description: detail.campaign.description,
              objective: detail.campaign.objective,
              // Messaging strategy from description field (primary) or customFields (secondary)
              messagingStrategy:
                detail.campaign.description ||
                (detail.campaign.customFields as any)?.messaging_strategy ||
                '',
            }
          : null,
        aiIntelligence: {
          propensityScore,
          scoreBreakdown,
          scoreUpdatedAt,
          scoreFactors,
          businessIntelligence,
        },
        recentActivities: recentActivities.map((activity) => {
          // H.4: Extract recording and transcription data for call activities
          const metadata = activity.channelMetadata as Record<string, any> | null;
          const recording = metadata?.recording || null;
          const transcription = metadata?.transcription
            ? {
                status: metadata.transcription.status,
                text: metadata.transcription.text,
                language: metadata.transcription.language,
                languageConfidence: metadata.transcription.languageConfidence,
                speakers: metadata.transcription.speakers,
                // Exclude word-level data to reduce payload size
                processedAt: metadata.transcription.processedAt,
                error: metadata.transcription.error,
              }
            : null;

          return {
            id: activity.id,
            type: activity.type,
            subject: activity.subject,
            disposition: activity.disposition,
            outcome: activity.outcome,
            notes: activity.description,
            duration: activity.duration,
            createdAt: activity.createdAt,
            createdBy: activity.createdBy,
            // H.4: Include recording and transcription for call activities
            recording,
            transcription,
          };
        }),
        relatedContacts,
      };

      // Performance tracking
      const queryTime = Date.now() - startTime;
      console.log(`[lead-detail] Query completed in ${queryTime}ms for lead ${leadId}`);

      if (queryTime > 500) {
        console.warn(`[lead-detail] Performance warning: Query took ${queryTime}ms (target: <500ms)`);
      }

      return {
        ...response,
        _meta: {
          queryTime,
          timestamp: new Date().toISOString(),
        },
      };
    },
    {
      params: t.Object({
        leadId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
      }),
      detail: {
        tags: ['Agent'],
        summary: 'Get complete lead context',
        description:
          'Returns complete lead detail with contact, account, campaign, AI intelligence, recent activities, and related contacts. Optimized for <500ms response time.',
      },
    }
  );
