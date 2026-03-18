/**
 * Claude Code Service
 * Executes Claude Code commands in headless mode
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface AskClaudeToParams {
  prompt: string;
  sessionId?: string;
  maxTokens?: number;
}

export interface AskClaudeToResult {
  success: boolean;
  sessionId: string;
  filesModified: string[];
  summary: string;
  output: string;
  errors: string[];
  suggestions: string[];
  executionTime: number;
}

export class ClaudeCodeError extends Error {
  constructor(
    message: string,
    public code: string = 'CLAUDE_CODE_ERROR',
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'ClaudeCodeError';
  }
}

export class ClaudeCodeService {
  /**
   * Dangerous operation patterns
   */
  private static readonly DANGEROUS_PATTERNS = [
    'rm -rf',
    'sudo',
    'chmod 777',
    'format',
    '> /dev/',
    'dd if=',
    'mkfs',
    ':(){:|:&};:', // Fork bomb
  ];

  /**
   * Check if Claude Code is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      await execAsync('which claude');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate Claude Code is installed
   */
  static async validateAvailable(): Promise<void> {
    const available = await this.isAvailable();
    if (!available) {
      throw new ClaudeCodeError(
        'Claude Code is not installed. Install with: npm install -g @anthropic-ai/claude-code',
        'CLAUDE_CODE_NOT_AVAILABLE',
        false
      );
    }
  }

  /**
   * Validate prompt for dangerous operations
   */
  static validatePrompt(prompt: string): void {
    const lowerPrompt = prompt.toLowerCase();

    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (lowerPrompt.includes(pattern.toLowerCase())) {
        throw new ClaudeCodeError(
          `Dangerous operation detected: "${pattern}". This operation requires manual approval.`,
          'DANGEROUS_OPERATION',
          false
        );
      }
    }
  }

  /**
   * Execute Claude Code command with security validation
   */
  static async executeSecure(
    params: AskClaudeToParams,
    workspaceRoot: string
  ): Promise<AskClaudeToResult> {
    // Validate prompt
    this.validatePrompt(params.prompt);

    // Execute
    return this.execute(params, workspaceRoot);
  }

  /**
   * Execute Claude Code command
   */
  static async execute(
    params: AskClaudeToParams,
    workspaceRoot: string
  ): Promise<AskClaudeToResult> {
    const startTime = Date.now();

    // Validate Claude Code is available
    await this.validateAvailable();

    // Build command
    const command = this.buildCommand(params);

    // Execute
    let stdout: string;
    let stderr: string;
    try {
      const result = await execAsync(command, {
        cwd: workspaceRoot,
        timeout: 5 * 60 * 1000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: any) {
      throw new ClaudeCodeError(
        `Claude Code execution failed: ${error.message}`,
        'EXECUTION_FAILED',
        true
      );
    }

    // Parse output
    const parsed = this.parseOutput(stdout);

    return {
      success: true,
      sessionId: parsed.session_id || params.sessionId || 'no-session',
      filesModified: parsed.files_modified || [],
      summary: parsed.summary || 'Executed successfully',
      output: stdout,
      errors: parsed.errors || [],
      suggestions: parsed.suggestions || [],
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Build Claude Code command
   */
  private static buildCommand(params: AskClaudeToParams): string {
    const parts = ['claude'];

    // Prompt
    const escapedPrompt = params.prompt.replace(/'/g, "'\\''");
    parts.push(`-p '${escapedPrompt}'`);

    // JSON output
    parts.push('--output-format json');

    // Resume session
    if (params.sessionId) {
      parts.push(`--resume ${params.sessionId}`);
    }

    // Note: Claude CLI doesn't support --max-tokens flag
    // Token usage is controlled by the Claude API internally

    return parts.join(' ');
  }

  /**
   * Parse Claude Code JSON output
   */
  private static parseOutput(output: string): any {
    try {
      return JSON.parse(output);
    } catch {
      // If not JSON, return basic structure
      return {
        summary: 'Command executed',
        output,
      };
    }
  }
}
