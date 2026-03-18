/**
 * Onboarding Routes
 * Endpoints for tracking onboarding progress and seeding sample data
 */

import { Elysia, t } from 'elysia';
import {
  crmLeads,
  crmContacts,
  crmEmailTemplates,
  crmCampaigns,
  crmActivities,
  crmOpportunities,
  workspaces,
  type WorkspaceSettings,
} from '@agios/db';
import { eq, and, isNull, sql } from 'drizzle-orm';

export const onboardingRoutes = new Elysia({ prefix: '/onboarding' })
  /**
   * GET /api/v1/crm/onboarding/progress
   * Returns entity counts for onboarding tracking
   */
  .get(
    '/progress',
    async ({ db, query }) => {
      const { workspaceId } = query;

      const [leads, contacts, templates, campaigns, activities, opportunities] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(crmLeads).where(and(eq(crmLeads.workspaceId, workspaceId), isNull(crmLeads.deletedAt))),
        db.select({ count: sql<number>`count(*)::int` }).from(crmContacts).where(eq(crmContacts.workspaceId, workspaceId)),
        db.select({ count: sql<number>`count(*)::int` }).from(crmEmailTemplates).where(and(eq(crmEmailTemplates.workspaceId, workspaceId), isNull(crmEmailTemplates.deletedAt))),
        db.select({ count: sql<number>`count(*)::int` }).from(crmCampaigns).where(eq(crmCampaigns.workspaceId, workspaceId)),
        db.select({ count: sql<number>`count(*)::int` }).from(crmActivities).where(eq(crmActivities.workspaceId, workspaceId)),
        db.select({ count: sql<number>`count(*)::int` }).from(crmOpportunities).where(eq(crmOpportunities.workspaceId, workspaceId)),
      ]);

      return {
        leads: leads[0].count,
        contacts: contacts[0].count,
        templates: templates[0].count,
        campaigns: campaigns[0].count,
        activities: activities[0].count,
        opportunities: opportunities[0].count,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Onboarding'],
        summary: 'Get onboarding progress',
        description: 'Returns entity counts for onboarding step tracking',
      },
    }
  )

  /**
   * POST /api/v1/crm/onboarding/seed-sample-data
   * Seeds sample data when sandbox mode is enabled
   */
  .post(
    '/seed-sample-data',
    async ({ db, query }) => {
      const { workspaceId } = query;

      // 1. Fetch workspace settings
      const wsRows = await db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (wsRows.length === 0) {
        throw new Error('Workspace not found');
      }

      const settings = wsRows[0].settings as WorkspaceSettings | null;

      // 2. Check if sandbox mode is enabled
      const sandboxEnabled = settings?.sandbox?.enabled === true || process.env.SANDBOX_MODE === 'true';
      if (!sandboxEnabled) {
        return new Response(
          JSON.stringify({ error: 'Sample data can only be loaded when sandbox mode is enabled' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 3. Check if sample data was already created
      const onboardingSettings = (settings as Record<string, unknown>)?.onboarding as Record<string, unknown> | undefined;
      if (onboardingSettings?.sampleDataCreated === true) {
        return new Response(
          JSON.stringify({ error: 'Sample data has already been created' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 4. Sample data definitions
      const sampleLeads = [
        { firstName: 'Sarah', lastName: 'Johnson', companyName: 'TechCorp SA', email: 'sarah@techcorp.co.za', source: 'website', status: 'new' as const },
        { firstName: 'Thabo', lastName: 'Molefe', companyName: 'InnoVentures', email: 'thabo@innoventures.co.za', source: 'referral', status: 'qualified' as const },
        { firstName: 'Aisha', lastName: 'Patel', companyName: 'FinServ Group', email: 'aisha@finserv.co.za', source: 'linkedin', status: 'new' as const },
        { firstName: 'Pieter', lastName: 'du Plessis', companyName: 'AgriTech Solutions', email: 'pieter@agritech.co.za', source: 'trade-show', status: 'new' as const },
        { firstName: 'Nomsa', lastName: 'Ndlovu', companyName: 'EduBridge Academy', email: 'nomsa@edubridge.co.za', source: 'website', status: 'contacted' as const },
        { firstName: 'David', lastName: 'Nkomo', companyName: 'GreenEnergy SA', email: 'david@greenenergy.co.za', source: 'cold-call', status: 'new' as const },
        { firstName: 'Fatima', lastName: 'Ismail', companyName: 'MedTech Innovations', email: 'fatima@medtech.co.za', source: 'referral', status: 'qualified' as const },
        { firstName: 'Johan', lastName: 'Botha', companyName: 'LogiFreight', email: 'johan@logifreight.co.za', source: 'linkedin', status: 'new' as const },
        { firstName: 'Zanele', lastName: 'Mthembu', companyName: 'RetailPro', email: 'zanele@retailpro.co.za', source: 'website', status: 'new' as const },
        { firstName: 'James', lastName: 'October', companyName: 'Cape Digital', email: 'james@capedigital.co.za', source: 'referral', status: 'contacted' as const },
      ];

      const sampleContacts = [
        { firstName: 'Lisa', lastName: 'van der Berg', email: 'lisa@growthco.co.za', phone: '+27821234567' },
        { firstName: 'Sipho', lastName: 'Dlamini', email: 'sipho@innovate.co.za', phone: '+27839876543' },
        { firstName: 'Emma', lastName: 'Kruger', email: 'emma@techstart.co.za', phone: '+27845551234' },
      ];

      const sampleTemplates = [
        { name: 'Welcome Email', subject: 'Welcome to our community!', body: '<p>Hi {{firstName}},</p><p>Thank you for your interest. We are excited to have you!</p><p>Best regards,<br/>The Team</p>', category: 'marketing' },
        { name: 'Follow-up Email', subject: 'Following up on our conversation', body: '<p>Hi {{firstName}},</p><p>I wanted to follow up and see if you had any questions.</p><p>Kind regards</p>', category: 'sales' },
      ];

      const sampleCampaign = {
        name: 'Welcome Campaign (Sample)',
        description: 'Sample welcome campaign for new leads',
        status: 'draft',
        channels: ['email'],
        objective: 'awareness',
        type: 'one-time',
      };

      // 5. Insert everything in a transaction
      await db.transaction(async (tx) => {
        // Insert leads
        for (const lead of sampleLeads) {
          await tx.insert(crmLeads).values({
            workspaceId,
            firstName: lead.firstName,
            lastName: lead.lastName,
            companyName: lead.companyName,
            email: lead.email,
            source: lead.source,
            status: lead.status,
          });
        }

        // Insert contacts
        for (const contact of sampleContacts) {
          await tx.insert(crmContacts).values({
            workspaceId,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
          });
        }

        // Insert email templates
        for (const template of sampleTemplates) {
          await tx.insert(crmEmailTemplates).values({
            workspaceId,
            name: template.name,
            subject: template.subject,
            body: template.body,
            category: template.category,
          });
        }

        // Insert campaign
        await tx.insert(crmCampaigns).values({
          workspaceId,
          name: sampleCampaign.name,
          description: sampleCampaign.description,
          status: sampleCampaign.status,
          channels: sampleCampaign.channels,
          objective: sampleCampaign.objective,
          type: sampleCampaign.type,
        });

        // Update workspace settings to mark sample data as created
        await tx.update(workspaces)
          .set({
            settings: sql`COALESCE(${workspaces.settings}, '{}'::jsonb) || ${JSON.stringify({ onboarding: { sampleDataCreated: true } })}::jsonb`,
          })
          .where(eq(workspaces.id, workspaceId));
      });

      return {
        success: true,
        created: {
          leads: sampleLeads.length,
          contacts: sampleContacts.length,
          templates: sampleTemplates.length,
          campaigns: 1,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Onboarding'],
        summary: 'Seed sample data',
        description: 'Creates sample leads, contacts, templates, and a campaign. Only works when sandbox mode is enabled.',
      },
    }
  );
