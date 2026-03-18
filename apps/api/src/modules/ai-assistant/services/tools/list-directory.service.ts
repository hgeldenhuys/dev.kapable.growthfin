/**
 * List Directory Tool Service
 * Allows AI to list directory contents within workspace
 */

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { SecurityService, SecurityError } from './security.service';

export interface ListDirectoryParams {
  path?: string;
  depth?: number;
}

export interface DirectoryItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  mtime?: string;
  children?: DirectoryItem[];
}

export interface ListDirectoryResult {
  items: DirectoryItem[];
  path: string;
  relativePath: string;
  totalItems: number;
}

export class ListDirectoryError extends Error {
  constructor(message: string, public code: string = 'LIST_DIRECTORY_ERROR') {
    super(message);
    this.name = 'ListDirectoryError';
  }
}

export class ListDirectoryService {
  /**
   * Default maximum depth
   */
  private static readonly DEFAULT_DEPTH = 2;

  /**
   * Maximum allowed depth
   */
  private static readonly MAX_DEPTH = 3;

  /**
   * Maximum items to list (to prevent performance issues)
   */
  private static readonly MAX_ITEMS = 1000;

  /**
   * Patterns to ignore (similar to .gitignore)
   */
  private static readonly IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.cache',
    'coverage',
    '.DS_Store',
    'Thumbs.db',
  ];

  /**
   * List directory contents with optional depth
   *
   * @param params - List directory parameters
   * @param workspaceRoot - Absolute path to workspace root
   * @returns Directory listing
   * @throws SecurityError if path is invalid
   * @throws ListDirectoryError if listing fails
   */
  static async listDirectory(
    params: ListDirectoryParams,
    workspaceRoot: string
  ): Promise<ListDirectoryResult> {
    const startTime = Date.now();

    // Validate workspace root
    await SecurityService.validateWorkspaceRoot(workspaceRoot);

    // Validate and sanitize params
    const validatedParams = this.validateParams(params);

    // Resolve directory path (default to workspace root)
    const dirPath = validatedParams.path || '.';
    const absolutePath = SecurityService.validatePath(workspaceRoot, dirPath);

    // Check if directory exists
    const accessible = await SecurityService.isAccessible(absolutePath);
    if (!accessible) {
      throw new ListDirectoryError(
        `Directory not found: ${dirPath}`,
        'DIRECTORY_NOT_FOUND'
      );
    }

    // Check if it's a directory
    let stats;
    try {
      stats = await stat(absolutePath);
    } catch (error) {
      throw new ListDirectoryError(
        `Cannot access directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DIRECTORY_ACCESS_ERROR'
      );
    }

    if (!stats.isDirectory()) {
      throw new ListDirectoryError(
        `Path is not a directory: ${dirPath}`,
        'NOT_A_DIRECTORY'
      );
    }

    // List directory recursively
    let itemCount = 0;
    const items = await this.listRecursive(
      absolutePath,
      workspaceRoot,
      validatedParams.depth!,
      0,
      () => ++itemCount
    );

    const duration = Date.now() - startTime;
    console.log(
      `[list_directory] Listed ${itemCount} items in "${dirPath}" (depth ${validatedParams.depth}) in ${duration}ms`
    );

    return {
      items,
      path: absolutePath,
      relativePath: SecurityService.getRelativePath(workspaceRoot, absolutePath),
      totalItems: itemCount,
    };
  }

  /**
   * List directory recursively up to specified depth
   */
  private static async listRecursive(
    absolutePath: string,
    workspaceRoot: string,
    maxDepth: number,
    currentDepth: number,
    itemCounter: () => number
  ): Promise<DirectoryItem[]> {
    // Stop if max depth reached
    if (currentDepth >= maxDepth) {
      return [];
    }

    // Stop if max items reached
    if (itemCounter() >= this.MAX_ITEMS) {
      return [];
    }

    const items: DirectoryItem[] = [];

    try {
      const entries = await readdir(absolutePath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip ignored patterns
        if (this.IGNORE_PATTERNS.some(pattern => entry.name.includes(pattern))) {
          continue;
        }

        // Stop if max items reached
        if (itemCounter() >= this.MAX_ITEMS) {
          break;
        }

        const fullPath = path.join(absolutePath, entry.name);
        const relativePath = SecurityService.getRelativePath(workspaceRoot, fullPath);

        if (entry.isDirectory()) {
          const item: DirectoryItem = {
            name: entry.name,
            type: 'directory',
            path: relativePath,
          };

          // Recursively list subdirectory if depth allows
          if (currentDepth + 1 < maxDepth) {
            item.children = await this.listRecursive(
              fullPath,
              workspaceRoot,
              maxDepth,
              currentDepth + 1,
              itemCounter
            );
          }

          items.push(item);
        } else if (entry.isFile()) {
          try {
            const stats = await stat(fullPath);
            items.push({
              name: entry.name,
              type: 'file',
              path: relativePath,
              size: stats.size,
              mtime: stats.mtime.toISOString(),
            });
          } catch {
            // Skip files we can't stat
            continue;
          }
        }
      }
    } catch (error) {
      // Log error but don't throw (allows partial listings)
      console.warn(`[list_directory] Error reading ${absolutePath}:`, error);
    }

    return items;
  }

  /**
   * Validate list directory parameters
   */
  static validateParams(params: any): Required<ListDirectoryParams> {
    if (!params || typeof params !== 'object') {
      params = {};
    }

    let depth = params.depth ?? this.DEFAULT_DEPTH;
    if (typeof depth !== 'number' || depth < 1) {
      depth = this.DEFAULT_DEPTH;
    }
    if (depth > this.MAX_DEPTH) {
      depth = this.MAX_DEPTH;
    }

    return {
      path: params.path || undefined,
      depth,
    };
  }
}
