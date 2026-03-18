/**
 * LLM Credentials Routes
 * CRUD operations for encrypted API keys
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { llmCredentials, type LLMProvider } from '@agios/db/schema';
import { eq, and } from 'drizzle-orm';
import { encryptApiKey } from '../../lib/crypto';

export const credentialsRoutes = new Elysia({ prefix: '/credentials', tags: ['Credentials'] })
  /**
   * List all credentials
   * Returns list without decrypted API keys
   */
  .get(
    '/',
    async ({ query }) => {
      const conditions = [];

      if (query.workspaceId) {
        conditions.push(eq(llmCredentials.workspaceId, query.workspaceId));
      }

      if (query.userId) {
        conditions.push(eq(llmCredentials.userId, query.userId));
      }

      if (query.provider) {
        conditions.push(eq(llmCredentials.provider, query.provider));
      }

      const credentials = await db
        .select({
          id: llmCredentials.id,
          name: llmCredentials.name,
          provider: llmCredentials.provider,
          workspaceId: llmCredentials.workspaceId,
          userId: llmCredentials.userId,
          isActive: llmCredentials.isActive,
          createdAt: llmCredentials.createdAt,
          updatedAt: llmCredentials.updatedAt,
        })
        .from(llmCredentials)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(llmCredentials.createdAt);

      return { credentials };
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
        provider: t.Optional(t.String()),
      }),
      detail: {
        summary: 'List credentials',
        description: 'Returns list of credentials without decrypted API keys',
      },
    }
  )

  /**
   * Get credential by ID
   * Returns credential without decrypted API key
   */
  .get(
    '/:id',
    async ({ params, error }) => {
      const credential = await db.query.llmCredentials.findFirst({
        where: eq(llmCredentials.id, params.id),
        columns: {
          id: true,
          name: true,
          provider: true,
          workspaceId: true,
          userId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!credential) {
        return error(404, { error: 'Credential not found' });
      }

      return { credential };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Get credential by ID',
        description: 'Returns credential without decrypted API key',
      },
    }
  )

  /**
   * Create new credential
   * Encrypts API key before storing
   */
  .post(
    '/',
    async ({ body }) => {
      // Encrypt the API key
      const apiKeyEncrypted = encryptApiKey(body.apiKey);

      const [credential] = await db
        .insert(llmCredentials)
        .values({
          name: body.name,
          provider: body.provider,
          apiKeyEncrypted,
          workspaceId: body.workspaceId || null,
          userId: body.userId || null,
          isActive: body.isActive ?? true,
        })
        .returning({
          id: llmCredentials.id,
          name: llmCredentials.name,
          provider: llmCredentials.provider,
          workspaceId: llmCredentials.workspaceId,
          userId: llmCredentials.userId,
          isActive: llmCredentials.isActive,
          createdAt: llmCredentials.createdAt,
          updatedAt: llmCredentials.updatedAt,
        });

      return { credential };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 255 }),
        provider: t.Union([
          t.Literal('openai'),
          t.Literal('anthropic'),
          t.Literal('together'),
          t.Literal('openapi'),
        ]),
        apiKey: t.String({ minLength: 1 }),
        workspaceId: t.Optional(t.Union([t.String(), t.Null()])),
        userId: t.Optional(t.Union([t.String(), t.Null()])),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'Create credential',
        description: 'Encrypts and stores API key. Returns credential without decrypted key.',
      },
    }
  )

  /**
   * Update credential
   * Can update name, isActive status, or replace API key
   */
  .put(
    '/:id',
    async ({ params, body, error }) => {
      const existing = await db.query.llmCredentials.findFirst({
        where: eq(llmCredentials.id, params.id),
      });

      if (!existing) {
        return error(404, { error: 'Credential not found' });
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (body.name !== undefined) {
        updateData.name = body.name;
      }

      if (body.isActive !== undefined) {
        updateData.isActive = body.isActive;
      }

      // If new API key provided, encrypt and update
      if (body.apiKey !== undefined) {
        updateData.apiKeyEncrypted = encryptApiKey(body.apiKey);
      }

      const [credential] = await db
        .update(llmCredentials)
        .set(updateData)
        .where(eq(llmCredentials.id, params.id))
        .returning({
          id: llmCredentials.id,
          name: llmCredentials.name,
          provider: llmCredentials.provider,
          workspaceId: llmCredentials.workspaceId,
          userId: llmCredentials.userId,
          isActive: llmCredentials.isActive,
          createdAt: llmCredentials.createdAt,
          updatedAt: llmCredentials.updatedAt,
        });

      return { credential };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        apiKey: t.Optional(t.String({ minLength: 1 })),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'Update credential',
        description: 'Update name, isActive status, or replace API key',
      },
    }
  )

  /**
   * Delete credential
   * Note: Will fail if any LLM configs reference this credential
   */
  .delete(
    '/:id',
    async ({ params, error }) => {
      const existing = await db.query.llmCredentials.findFirst({
        where: eq(llmCredentials.id, params.id),
      });

      if (!existing) {
        return error(404, { error: 'Credential not found' });
      }

      try {
        await db.delete(llmCredentials).where(eq(llmCredentials.id, params.id));
        return { success: true };
      } catch (err: any) {
        // Foreign key constraint will prevent deletion if in use
        if (err.code === '23503') {
          return error(409, {
            error: 'Credential is in use by one or more LLM configs',
          });
        }
        throw err;
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Delete credential',
        description: 'Delete credential. Fails if referenced by any LLM configs.',
      },
    }
  );
