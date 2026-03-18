/**
 * Account Routes
 * REST endpoints for CRM account CRUD operations with real-time SSE streaming
 */

import { Elysia, t } from 'elysia';
import { accountService } from '../services/accounts';
import { contactService } from '../services/contacts';
import { opportunityService } from '../services/opportunities';
import { timelineService } from '../services/timeline';
import { streamCRMAccounts } from '../../../lib/electric-shapes';
import { calculateHealthScore } from '../services/health-score';

export const accountRoutes = new Elysia({ prefix: '/accounts' })
  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400;
      const accounts = await accountService.getRecent(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
        accounts,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Accounts'],
        summary: 'Get recent accounts',
        description: 'Fetch recent accounts for initial state (CQRS pattern)',
      },
    }
  )
  .get(
    '/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(`[accounts/stream] Starting stream for workspace ${query.workspaceId}`);

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamCRMAccounts(query.workspaceId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[accounts/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Accounts'],
        summary: 'Stream account updates',
        description: 'Stream NEW account updates via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  )
  .get(
    '/',
    async ({ db, query }) => {
      return accountService.list(db, {
        workspaceId: query.workspaceId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        status: query.status,
        ownerId: query.ownerId,
        parentAccountId: query.parentAccountId,
      });
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        status: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        parentAccountId: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/',
    async ({ db, body }) => {
      // Map route field names to database field names
      const { createdById, updatedById, ...rest } = body;
      return accountService.create(db, {
        ...rest,
        createdBy: createdById || body.ownerId,
        updatedBy: updatedById || body.ownerId,
      });
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        ownerId: t.String(),
        createdById: t.Optional(t.String()),
        updatedById: t.Optional(t.String()),
        parentAccountId: t.Optional(t.Union([t.String(), t.Null()])),
        industry: t.Optional(t.Union([t.String(), t.Null()])),
        employeeCount: t.Optional(t.Union([t.Number(), t.Null()])),
        annualRevenue: t.Optional(t.Union([t.String(), t.Null()])),
        website: t.Optional(t.Union([t.String(), t.Null()])),
        // US-CRM-ADDR-002: Billing address fields
        billingAddressLine1: t.Optional(t.String()),
        billingAddressLine2: t.Optional(t.String()),
        billingCity: t.Optional(t.String()),
        billingStateProvince: t.Optional(t.String()),
        billingPostalCode: t.Optional(t.String()),
        billingCountry: t.Optional(t.String()),
        // US-CRM-ADDR-002: Shipping address fields
        shippingAddressLine1: t.Optional(t.String()),
        shippingAddressLine2: t.Optional(t.String()),
        shippingCity: t.Optional(t.String()),
        shippingStateProvince: t.Optional(t.String()),
        shippingPostalCode: t.Optional(t.String()),
        shippingCountry: t.Optional(t.String()),
        status: t.Optional(t.String()),
        customFields: t.Optional(t.Any()),
      }),
    }
  )
  .get(
    '/:id',
    async ({ db, params, query }) => {
      const account = await accountService.getById(db, params.id, query.workspaceId);
      if (!account) {
        throw new Error('Account not found');
      }
      return account;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .put(
    '/:id',
    async ({ db, params, query, body }) => {
      // Map route field names to database field names
      const { updatedById, ...rest } = body;
      const account = await accountService.update(db, params.id, query.workspaceId, {
        ...rest,
        updatedBy: updatedById || body.ownerId,
      });
      if (!account) {
        throw new Error('Account not found');
      }
      return account;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        industry: t.Optional(t.String()),
        employeeCount: t.Optional(t.Number()),
        annualRevenue: t.Optional(t.String()),
        website: t.Optional(t.String()),
        status: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        parentAccountId: t.Optional(t.String()),
        updatedById: t.String(),
        // US-CRM-ADDR-002: Billing address fields
        billingAddressLine1: t.Optional(t.String()),
        billingAddressLine2: t.Optional(t.String()),
        billingCity: t.Optional(t.String()),
        billingStateProvince: t.Optional(t.String()),
        billingPostalCode: t.Optional(t.String()),
        billingCountry: t.Optional(t.String()),
        // US-CRM-ADDR-002: Shipping address fields
        shippingAddressLine1: t.Optional(t.String()),
        shippingAddressLine2: t.Optional(t.String()),
        shippingCity: t.Optional(t.String()),
        shippingStateProvince: t.Optional(t.String()),
        shippingPostalCode: t.Optional(t.String()),
        shippingCountry: t.Optional(t.String()),
        customFields: t.Optional(t.Any()),
      }),
    }
  )
  .patch(
    '/:id/health-score',
    async ({ db, params, query, set }) => {
      // US-ENH-010: Manual health score recalculation endpoint
      try {
        // Verify account exists and user has access
        const account = await accountService.getById(db, params.id, query.workspaceId);

        if (!account) {
          set.status = 404;
          return { error: 'Account not found' };
        }

        // Calculate health score with factor breakdown
        const result = await calculateHealthScore(params.id, query.workspaceId, db);

        // Update account with new health score
        const updatedAccount = await accountService.updateHealthScore(db, params.id, query.workspaceId);

        if (!updatedAccount) {
          set.status = 404;
          return { error: 'Account not found' };
        }

        // Return account with factor breakdown for transparency
        return {
          id: updatedAccount.id,
          healthScore: updatedAccount.healthScore,
          healthScoreUpdatedAt: updatedAccount.healthScoreUpdatedAt?.toISOString(),
          factors: result.factors,
        };
      } catch (error) {
        console.error('[health-score] Error:', error);
        set.status = 500;
        return { error: 'Failed to calculate health score', message: error instanceof Error ? error.message : String(error) };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Accounts'],
        summary: 'Update account health score',
        description: 'Manually trigger health score recalculation with factor breakdown',
      },
    }
  )
  .delete(
    '/:id',
    async ({ db, params, query, set }) => {
      // US-ENH-011: Delete with protection logic
      try {
        // Extract force parameter from query
        const force = query.force === 'true' || query.force === true;

        await accountService.delete(db, params.id, query.workspaceId, { force });

        return {
          message: 'Account deleted successfully',
          deletedAt: new Date().toISOString(),
        };
      } catch (error) {
        // Check if error is from relationship protection
        const errorMessage = error instanceof Error ? error.message : String(error);

        try {
          // Try to parse structured error from service
          const errorData = JSON.parse(errorMessage);

          if (errorData.error && errorData.relationships) {
            // This is our structured delete protection error
            set.status = 400;
            return errorData;
          }
        } catch {
          // Not a JSON error, fall through to generic handling
        }

        // Check for workspace mismatch or not found
        if (errorMessage.includes('not found') || errorMessage.includes('Account not found')) {
          set.status = 404;
          return { error: 'Account not found' };
        }

        if (errorMessage.includes('workspace') || errorMessage.includes('Access denied')) {
          set.status = 403;
          return { error: 'Access denied - account not in your workspace' };
        }

        // Generic error
        set.status = 500;
        return { error: 'Failed to delete account', message: errorMessage };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        force: t.Optional(t.Union([t.String(), t.Boolean()])),
      }),
      detail: {
        tags: ['Accounts'],
        summary: 'Delete account with relationship protection',
        description: 'Delete account with protection against active relationships. Use force=true to override (admin only).',
      },
    }
  )
  .get(
    '/:id/contacts',
    async ({ db, params, query }) => {
      return contactService.list(db, {
        workspaceId: query.workspaceId,
        accountId: params.id,
      });
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .get(
    '/:id/timeline',
    async ({ db, params, query }) => {
      return timelineService.getByEntity(db, 'account', params.id, query.workspaceId, query.limit ? parseInt(query.limit, 10) : 50);
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
    }
  )
  .get(
    '/:id/opportunities',
    async ({ db, params, query }) => {
      return opportunityService.getByAccount(db, params.id, query.workspaceId);
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .get(
    '/:id/child-accounts',
    async ({ db, params, query }) => {
      return accountService.getChildAccounts(db, params.id, query.workspaceId);
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  );
