/**
 * Workspace Memory Service
 *
 * Manages workspace memory for storing and retrieving patterns, decisions,
 * preferences, and facts across conversations.
 */

import { db } from '@agios/db';
import { workspaceMemory, type MemoryType, type MemoryStatus, type WorkspaceMemory } from '@agios/db/schema';
import { eq, and, desc, or, sql, like, inArray } from 'drizzle-orm';

export interface Memory {
  id: string;
  workspaceId: string;
  memoryType: MemoryType;
  category?: string | null;
  key: string;
  value: string;
  confidence: number;
  sourceConversationId?: string | null;
  relatedFiles: string[];
  tags: string[];
  status: MemoryStatus;
  supersededBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastAccessed: Date;
}

export interface AddMemoryParams {
  workspaceId: string;
  type: MemoryType;
  key: string;
  value: string;
  category?: string;
  conversationId?: string;
  relatedFiles?: string[];
  tags?: string[];
  confidence?: number;
}

export interface UpdateMemoryParams {
  value?: string;
  confidence?: number;
  status?: MemoryStatus;
  supersededBy?: string;
}

export interface MemoryFilters {
  type?: MemoryType;
  category?: string;
  status?: MemoryStatus;
  minConfidence?: number;
}

export class MemoryService {
  /**
   * Add a new memory to the workspace
   */
  static async addMemory(params: AddMemoryParams): Promise<Memory> {
    const memory = await db.insert(workspaceMemory).values({
      workspaceId: params.workspaceId,
      memoryType: params.type,
      key: params.key,
      value: params.value,
      category: params.category,
      sourceConversationId: params.conversationId,
      relatedFiles: params.relatedFiles || [],
      tags: params.tags || [],
      confidence: params.confidence ?? 1.0,
      status: 'active',
      lastAccessed: new Date(),
    }).returning();

    return memory[0] as Memory;
  }

  /**
   * Get memories with optional filters
   */
  static async getMemories(
    workspaceId: string,
    filters?: MemoryFilters
  ): Promise<Memory[]> {
    let query = db.select()
      .from(workspaceMemory)
      .where(eq(workspaceMemory.workspaceId, workspaceId))
      .$dynamic();

    // Apply filters
    if (filters?.type) {
      query = query.where(eq(workspaceMemory.memoryType, filters.type));
    }

    if (filters?.category) {
      query = query.where(eq(workspaceMemory.category, filters.category));
    }

    if (filters?.status) {
      query = query.where(eq(workspaceMemory.status, filters.status));
    }

    if (filters?.minConfidence !== undefined) {
      query = query.where(sql`${workspaceMemory.confidence} >= ${filters.minConfidence}`);
    }

    // Order by confidence DESC, lastAccessed DESC
    const memories = await query
      .orderBy(desc(workspaceMemory.confidence), desc(workspaceMemory.lastAccessed));

    return memories as Memory[];
  }

  /**
   * Search memories using keyword and tag matching
   */
  static async searchMemory(
    workspaceId: string,
    query: string
  ): Promise<Memory[]> {
    const searchTerm = `%${query.toLowerCase()}%`;

    const memories = await db.select()
      .from(workspaceMemory)
      .where(
        and(
          eq(workspaceMemory.workspaceId, workspaceId),
          eq(workspaceMemory.status, 'active'),
          or(
            sql`LOWER(${workspaceMemory.key}) LIKE ${searchTerm}`,
            sql`LOWER(${workspaceMemory.value}) LIKE ${searchTerm}`,
            sql`EXISTS (
              SELECT 1 FROM unnest(${workspaceMemory.tags}) tag
              WHERE LOWER(tag) LIKE ${searchTerm}
            )`
          )
        )
      )
      .orderBy(desc(workspaceMemory.confidence), desc(workspaceMemory.lastAccessed))
      .limit(10);

    return memories as Memory[];
  }

  /**
   * Get a specific memory by ID
   */
  static async getMemoryById(memoryId: string): Promise<Memory | null> {
    const memory = await db.select()
      .from(workspaceMemory)
      .where(eq(workspaceMemory.id, memoryId))
      .limit(1);

    return memory[0] as Memory || null;
  }

  /**
   * Update an existing memory
   */
  static async updateMemory(
    memoryId: string,
    updates: UpdateMemoryParams
  ): Promise<Memory> {
    const updated = await db.update(workspaceMemory)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(workspaceMemory.id, memoryId))
      .returning();

    return updated[0] as Memory;
  }

  /**
   * Mark a memory as accessed (for tracking usage)
   */
  static async markAccessed(memoryId: string): Promise<void> {
    await db.update(workspaceMemory)
      .set({ lastAccessed: new Date() })
      .where(eq(workspaceMemory.id, memoryId));
  }

  /**
   * Delete a memory permanently
   */
  static async deleteMemory(memoryId: string): Promise<void> {
    await db.delete(workspaceMemory)
      .where(eq(workspaceMemory.id, memoryId));
  }

  /**
   * Add a decision memory with optional superseding of old decision
   */
  static async addDecision(params: {
    workspaceId: string;
    key: string;
    decision: string;
    rationale?: string;
    conversationId: string;
    supersedes?: string; // ID of old decision
  }): Promise<Memory> {
    // Create the value with optional rationale
    const value = params.rationale
      ? `${params.decision}\n\nRationale: ${params.rationale}`
      : params.decision;

    const memory = await this.addMemory({
      workspaceId: params.workspaceId,
      type: 'decision',
      key: params.key,
      value,
      category: 'decisions',
      conversationId: params.conversationId,
      tags: ['decision'],
      confidence: 1.0,
    });

    // If supersedes, mark old decision now that we have the new ID
    if (params.supersedes) {
      await this.updateMemory(params.supersedes, {
        status: 'superseded',
        supersededBy: memory.id,
      });
    }

    return memory;
  }

  /**
   * Get decision history for a specific key
   */
  static async getDecisionHistory(
    workspaceId: string,
    key: string
  ): Promise<Memory[]> {
    const decisions = await db.select()
      .from(workspaceMemory)
      .where(
        and(
          eq(workspaceMemory.workspaceId, workspaceId),
          eq(workspaceMemory.key, key),
          eq(workspaceMemory.memoryType, 'decision')
        )
      )
      .orderBy(desc(workspaceMemory.createdAt));

    return decisions as Memory[];
  }

  /**
   * Get the active decision for a specific key
   */
  static async getActiveDecision(
    workspaceId: string,
    key: string
  ): Promise<Memory | null> {
    const decision = await db.select()
      .from(workspaceMemory)
      .where(
        and(
          eq(workspaceMemory.workspaceId, workspaceId),
          eq(workspaceMemory.key, key),
          eq(workspaceMemory.memoryType, 'decision'),
          eq(workspaceMemory.status, 'active')
        )
      )
      .limit(1);

    return decision[0] as Memory || null;
  }

  /**
   * Add a preference (user-level or workspace-level)
   */
  static async addPreference(params: {
    workspaceId: string;
    userId?: string; // If null, workspace-level
    category: string;
    key: string;
    value: string;
  }): Promise<Memory> {
    const prefKey = params.userId
      ? `user:${params.userId}:${params.key}`
      : params.key;

    return this.addMemory({
      workspaceId: params.workspaceId,
      type: 'preference',
      category: params.category,
      key: prefKey,
      value: params.value,
      tags: ['preference', params.category],
      confidence: 1.0,
    });
  }

  /**
   * Get preferences with optional filtering
   */
  static async getPreferences(
    workspaceId: string,
    options?: {
      userId?: string;
      category?: string;
    }
  ): Promise<Memory[]> {
    let query = db.select()
      .from(workspaceMemory)
      .where(
        and(
          eq(workspaceMemory.workspaceId, workspaceId),
          eq(workspaceMemory.memoryType, 'preference'),
          eq(workspaceMemory.status, 'active')
        )
      )
      .$dynamic();

    if (options?.userId) {
      query = query.where(
        like(workspaceMemory.key, `user:${options.userId}:%`)
      );
    }

    if (options?.category) {
      query = query.where(eq(workspaceMemory.category, options.category));
    }

    const prefs = await query;
    return prefs as Memory[];
  }

  /**
   * Get effective preference (user overrides workspace)
   */
  static async getEffectivePreference(
    workspaceId: string,
    key: string,
    userId?: string
  ): Promise<Memory | null> {
    // Try user-level first
    if (userId) {
      const userPref = await db.select()
        .from(workspaceMemory)
        .where(
          and(
            eq(workspaceMemory.workspaceId, workspaceId),
            eq(workspaceMemory.key, `user:${userId}:${key}`),
            eq(workspaceMemory.status, 'active')
          )
        )
        .limit(1);

      if (userPref[0]) return userPref[0] as Memory;
    }

    // Fall back to workspace-level
    const workspacePref = await db.select()
      .from(workspaceMemory)
      .where(
        and(
          eq(workspaceMemory.workspaceId, workspaceId),
          eq(workspaceMemory.key, key),
          eq(workspaceMemory.status, 'active')
        )
      )
      .limit(1);

    return workspacePref[0] as Memory || null;
  }
}
