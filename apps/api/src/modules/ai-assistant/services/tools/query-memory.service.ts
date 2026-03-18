/**
 * Query Memory Tool Service
 * Allows AI to query workspace memory for patterns, decisions, preferences, and facts
 */

import { MemoryService } from '../intelligence/memory.service';

export interface QueryMemoryParams {
  query: string;
  category?: string;
}

export interface QueryMemoryResult {
  found: number;
  memories: Array<{
    type: string;
    key: string;
    value: string;
    confidence: number;
    sourceConversation?: string | null;
    relatedFiles: string[];
    createdAt: Date;
  }>;
}

export class QueryMemoryError extends Error {
  constructor(message: string, public code: string = 'QUERY_MEMORY_ERROR') {
    super(message);
    this.name = 'QueryMemoryError';
  }
}

export class QueryMemoryService {
  /**
   * Validate query_memory parameters
   */
  static validateParams(params: any): QueryMemoryParams {
    if (!params || typeof params !== 'object') {
      throw new QueryMemoryError('Parameters must be an object', 'INVALID_PARAMS');
    }

    if (!params.query || typeof params.query !== 'string') {
      throw new QueryMemoryError('Query parameter is required and must be a string', 'INVALID_QUERY');
    }

    if (params.query.trim().length === 0) {
      throw new QueryMemoryError('Query cannot be empty', 'EMPTY_QUERY');
    }

    if (params.category && typeof params.category !== 'string') {
      throw new QueryMemoryError('Category must be a string', 'INVALID_CATEGORY');
    }

    return {
      query: params.query.trim(),
      category: params.category,
    };
  }

  /**
   * Query workspace memory
   *
   * @param params - Query parameters
   * @param workspaceId - Workspace ID
   * @returns Query results
   * @throws QueryMemoryError if parameters are invalid
   */
  static async queryMemory(
    params: QueryMemoryParams,
    workspaceId: string
  ): Promise<QueryMemoryResult> {
    // Search memories using keyword/tag matching
    const memories = await MemoryService.searchMemory(workspaceId, params.query);

    // Filter by category if provided
    const filtered = params.category
      ? memories.filter(m => m.category === params.category)
      : memories;

    // Mark memories as accessed
    for (const memory of filtered) {
      await MemoryService.markAccessed(memory.id);
    }

    // Format response
    return {
      found: filtered.length,
      memories: filtered.map(m => ({
        type: m.memoryType,
        key: m.key,
        value: m.value,
        confidence: m.confidence,
        sourceConversation: m.sourceConversationId,
        relatedFiles: m.relatedFiles,
        createdAt: m.createdAt,
      })),
    };
  }
}
