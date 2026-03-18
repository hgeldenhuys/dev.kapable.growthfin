/**
 * Add Memory Tool Service
 * Allows AI to store important patterns, decisions, or facts in workspace memory
 */

import { MemoryService, type MemoryType } from '../intelligence/memory.service';

export interface AddMemoryParams {
  type: string; // 'pattern' | 'decision' | 'preference' | 'fact'
  key: string;
  value: string;
  category?: string;
  relatedFiles?: string[];
}

export interface AddMemoryResult {
  stored: boolean;
  memoryId: string;
  message: string;
}

export class AddMemoryError extends Error {
  constructor(message: string, public code: string = 'ADD_MEMORY_ERROR') {
    super(message);
    this.name = 'AddMemoryError';
  }
}

export class AddMemoryService {
  /**
   * Valid memory types
   */
  private static readonly VALID_TYPES: MemoryType[] = ['pattern', 'decision', 'preference', 'fact'];

  /**
   * Validate add_memory parameters
   */
  static validateParams(params: any): AddMemoryParams {
    if (!params || typeof params !== 'object') {
      throw new AddMemoryError('Parameters must be an object', 'INVALID_PARAMS');
    }

    if (!params.type || typeof params.type !== 'string') {
      throw new AddMemoryError('Type parameter is required and must be a string', 'INVALID_TYPE');
    }

    if (!this.VALID_TYPES.includes(params.type as MemoryType)) {
      throw new AddMemoryError(
        `Type must be one of: ${this.VALID_TYPES.join(', ')}`,
        'INVALID_TYPE_VALUE'
      );
    }

    if (!params.key || typeof params.key !== 'string') {
      throw new AddMemoryError('Key parameter is required and must be a string', 'INVALID_KEY');
    }

    if (params.key.trim().length === 0) {
      throw new AddMemoryError('Key cannot be empty', 'EMPTY_KEY');
    }

    if (!params.value || typeof params.value !== 'string') {
      throw new AddMemoryError('Value parameter is required and must be a string', 'INVALID_VALUE');
    }

    if (params.value.trim().length === 0) {
      throw new AddMemoryError('Value cannot be empty', 'EMPTY_VALUE');
    }

    if (params.category && typeof params.category !== 'string') {
      throw new AddMemoryError('Category must be a string', 'INVALID_CATEGORY');
    }

    if (params.relatedFiles && !Array.isArray(params.relatedFiles)) {
      throw new AddMemoryError('relatedFiles must be an array', 'INVALID_RELATED_FILES');
    }

    if (params.relatedFiles) {
      for (const file of params.relatedFiles) {
        if (typeof file !== 'string') {
          throw new AddMemoryError('All relatedFiles must be strings', 'INVALID_RELATED_FILE');
        }
      }
    }

    return {
      type: params.type,
      key: params.key.trim(),
      value: params.value.trim(),
      category: params.category,
      relatedFiles: params.relatedFiles || [],
    };
  }

  /**
   * Add memory to workspace
   *
   * @param params - Memory parameters
   * @param workspaceId - Workspace ID
   * @param conversationId - Conversation ID (for linking)
   * @returns Add memory result
   * @throws AddMemoryError if parameters are invalid
   */
  static async addMemory(
    params: AddMemoryParams,
    workspaceId: string,
    conversationId: string
  ): Promise<AddMemoryResult> {
    // Store the memory
    const memory = await MemoryService.addMemory({
      workspaceId,
      type: params.type as MemoryType,
      key: params.key,
      value: params.value,
      category: params.category,
      conversationId,
      relatedFiles: params.relatedFiles,
      confidence: 1.0, // High confidence for explicitly added memories
    });

    return {
      stored: true,
      memoryId: memory.id,
      message: `Stored ${params.type}: ${params.key}`,
    };
  }
}
