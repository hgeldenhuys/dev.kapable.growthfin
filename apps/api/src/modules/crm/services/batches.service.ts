/**
 * Batches Service
 * Manages batch planning, lifecycle, and execution
 */

import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  crmBatches,
  type CrmBatch,
  type NewCrmBatch,
  type BatchStatus,
  type BatchType,
} from '@agios/db';

/**
 * Batch Type Registry
 * Extensible pattern for adding new batch types
 */
export interface BatchTypeHandler {
  name: string;
  validateConfiguration: (config: any) => { valid: boolean; errors?: string[] };
  execute?: (batch: CrmBatch, db: PostgresJsDatabase) => Promise<void>;
}

const batchTypeRegistry = new Map<BatchType, BatchTypeHandler>();

/**
 * Register a batch type handler
 */
export function registerBatchType(type: BatchType, handler: BatchTypeHandler) {
  batchTypeRegistry.set(type, handler);
}

/**
 * Get batch type handler
 */
export function getBatchTypeHandler(type: BatchType): BatchTypeHandler | undefined {
  return batchTypeRegistry.get(type);
}

/**
 * Batch State Machine
 * Defines valid state transitions
 */
const STATE_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  planned: ['scheduled', 'running', 'cancelled'], // Allow direct execution
  scheduled: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [], // Terminal state
  failed: ['planned'], // Can retry by resetting to planned
  cancelled: [], // Terminal state
};

/**
 * Validate state transition
 */
export function canTransitionTo(from: BatchStatus, to: BatchStatus): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Batches Service
 */
export class BatchesService {
  /**
   * Create a new batch
   */
  static async create(
    db: PostgresJsDatabase,
    data: NewCrmBatch
  ): Promise<CrmBatch> {
    // Validate configuration based on batch type
    const handler = getBatchTypeHandler(data.type);
    if (handler) {
      const validation = handler.validateConfiguration(data.configuration);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors?.join(', ')}`);
      }
    }

    const [batch] = await db
      .insert(crmBatches)
      .values({
        ...data,
        status: 'planned',
      })
      .returning();

    return batch;
  }

  /**
   * Get batch by ID
   */
  static async getById(
    db: PostgresJsDatabase,
    batchId: string,
    workspaceId: string
  ): Promise<CrmBatch | null> {
    const [batch] = await db
      .select()
      .from(crmBatches)
      .where(
        and(
          eq(crmBatches.id, batchId),
          eq(crmBatches.workspaceId, workspaceId),
          sql`${crmBatches.deletedAt} IS NULL`
        )
      );

    return batch ?? null;
  }

  /**
   * List batches with filters
   */
  static async list(
    db: PostgresJsDatabase,
    filters: {
      workspaceId: string;
      listId?: string;
      type?: BatchType;
      status?: BatchStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ batches: CrmBatch[]; total: number }> {
    const conditions = [
      eq(crmBatches.workspaceId, filters.workspaceId),
      sql`${crmBatches.deletedAt} IS NULL`,
    ];

    if (filters.listId) {
      conditions.push(eq(crmBatches.listId, filters.listId));
    }
    if (filters.type) {
      conditions.push(eq(crmBatches.type, filters.type));
    }
    if (filters.status) {
      conditions.push(eq(crmBatches.status, filters.status));
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmBatches)
      .where(and(...conditions));

    // Get batches
    const batches = await db
      .select()
      .from(crmBatches)
      .where(and(...conditions))
      .orderBy(desc(crmBatches.createdAt))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);

    return {
      batches,
      total: Number(count),
    };
  }

  /**
   * Update batch
   */
  static async update(
    db: PostgresJsDatabase,
    batchId: string,
    workspaceId: string,
    updates: Partial<NewCrmBatch> & { updatedBy?: string }
  ): Promise<CrmBatch> {
    // Validate configuration if provided
    if (updates.configuration !== undefined && updates.type) {
      const handler = getBatchTypeHandler(updates.type);
      if (handler) {
        const validation = handler.validateConfiguration(updates.configuration);
        if (!validation.valid) {
          throw new Error(`Invalid configuration: ${validation.errors?.join(', ')}`);
        }
      }
    }

    const [batch] = await db
      .update(crmBatches)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmBatches.id, batchId),
          eq(crmBatches.workspaceId, workspaceId),
          sql`${crmBatches.deletedAt} IS NULL`
        )
      )
      .returning();

    if (!batch) {
      throw new Error('Batch not found');
    }

    return batch;
  }

  /**
   * Change batch status with state machine validation
   */
  static async changeStatus(
    db: PostgresJsDatabase,
    batchId: string,
    workspaceId: string,
    newStatus: BatchStatus,
    updatedBy?: string
  ): Promise<CrmBatch> {
    // Get current batch
    const batch = await this.getById(db, batchId, workspaceId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    // Validate state transition
    if (!canTransitionTo(batch.status, newStatus)) {
      throw new Error(
        `Invalid state transition: cannot move from ${batch.status} to ${newStatus}`
      );
    }

    // Update timestamps based on new status
    const updates: Partial<NewCrmBatch> = {
      status: newStatus,
      updatedBy,
    };

    if (newStatus === 'running' && !batch.startedAt) {
      updates.startedAt = new Date();
    }
    if (['completed', 'failed', 'cancelled'].includes(newStatus) && !batch.completedAt) {
      updates.completedAt = new Date();
    }

    return this.update(db, batchId, workspaceId, updates);
  }

  /**
   * Delete batch (hard delete, only if status is planned)
   */
  static async delete(
    db: PostgresJsDatabase,
    batchId: string,
    workspaceId: string
  ): Promise<void> {
    const batch = await this.getById(db, batchId, workspaceId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    // Only allow deletion of planned batches
    if (batch.status !== 'planned') {
      throw new Error(`Cannot delete batch with status: ${batch.status}. Only planned batches can be deleted.`);
    }

    await db
      .delete(crmBatches)
      .where(
        and(
          eq(crmBatches.id, batchId),
          eq(crmBatches.workspaceId, workspaceId)
        )
      );
  }
}

/**
 * Enrichment Batch Type Handler
 */
export const enrichmentBatchHandler: BatchTypeHandler = {
  name: 'enrichment',
  validateConfiguration: (config: any) => {
    const errors: string[] = [];

    if (!config.templateId || typeof config.templateId !== 'string') {
      errors.push('templateId is required and must be a string');
    }

    if (config.budgetLimit !== undefined) {
      if (typeof config.budgetLimit !== 'number' || config.budgetLimit <= 0) {
        errors.push('budgetLimit must be a positive number');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  /**
   * Execute enrichment batch
   * Creates enrichment job from batch + template, queues pg-boss job
   */
  async execute(batch: CrmBatch, db: PostgresJsDatabase) {
    const { id: batchId, workspaceId, listId, configuration } = batch;
    const { templateId, budgetLimit } = configuration as { templateId: string; budgetLimit?: number };

    // Import services here to avoid circular dependency
    const { templatesService } = await import('./templates.service');
    const { enrichmentService } = await import('./enrichment');
    const { crmContactListMemberships } = await import('@agios/db');
    const { jobQueue } = await import('../../../lib/queue');
    const { eq, and, isNull } = await import('drizzle-orm');

    // 1. Get and validate template
    const template = await templatesService.getById(db, templateId, workspaceId);
    if (!template) {
      throw new Error(`Template ${templateId} not found or deleted`);
    }

    // Check if template is deleted
    if (template.deletedAt) {
      throw new Error(`Template ${templateId} has been deleted and cannot be used`);
    }

    // 2. Get list members (supports both contacts and leads)
    const listMembers = await db
      .select({
        contactId: crmContactListMemberships.entityId,
        entityType: crmContactListMemberships.entityType
      })
      .from(crmContactListMemberships)
      .where(
        and(
          eq(crmContactListMemberships.listId, listId),
          eq(crmContactListMemberships.workspaceId, workspaceId),
          eq(crmContactListMemberships.isActive, true),
          isNull(crmContactListMemberships.deletedAt)
        )
      );

    if (listMembers.length === 0) {
      throw new Error('No contacts or leads found in the selected list');
    }

    // 3. Create enrichment job from batch
    const job = await enrichmentService.createJob(db, {
      workspaceId,
      name: `Batch: ${batch.name}`,
      description: batch.description || template.description,
      type: 'enhancement',
      mode: 'batch', // Always batch mode for batch execution
      sampleSize: 1, // Not used in batch mode
      sourceListId: listId,
      batchId: batchId, // Link to batch
      model: template.model,
      prompt: template.prompt,
      temperature: template.temperature,
      maxTokens: template.maxTokens,
      budgetLimit: budgetLimit ? String(budgetLimit) : null,
      ownerId: batch.createdBy,
      createdBy: batch.createdBy,
    });

    // 4. Queue pg-boss job
    await jobQueue.send('execute-enrichment', {
      jobId: job.id,
      batchId: batch.id,
      workspaceId,
      mode: 'batch',
    });

    return job;
  },
};

// Register built-in batch types
registerBatchType('enrichment', enrichmentBatchHandler);

/**
 * Export Batch Type Handler
 */
export const exportBatchHandler: BatchTypeHandler = {
  name: 'export',
  validateConfiguration: (config: any) => {
    const errors: string[] = [];

    if (!config.format || typeof config.format !== 'string') {
      errors.push('format is required (e.g., csv, json)');
    }

    if (!Array.isArray(config.fields) || config.fields.length === 0) {
      errors.push('fields array is required and must not be empty');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

registerBatchType('export', exportBatchHandler);

/**
 * Segmentation Batch Type Handler
 */
export const segmentationBatchHandler: BatchTypeHandler = {
  name: 'segmentation',
  validateConfiguration: (config: any) => {
    const errors: string[] = [];

    if (!config.criteria || typeof config.criteria !== 'object') {
      errors.push('criteria object is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

registerBatchType('segmentation', segmentationBatchHandler);

/**
 * Scoring Batch Type Handler
 */
export const scoringBatchHandler: BatchTypeHandler = {
  name: 'scoring',
  validateConfiguration: (config: any) => {
    const errors: string[] = [];

    if (!config.modelId || typeof config.modelId !== 'string') {
      errors.push('modelId is required and must be a string');
    }

    if (config.threshold !== undefined) {
      if (typeof config.threshold !== 'number' || config.threshold < 0 || config.threshold > 100) {
        errors.push('threshold must be a number between 0 and 100');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

registerBatchType('scoring', scoringBatchHandler);
