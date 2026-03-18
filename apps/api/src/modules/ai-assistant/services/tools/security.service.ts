/**
 * Security Service for AI Tools
 * Validates and sanitizes file paths for workspace-scoped access
 */

import path from 'node:path';
import { access } from 'node:fs/promises';

export class SecurityError extends Error {
  constructor(message: string, public code: string = 'SECURITY_ERROR') {
    super(message);
    this.name = 'SecurityError';
  }
}

export class SecurityService {
  /**
   * Sensitive file patterns that should never be accessed
   */
  private static readonly SENSITIVE_PATTERNS = [
    '.env',
    'credentials',
    'secrets',
    'private',
    'password',
    'api_key',
    'apikey',
    'token',
    '.pem',
    '.key',
    'id_rsa',
    'id_dsa',
  ];

  /**
   * Validate and resolve a path within workspace boundaries
   *
   * @param workspaceRoot - Absolute path to workspace root
   * @param requestedPath - Path requested by AI (relative or absolute)
   * @returns Absolute validated path
   * @throws SecurityError if path is invalid or outside workspace
   */
  static validatePath(workspaceRoot: string, requestedPath: string): string {
    // Ensure workspace root is absolute
    const absoluteWorkspaceRoot = path.resolve(workspaceRoot);

    // Resolve requested path to absolute (handles ../, ./, etc.)
    const absoluteRequested = path.resolve(absoluteWorkspaceRoot, requestedPath);

    // Check if path is within workspace
    if (!absoluteRequested.startsWith(absoluteWorkspaceRoot)) {
      throw new SecurityError(
        'Access denied: Path is outside workspace boundary',
        'PATH_OUTSIDE_WORKSPACE'
      );
    }

    // Check for sensitive files
    const pathLower = absoluteRequested.toLowerCase();
    for (const pattern of this.SENSITIVE_PATTERNS) {
      if (pathLower.includes(pattern)) {
        throw new SecurityError(
          `Access denied: Cannot access sensitive file containing '${pattern}'`,
          'SENSITIVE_FILE_BLOCKED'
        );
      }
    }

    return absoluteRequested;
  }

  /**
   * Check if a path exists and is accessible
   *
   * @param absolutePath - Absolute validated path
   * @returns true if accessible, false otherwise
   */
  static async isAccessible(absolutePath: string): Promise<boolean> {
    try {
      await access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate workspace root exists and is accessible
   *
   * @param workspaceRoot - Path to workspace root
   * @throws SecurityError if workspace root is invalid
   */
  static async validateWorkspaceRoot(workspaceRoot: string): Promise<void> {
    if (!workspaceRoot || workspaceRoot.trim() === '') {
      throw new SecurityError(
        'Workspace root path is required',
        'WORKSPACE_ROOT_MISSING'
      );
    }

    const absoluteRoot = path.resolve(workspaceRoot);

    const accessible = await this.isAccessible(absoluteRoot);
    if (!accessible) {
      throw new SecurityError(
        'Workspace root does not exist or is not accessible',
        'WORKSPACE_ROOT_INVALID'
      );
    }
  }

  /**
   * Get relative path from workspace root for logging/display
   *
   * @param workspaceRoot - Absolute workspace root
   * @param absolutePath - Absolute file path
   * @returns Relative path from workspace root
   */
  static getRelativePath(workspaceRoot: string, absolutePath: string): string {
    return path.relative(workspaceRoot, absolutePath);
  }
}
