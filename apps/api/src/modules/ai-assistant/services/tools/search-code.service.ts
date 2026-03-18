/**
 * Search Code Tool Service
 * Allows AI to search codebase using ripgrep (native/direct execution)
 */

import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { SecurityService } from './security.service';

export interface SearchCodeParams {
  pattern: string;
  fileTypes?: string[];
  maxResults?: number;
}

export interface SearchMatch {
  file: string;
  line: number;
  content: string;
}

export interface SearchCodeResult {
  matches: SearchMatch[];
  totalMatches: number;
  truncated: boolean;
  pattern: string;
  durationMs: number;
}

export class SearchCodeError extends Error {
  constructor(message: string, public code: string = 'SEARCH_CODE_ERROR') {
    super(message);
    this.name = 'SearchCodeError';
  }
}

export class SearchCodeService {
  /**
   * Default maximum results
   */
  private static readonly DEFAULT_MAX_RESULTS = 50;

  /**
   * Absolute maximum results (to prevent performance issues)
   */
  private static readonly ABSOLUTE_MAX_RESULTS = 100;

  /**
   * Search timeout in milliseconds
   */
  private static readonly TIMEOUT_MS = 15000; // 15 seconds

  /**
   * Cached ripgrep path (resolved once)
   */
  private static ripgrepPath: string | null = null;

  /**
   * Find ripgrep executable in PATH
   * Tries common locations and falls back to 'rg' (will use PATH)
   */
  private static findRipgrep(): string {
    if (this.ripgrepPath) {
      return this.ripgrepPath;
    }

    // Try 'which rg' to find ripgrep in PATH
    try {
      const path = execSync('which rg', { encoding: 'utf-8' }).trim();
      if (path) {
        this.ripgrepPath = path;
        return path;
      }
    } catch {
      // which command failed, continue to fallback
    }

    // Fallback: just use 'rg' and let the system find it in PATH
    // This will work on Linux, macOS (with Homebrew), and Windows (with rg in PATH)
    this.ripgrepPath = 'rg';
    return 'rg';
  }

  /**
   * Search code using ripgrep (native execution with spawn)
   *
   * @param params - Search parameters
   * @param workspaceRoot - Absolute path to workspace root
   * @returns Search results with matches
   * @throws SecurityError if workspace is invalid
   * @throws SearchCodeError if search fails
   */
  static async searchCode(
    params: SearchCodeParams,
    workspaceRoot: string
  ): Promise<SearchCodeResult> {
    const startTime = Date.now();

    // Validate workspace root
    await SecurityService.validateWorkspaceRoot(workspaceRoot);

    // Validate and sanitize params
    const validatedParams = this.validateParams(params);

    // Build ripgrep arguments (safe - no shell injection)
    const rgArgs = this.buildRipgrepArgs(validatedParams);

    // Execute ripgrep using spawn (no shell)
    const matches = await this.executeRipgrep(rgArgs, workspaceRoot, validatedParams.maxResults!);

    const durationMs = Date.now() - startTime;
    console.log(
      `[search_code] Found ${matches.length} matches for "${validatedParams.pattern}" in ${durationMs}ms`
    );

    return {
      matches,
      totalMatches: matches.length,
      truncated: matches.length >= validatedParams.maxResults!,
      pattern: validatedParams.pattern,
      durationMs,
    };
  }

  /**
   * Execute ripgrep with spawn (no shell)
   */
  private static executeRipgrep(
    args: string[],
    workspaceRoot: string,
    maxResults: number
  ): Promise<SearchMatch[]> {
    return new Promise((resolve, reject) => {
      const matches: SearchMatch[] = [];
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let completed = false;

      const rgPath = this.findRipgrep();
      const rg = spawn(rgPath, args, {
        cwd: workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe'], // Explicitly set stdio for Bun compatibility
      });

      rg.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      rg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      rg.on('exit', (code) => {
        if (completed) return; // Already resolved/rejected
        completed = true;
        clearTimeout(timeoutHandle);

        // ripgrep exit codes:
        // 0 = matches found
        // 1 = no matches (not an error)
        // 2 = error
        if (code === 1) {
          // No matches found (not an error)
          resolve([]);
          return;
        }

        if (code === 2) {
          reject(new SearchCodeError(`Ripgrep failed: ${stderr}`, 'SEARCH_FAILED'));
          return;
        }

        // Parse JSON output
        try {
          const parsed = this.parseRipgrepJSON(stdout, workspaceRoot, maxResults);
          resolve(parsed);
        } catch (error) {
          reject(new SearchCodeError(`Failed to parse results: ${error}`, 'PARSE_ERROR'));
        }
      });

      rg.on('error', (error: any) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeoutHandle);

        if (error.code === 'ENOENT') {
          const installInstructions = process.platform === 'darwin'
            ? 'brew install ripgrep'
            : process.platform === 'win32'
            ? 'choco install ripgrep or download from https://github.com/BurntSushi/ripgrep/releases'
            : 'sudo apt-get install ripgrep or sudo yum install ripgrep';

          reject(
            new SearchCodeError(
              `ripgrep (rg) not found in PATH. Install with: ${installInstructions}`,
              'RG_NOT_FOUND'
            )
          );
        } else {
          reject(new SearchCodeError(`Ripgrep error: ${error.message}`, 'SEARCH_FAILED'));
        }
      });

      // Handle timeout
      const timeoutHandle = setTimeout(() => {
        if (completed) return;
        completed = true;
        timedOut = true;
        rg.kill('SIGTERM');
        reject(new SearchCodeError(`Search timed out after ${this.TIMEOUT_MS}ms`, 'TIMEOUT'));
      }, this.TIMEOUT_MS);
    });
  }

  /**
   * Build ripgrep arguments (safe - no shell injection)
   */
  private static buildRipgrepArgs(params: SearchCodeParams): string[] {
    const args: string[] = [];

    // JSON output for parsing
    args.push('--json');

    // Case insensitive by default
    args.push('--ignore-case');

    // Respect .gitignore
    args.push('--follow');

    // Max results per file
    args.push('--max-count', params.maxResults!.toString());

    // File type filters
    if (params.fileTypes && params.fileTypes.length > 0) {
      for (const type of params.fileTypes) {
        // Sanitize file extension (only alphanumeric)
        const safeType = type.replace(/[^a-zA-Z0-9]/g, '');
        if (safeType) {
          args.push('--glob', `*.${safeType}`);
        }
      }
    } else {
      // Default file types for code search
      const defaultTypes = ['ts', 'tsx', 'js', 'jsx', 'md', 'json', 'yaml', 'yml'];
      for (const type of defaultTypes) {
        args.push('--glob', `*.${type}`);
      }
    }

    // Pattern (passed directly - no shell escaping needed with spawn)
    args.push(params.pattern);

    return args;
  }

  /**
   * Parse ripgrep JSON output
   */
  private static parseRipgrepJSON(
    output: string,
    workspaceRoot: string,
    maxResults: number
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      if (!line) continue;

      try {
        const json = JSON.parse(line);

        // We only care about 'match' type entries
        if (json.type === 'match') {
          const data = json.data;
          const relativePath = SecurityService.getRelativePath(workspaceRoot, data.path.text);

          matches.push({
            file: relativePath,
            line: data.line_number,
            content: data.lines.text.trimEnd(),
          });

          if (matches.length >= maxResults) {
            break;
          }
        }
      } catch (error) {
        // Skip malformed JSON lines
        console.warn('[search_code] Failed to parse ripgrep JSON:', error);
      }
    }

    return matches;
  }

  /**
   * Validate search parameters
   */
  static validateParams(params: any): Required<SearchCodeParams> {
    if (!params || typeof params !== 'object') {
      throw new SearchCodeError('Parameters must be an object', 'INVALID_PARAMS');
    }

    if (!params.pattern || typeof params.pattern !== 'string') {
      throw new SearchCodeError('pattern parameter is required and must be a string', 'INVALID_PARAMS');
    }

    if (params.pattern.trim().length === 0) {
      throw new SearchCodeError('pattern cannot be empty', 'INVALID_PARAMS');
    }

    let fileTypes: string[] = [];
    if (params.fileTypes !== undefined) {
      if (!Array.isArray(params.fileTypes)) {
        throw new SearchCodeError('fileTypes must be an array', 'INVALID_PARAMS');
      }
      fileTypes = params.fileTypes.filter((t: any) => typeof t === 'string');
    }

    let maxResults = params.maxResults ?? this.DEFAULT_MAX_RESULTS;
    if (typeof maxResults !== 'number' || maxResults < 1) {
      maxResults = this.DEFAULT_MAX_RESULTS;
    }
    if (maxResults > this.ABSOLUTE_MAX_RESULTS) {
      maxResults = this.ABSOLUTE_MAX_RESULTS;
    }

    return {
      pattern: params.pattern,
      fileTypes,
      maxResults,
    };
  }
}
