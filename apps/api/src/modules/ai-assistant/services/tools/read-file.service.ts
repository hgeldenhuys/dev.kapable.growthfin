/**
 * Read File Tool Service
 * Allows AI to read file contents within workspace
 */

import { readFile, stat } from 'node:fs/promises';
import { SecurityService, SecurityError } from './security.service';

export interface ReadFileParams {
  path: string;
  lineStart?: number;
  lineEnd?: number;
  fullContent?: boolean; // If true, always return full content (skip progressive loading)
  workspaceId?: string; // Required for progressive loading
}

export interface ReadFileResult {
  content: string;
  path: string;
  relativePath: string;
  size: number;
  mtime: string;
  lines?: {
    start: number;
    end: number;
    total: number;
  };
  type?: 'full' | 'summary' | 'excerpt'; // Indicates type of content returned
  entityCount?: number; // Number of entities in summary
  tokensSaved?: number; // Tokens saved by returning summary instead of full content
  hint?: string; // Hint to user about progressive loading
}

export class ReadFileError extends Error {
  constructor(message: string, public code: string = 'READ_FILE_ERROR') {
    super(message);
    this.name = 'ReadFileError';
  }
}

export class ReadFileService {
  /**
   * Maximum file size to read (10MB)
   */
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Read file contents with optional line range
   *
   * @param params - Read file parameters
   * @param workspaceRoot - Absolute path to workspace root
   * @returns File contents and metadata
   * @throws SecurityError if path is invalid
   * @throws ReadFileError if file cannot be read
   */
  static async readFile(
    params: ReadFileParams,
    workspaceRoot: string
  ): Promise<ReadFileResult> {
    const startTime = Date.now();

    // Validate workspace root
    await SecurityService.validateWorkspaceRoot(workspaceRoot);

    // Validate and resolve path
    const absolutePath = SecurityService.validatePath(workspaceRoot, params.path);

    // Check if file exists
    const accessible = await SecurityService.isAccessible(absolutePath);
    if (!accessible) {
      throw new ReadFileError(
        `File not found: ${params.path}`,
        'FILE_NOT_FOUND'
      );
    }

    // Get file stats
    let stats;
    try {
      stats = await stat(absolutePath);
    } catch (error) {
      throw new ReadFileError(
        `Cannot access file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FILE_ACCESS_ERROR'
      );
    }

    // Check if it's a file (not directory)
    if (!stats.isFile()) {
      throw new ReadFileError(
        `Path is not a file: ${params.path}`,
        'NOT_A_FILE'
      );
    }

    // Check file size
    if (stats.size > this.MAX_FILE_SIZE) {
      throw new ReadFileError(
        `File too large: ${stats.size} bytes (max ${this.MAX_FILE_SIZE} bytes)`,
        'FILE_TOO_LARGE'
      );
    }

    // Read file content
    let content: string;
    try {
      const buffer = await readFile(absolutePath);
      content = buffer.toString('utf-8');
    } catch (error) {
      // Check if it's a binary file
      if (error instanceof Error && error.message.includes('invalid')) {
        throw new ReadFileError(
          'File appears to be binary (not UTF-8 text)',
          'BINARY_FILE'
        );
      }
      throw new ReadFileError(
        `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'READ_ERROR'
      );
    }

    // Apply line range if specified
    let lineInfo: ReadFileResult['lines'] | undefined;
    if (params.lineStart !== undefined || params.lineEnd !== undefined) {
      const lines = content.split('\n');
      const start = Math.max(1, params.lineStart ?? 1);
      const end = Math.min(lines.length, params.lineEnd ?? lines.length);

      if (start > lines.length) {
        throw new ReadFileError(
          `Line start ${start} exceeds file length ${lines.length}`,
          'INVALID_LINE_RANGE'
        );
      }

      // Extract lines (convert from 1-indexed to 0-indexed)
      const selectedLines = lines.slice(start - 1, end);
      content = selectedLines.join('\n');

      lineInfo = {
        start,
        end,
        total: lines.length,
      };
    }

    const duration = Date.now() - startTime;
    const type = lineInfo ? 'excerpt' : 'full';
    console.log(`[read_file] Read ${params.path} (${stats.size} bytes) in ${duration}ms [${type}]`);

    return {
      content,
      path: absolutePath,
      relativePath: SecurityService.getRelativePath(workspaceRoot, absolutePath),
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      lines: lineInfo,
      type,
    };
  }

  /**
   * Validate read file parameters
   *
   * @param params - Parameters to validate
   * @throws ReadFileError if parameters are invalid
   */
  static validateParams(params: any): ReadFileParams {
    if (!params || typeof params !== 'object') {
      throw new ReadFileError('Parameters must be an object', 'INVALID_PARAMS');
    }

    if (!params.path || typeof params.path !== 'string') {
      throw new ReadFileError('path parameter is required and must be a string', 'INVALID_PARAMS');
    }

    if (params.lineStart !== undefined) {
      if (typeof params.lineStart !== 'number' || params.lineStart < 1) {
        throw new ReadFileError('lineStart must be a positive integer', 'INVALID_PARAMS');
      }
    }

    if (params.lineEnd !== undefined) {
      if (typeof params.lineEnd !== 'number' || params.lineEnd < 1) {
        throw new ReadFileError('lineEnd must be a positive integer', 'INVALID_PARAMS');
      }
    }

    if (params.lineStart !== undefined && params.lineEnd !== undefined) {
      if (params.lineStart > params.lineEnd) {
        throw new ReadFileError('lineStart cannot be greater than lineEnd', 'INVALID_PARAMS');
      }
    }

    if (params.fullContent !== undefined && typeof params.fullContent !== 'boolean') {
      throw new ReadFileError('fullContent must be a boolean', 'INVALID_PARAMS');
    }

    if (params.workspaceId !== undefined && typeof params.workspaceId !== 'string') {
      throw new ReadFileError('workspaceId must be a string', 'INVALID_PARAMS');
    }

    return {
      path: params.path,
      lineStart: params.lineStart,
      lineEnd: params.lineEnd,
      fullContent: params.fullContent,
      workspaceId: params.workspaceId,
    };
  }
}
