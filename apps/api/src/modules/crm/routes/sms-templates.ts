/**
 * SMS Templates Routes
 * CRUD endpoints for managing reusable SMS templates with variable substitution
 */

import { Elysia, t } from 'elysia';
import { crmSmsTemplates, type NewCrmSmsTemplate } from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';

export const smsTemplatesRoutes = new Elysia({ prefix: '/sms-templates' })
  // List all SMS templates for a workspace
  .get(
    '/',
    async ({ db, query }) => {
      const templates = await db
        .select()
        .from(crmSmsTemplates)
        .where(
          and(
            eq(crmSmsTemplates.workspaceId, query.workspaceId),
            isNull(crmSmsTemplates.deletedAt),
            query.category ? eq(crmSmsTemplates.category, query.category) : undefined,
            query.isActive !== undefined ? eq(crmSmsTemplates.isActive, query.isActive) : undefined
          )
        )
        .orderBy(crmSmsTemplates.name);

      return templates;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        category: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['SMS Templates'],
        summary: 'List SMS templates',
        description: 'Get all SMS templates for a workspace, optionally filtered by category or active status. Excludes soft-deleted templates.',
      },
    }
  )

  // Get a single SMS template by ID
  .get(
    '/:id',
    async ({ db, params }) => {
      const templates = await db
        .select()
        .from(crmSmsTemplates)
        .where(
          and(
            eq(crmSmsTemplates.id, params.id),
            isNull(crmSmsTemplates.deletedAt)
          )
        )
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
        tags: ['SMS Templates'],
        summary: 'Get SMS template by ID',
      },
    }
  )

  // Create a new SMS template
  .post(
    '/',
    async ({ db, body }) => {
      const [template] = await db
        .insert(crmSmsTemplates)
        .values({
          workspaceId: body.workspaceId,
          name: body.name,
          body: body.body,
          variables: body.variables || [],
          category: body.category,
          maxSegments: body.maxSegments ?? 3,
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
        body: t.String(),
        variables: t.Optional(t.Array(t.String())),
        category: t.Optional(t.String()),
        maxSegments: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['SMS Templates'],
        summary: 'Create SMS template',
        description: 'Create a new SMS template with variable placeholders (e.g., {{firstName}}). maxSegments defaults to 3.',
      },
    }
  )

  // Update an existing SMS template
  .patch(
    '/:id',
    async ({ db, params, body }) => {
      const [template] = await db
        .update(crmSmsTemplates)
        .set({
          name: body.name,
          body: body.body,
          variables: body.variables,
          category: body.category,
          maxSegments: body.maxSegments,
          isActive: body.isActive,
          updatedBy: body.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(crmSmsTemplates.id, params.id),
            isNull(crmSmsTemplates.deletedAt)
          )
        )
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
        body: t.Optional(t.String()),
        variables: t.Optional(t.Array(t.String())),
        category: t.Optional(t.String()),
        maxSegments: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ['SMS Templates'],
        summary: 'Update SMS template',
      },
    }
  )

  // Bulk import SMS templates
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
          body: item.body,
          variables: item.variables || [],
          category: item.category,
          maxSegments: item.maxSegments ?? 3,
          isActive: item.isActive ?? true,
          createdBy: body.userId,
          updatedBy: body.userId,
        }));

        const imported = await db
          .insert(crmSmsTemplates)
          .values(mapped)
          .returning();

        return { imported: imported.length, items: imported };
      } catch (error) {
        console.error('[sms-templates.bulk-import] Error:', error);
        set.status = 500;
        return { error: error instanceof Error ? error.message : 'Failed to import SMS templates' };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        items: t.Array(
          t.Object({
            name: t.String(),
            body: t.Optional(t.String()),
            variables: t.Optional(t.Array(t.String())),
            category: t.Optional(t.String()),
            maxSegments: t.Optional(t.Number()),
            isActive: t.Optional(t.Boolean()),
          })
        ),
      }),
      detail: {
        tags: ['SMS Templates'],
        summary: 'Bulk import SMS templates from JSON',
      },
    }
  )

  // Soft delete an SMS template
  .delete(
    '/:id',
    async ({ db, params }) => {
      const [template] = await db
        .update(crmSmsTemplates)
        .set({
          deletedAt: new Date(),
        })
        .where(
          and(
            eq(crmSmsTemplates.id, params.id),
            isNull(crmSmsTemplates.deletedAt)
          )
        )
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
        tags: ['SMS Templates'],
        summary: 'Delete SMS template',
        description: 'Soft delete an SMS template (sets deletedAt timestamp)',
      },
    }
  );
