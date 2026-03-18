/**
 * Bulk Operations Routes
 * Bulk assign, update, and manage operations for leads with rollback support
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import { bulkOperations, bulkOperationItems, crmLeads } from '@agios/db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { jobQueue } from '../../../lib/queue';

export const bulkOperationsRoutes = new Elysia({ prefix: '/bulk-operations' })
  /**
   * Create bulk operation (generic endpoint)
   * POST /api/v1/workspaces/:workspaceId/crm/bulk-operations
   */
  .post(
    '/',
    async ({ body, query }) => {
      const { workspaceId } = query;
      const {
        operationType,
        operationName,
        leadIds,
        payload,
        rollbackEnabled = true,
        rollbackWindowMinutes = 5,
        userId,
      } = body;

      if (!leadIds || leadIds.length === 0) {
        throw new Error('No leads specified');
      }

      // Validate leads exist and belong to workspace
      const leads = await db
        .select({ id: crmLeads.id })
        .from(crmLeads)
        .where(and(eq(crmLeads.workspaceId, workspaceId), inArray(crmLeads.id, leadIds)));

      if (leads.length !== leadIds.length) {
        throw new Error('Some leads not found or do not belong to workspace');
      }

      // Create bulk operation
      const [operation] = await db
        .insert(bulkOperations)
        .values({
          workspaceId,
          operationType: operationType as any,
          operationName: operationName || `${operationType} ${leadIds.length} leads`,
          payload: payload || {},
          totalItems: leadIds.length,
          rollbackEnabled,
          rollbackWindowMinutes,
          rollbackDeadline: rollbackEnabled
            ? new Date(Date.now() + rollbackWindowMinutes * 60 * 1000)
            : null,
          createdBy: userId,
        })
        .returning();

      // Enqueue job for async processing
      await jobQueue.send('execute-bulk-operation', {
        operationId: operation.id,
        operationType,
        leadIds,
        payload,
        workspaceId,
      });

      return {
        success: true,
        operationId: operation.id,
        status: 'pending',
        message: `Bulk operation queued for ${leadIds.length} leads`,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        operationType: t.String(),
        operationName: t.String(),
        leadIds: t.Array(t.String()),
        payload: t.Optional(t.Any()),
        rollbackEnabled: t.Optional(t.Boolean()),
        rollbackWindowMinutes: t.Optional(t.Number()),
        userId: t.String(),
      }),
      detail: {
        tags: ['Bulk Operations'],
        summary: 'Create bulk operation',
        description: 'Create a generic bulk operation for leads',
      },
    }
  )

  /**
   * List all bulk operations for workspace
   * GET /api/v1/workspaces/:workspaceId/crm/bulk-operations
   */
  .get(
    '/',
    async ({ query }) => {
      const { workspaceId, limit = '50', offset = '0' } = query;

      const operations = await db
        .select()
        .from(bulkOperations)
        .where(eq(bulkOperations.workspaceId, workspaceId))
        .orderBy(desc(bulkOperations.createdAt))
        .limit(parseInt(limit, 10))
        .offset(parseInt(offset, 10));

      const total = await db
        .select({ count: sql<number>`count(*)` })
        .from(bulkOperations)
        .where(eq(bulkOperations.workspaceId, workspaceId));

      return {
        operations,
        pagination: {
          total: total[0]?.count || 0,
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Bulk Operations'],
        summary: 'List bulk operations',
        description: 'List all bulk operations for a workspace with pagination',
      },
    }
  )

  /**
   * Get single operation with progress
   * GET /api/v1/workspaces/:workspaceId/crm/bulk-operations/:operationId
   */
  .get(
    '/:operationId',
    async ({ params, query }) => {
      const { operationId } = params;
      const { workspaceId } = query;

      const operation = await db.query.bulkOperations.findFirst({
        where: and(
          eq(bulkOperations.id, operationId),
          eq(bulkOperations.workspaceId, workspaceId)
        ),
      });

      if (!operation) {
        throw new Error('Operation not found');
      }

      // Calculate progress percentage
      const progressPercentage =
        operation.totalItems > 0
          ? Math.round((operation.processedItems / operation.totalItems) * 100)
          : 0;

      // Check if rollback is still available
      const now = new Date();
      const rollbackAvailable =
        operation.rollbackEnabled &&
        operation.rollbackDeadline &&
        now < new Date(operation.rollbackDeadline);

      return {
        ...operation,
        progressPercentage,
        rollbackAvailable,
      };
    },
    {
      params: t.Object({
        operationId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Bulk Operations'],
        summary: 'Get bulk operation',
        description: 'Get single bulk operation with progress details',
      },
    }
  )

  /**
   * Bulk assign leads to agent
   * POST /api/v1/workspaces/:workspaceId/crm/bulk-assign
   */
  .post(
    '/assign',
    async ({ body, query }) => {
      const { workspaceId } = query;
      const { leadIds, agentId, operationName, rollbackEnabled = true } = body;

      if (!leadIds || leadIds.length === 0) {
        throw new Error('No leads specified');
      }

      // Validate leads exist and belong to workspace
      const leads = await db
        .select({ id: crmLeads.id })
        .from(crmLeads)
        .where(and(eq(crmLeads.workspaceId, workspaceId), inArray(crmLeads.id, leadIds)));

      if (leads.length !== leadIds.length) {
        throw new Error('Some leads not found or do not belong to workspace');
      }

      // Create bulk operation
      const [operation] = await db
        .insert(bulkOperations)
        .values({
          workspaceId,
          operationType: 'assign',
          operationName: operationName || `Assign ${leadIds.length} leads to agent`,
          payload: { agentId },
          totalItems: leadIds.length,
          rollbackEnabled,
          rollbackWindowMinutes: 5,
          rollbackDeadline: rollbackEnabled
            ? new Date(Date.now() + 5 * 60 * 1000)
            : null,
          createdBy: body.userId, // From auth middleware
        })
        .returning();

      // Enqueue job for async processing
      await jobQueue.send('execute-bulk-operation', {
        operationId: operation.id,
        operationType: 'assign',
        leadIds,
        payload: { agentId },
        workspaceId,
      });

      return {
        success: true,
        operationId: operation.id,
        message: `Bulk assignment queued for ${leadIds.length} leads`,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        leadIds: t.Array(t.String()),
        agentId: t.String(),
        operationName: t.Optional(t.String()),
        rollbackEnabled: t.Optional(t.Boolean()),
        userId: t.String(), // From auth middleware
      }),
      detail: {
        tags: ['Bulk Operations'],
        summary: 'Bulk assign leads',
        description: 'Assign multiple leads to an agent',
      },
    }
  )

  /**
   * Bulk update lead fields
   * POST /api/v1/workspaces/:workspaceId/crm/bulk-update
   */
  .post(
    '/update',
    async ({ body, query }) => {
      const { workspaceId } = query;
      const { leadIds, fields, operationName, rollbackEnabled = true } = body;

      if (!leadIds || leadIds.length === 0) {
        throw new Error('No leads specified');
      }

      if (!fields || Object.keys(fields).length === 0) {
        throw new Error('No fields to update');
      }

      // Validate leads exist and belong to workspace
      const leads = await db
        .select({ id: crmLeads.id })
        .from(crmLeads)
        .where(and(eq(crmLeads.workspaceId, workspaceId), inArray(crmLeads.id, leadIds)));

      if (leads.length !== leadIds.length) {
        throw new Error('Some leads not found or do not belong to workspace');
      }

      // Create bulk operation
      const [operation] = await db
        .insert(bulkOperations)
        .values({
          workspaceId,
          operationType: 'update',
          operationName: operationName || `Update ${leadIds.length} leads`,
          payload: { fields },
          totalItems: leadIds.length,
          rollbackEnabled,
          rollbackWindowMinutes: 5,
          rollbackDeadline: rollbackEnabled
            ? new Date(Date.now() + 5 * 60 * 1000)
            : null,
          createdBy: body.userId, // From auth middleware
        })
        .returning();

      // Enqueue job for async processing
      await jobQueue.send('execute-bulk-operation', {
        operationId: operation.id,
        operationType: 'update',
        leadIds,
        payload: { fields },
        workspaceId,
      });

      return {
        success: true,
        operationId: operation.id,
        message: `Bulk update queued for ${leadIds.length} leads`,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        leadIds: t.Array(t.String()),
        fields: t.Record(t.String(), t.Any()),
        operationName: t.Optional(t.String()),
        rollbackEnabled: t.Optional(t.Boolean()),
        userId: t.String(), // From auth middleware
      }),
      detail: {
        tags: ['Bulk Operations'],
        summary: 'Bulk update leads',
        description: 'Update multiple leads with new field values',
      },
    }
  )

  /**
   * Rollback operation (within 5-minute window)
   * POST /api/v1/workspaces/:workspaceId/crm/bulk-operations/:operationId/rollback
   */
  .post(
    '/:operationId/rollback',
    async ({ params, query, body }) => {
      const { operationId } = params;
      const { workspaceId } = query;
      const { userId } = body;

      // Get operation
      const operation = await db.query.bulkOperations.findFirst({
        where: and(
          eq(bulkOperations.id, operationId),
          eq(bulkOperations.workspaceId, workspaceId)
        ),
      });

      if (!operation) {
        throw new Error('Operation not found');
      }

      // Check if rollback is enabled
      if (!operation.rollbackEnabled) {
        throw new Error('Rollback not enabled for this operation');
      }

      // Check if rollback window has expired
      const now = new Date();
      if (operation.rollbackDeadline && now > new Date(operation.rollbackDeadline)) {
        throw new Error('Rollback window has expired (5 minutes)');
      }

      // Check if operation is completed
      if (operation.status !== 'completed') {
        throw new Error('Can only rollback completed operations');
      }

      // Get all successful items
      const items = await db
        .select()
        .from(bulkOperationItems)
        .where(
          and(
            eq(bulkOperationItems.operationId, operationId),
            eq(bulkOperationItems.status, 'success')
          )
        );

      if (items.length === 0) {
        throw new Error('No items to rollback');
      }

      // Rollback each item
      let rolledBack = 0;
      for (const item of items) {
        if (!item.beforeState) {
          continue;
        }

        try {
          // Restore previous state (only updateable fields)
          const beforeState = item.beforeState as any;
          const rollbackFields: any = {
            updatedAt: new Date(),
          };

          // Only include fields that exist in beforeState
          if ('ownerId' in beforeState) rollbackFields.ownerId = beforeState.ownerId;
          if ('status' in beforeState) rollbackFields.status = beforeState.status;
          if ('firstName' in beforeState) rollbackFields.firstName = beforeState.firstName;
          if ('lastName' in beforeState) rollbackFields.lastName = beforeState.lastName;
          if ('email' in beforeState) rollbackFields.email = beforeState.email;
          if ('phone' in beforeState) rollbackFields.phone = beforeState.phone;
          if ('companyName' in beforeState) rollbackFields.companyName = beforeState.companyName;
          if ('source' in beforeState) rollbackFields.source = beforeState.source;
          if ('propensityScore' in beforeState) rollbackFields.propensityScore = beforeState.propensityScore;

          await db
            .update(crmLeads)
            .set(rollbackFields)
            .where(eq(crmLeads.id, item.leadId));

          rolledBack++;
        } catch (error) {
          console.error(`Failed to rollback lead ${item.leadId}:`, error);
        }
      }

      // Create rollback operation record
      const [rollbackOperation] = await db
        .insert(bulkOperations)
        .values({
          workspaceId,
          operationType: 'rollback',
          operationName: `Rollback of operation ${operation.operationName}`,
          payload: { originalOperationId: operationId },
          totalItems: items.length,
          processedItems: rolledBack,
          successfulItems: rolledBack,
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          rollbackEnabled: false,
          createdBy: userId,
        })
        .returning();

      return {
        success: true,
        rolledBack,
        total: items.length,
        rollbackOperationId: rollbackOperation.id,
      };
    },
    {
      params: t.Object({
        operationId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        userId: t.String(), // From auth middleware
      }),
      detail: {
        tags: ['Bulk Operations'],
        summary: 'Rollback bulk operation',
        description: 'Rollback a completed bulk operation (within 5-minute window)',
      },
    }
  );
