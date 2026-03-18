/**
 * Email Templates Routes
 * CRUD endpoints for managing reusable email templates with variable substitution
 */

import { Elysia, t } from 'elysia';
import { crmEmailTemplates, type NewCrmEmailTemplate } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';

export const emailTemplatesRoutes = new Elysia({ prefix: '/email-templates' })
  // List all email templates for a workspace
  .get(
    '/',
    async ({ db, query }) => {
      const templates = await db
        .select()
        .from(crmEmailTemplates)
        .where(
          and(
            eq(crmEmailTemplates.workspaceId, query.workspaceId),
            isNull(crmEmailTemplates.deletedAt),
            query.category ? eq(crmEmailTemplates.category, query.category) : undefined
          )
        )
        .orderBy(crmEmailTemplates.name);

      return templates;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        category: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Email Templates'],
        summary: 'List email templates',
        description: 'Get all email templates for a workspace, optionally filtered by category',
      },
    }
  )

  // Get a single email template by ID
  .get(
    '/:id',
    async ({ db, params }) => {
      const templates = await db
        .select()
        .from(crmEmailTemplates)
        .where(and(eq(crmEmailTemplates.id, params.id), isNull(crmEmailTemplates.deletedAt)))
        .limit(1);

      const template = templates[0];

      if (!template) {
        throw new Error('Template not found');
      }

      return template;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Email Templates'],
        summary: 'Get email template by ID',
      },
    }
  )

  // Create a new email template
  .post(
    '/',
    async ({ db, body }) => {
      const [template] = await db
        .insert(crmEmailTemplates)
        .values({
          workspaceId: body.workspaceId,
          name: body.name,
          subject: body.subject,
          body: body.body,
          variables: body.variables || [],
          category: body.category,
          isActive: body.isActive ?? true,
          createdBy: body.userId,
          updatedBy: body.userId,
        })
        .returning();

      return template;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        name: t.String(),
        subject: t.String(),
        body: t.String(),
        variables: t.Optional(t.Array(t.String())),
        category: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['Email Templates'],
        summary: 'Create email template',
        description: 'Create a new email template with variable placeholders (e.g., {{firstName}})',
      },
    }
  )

  // Update an existing email template
  .patch(
    '/:id',
    async ({ db, params, body }) => {
      const [template] = await db
        .update(crmEmailTemplates)
        .set({
          name: body.name,
          subject: body.subject,
          body: body.body,
          variables: body.variables,
          category: body.category,
          isActive: body.isActive,
          updatedBy: body.userId,
          updatedAt: new Date(),
        })
        .where(eq(crmEmailTemplates.id, params.id))
        .returning();

      if (!template) {
        throw new Error('Template not found');
      }

      return template;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        userId: t.String(),
        name: t.Optional(t.String()),
        subject: t.Optional(t.String()),
        body: t.Optional(t.String()),
        variables: t.Optional(t.Array(t.String())),
        category: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['Email Templates'],
        summary: 'Update email template',
      },
    }
  )

  // Bulk import email templates
  .post(
    '/bulk-import',
    async ({ db, body, set }) => {
      try {
        if (body.items.length > 200) {
          set.status = 400;
          return { error: 'Maximum 200 items per import' };
        }

        const mapped = body.items.map((item) => ({
          workspaceId: body.workspaceId,
          name: item.name,
          subject: item.subject,
          body: item.body,
          variables: item.variables || [],
          category: item.category,
          isActive: item.isActive ?? true,
          createdBy: body.userId,
          updatedBy: body.userId,
        }));

        const imported = await db
          .insert(crmEmailTemplates)
          .values(mapped)
          .returning();

        return { imported: imported.length, items: imported };
      } catch (error) {
        console.error('[email-templates.bulk-import] Error:', error);
        set.status = 500;
        return { error: error instanceof Error ? error.message : 'Failed to import email templates' };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        items: t.Array(
          t.Object({
            name: t.String(),
            subject: t.Optional(t.String()),
            body: t.Optional(t.String()),
            variables: t.Optional(t.Array(t.String())),
            category: t.Optional(t.String()),
            isActive: t.Optional(t.Boolean()),
          })
        ),
      }),
      detail: {
        tags: ['Email Templates'],
        summary: 'Bulk import email templates from JSON',
      },
    }
  )

  // Soft delete an email template
  .delete(
    '/:id',
    async ({ db, params }) => {
      const [template] = await db
        .update(crmEmailTemplates)
        .set({
          deletedAt: new Date(),
        })
        .where(eq(crmEmailTemplates.id, params.id))
        .returning();

      if (!template) {
        throw new Error('Template not found');
      }

      return { success: true, message: 'Template deleted successfully' };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Email Templates'],
        summary: 'Delete email template',
        description: 'Soft delete an email template (sets deletedAt timestamp)',
      },
    }
  );
