/**
 * File Logger Utility
 * Logs hook events to a JSON Lines file with enriched format
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { AnyHookInput } from '../types';

/**
 * Enriched log entry format matching claude-hooks-sdk
 */
export interface EnrichedLogEntry {
  input: {
    hook: AnyHookInput;
    conversation: any | null;
    context: any | null;
    timestamp: string;
  };
  output: {
    exitCode: number;
    success: boolean;
    hasOutput: boolean;
    hasStdout: boolean;
    hasStderr: boolean;
  };
}

/**
 * Legacy simple log entry format (deprecated)
 */
export interface LogEntry {
  timestamp: string;
  event: string;
  session_id: string;
  tool_name?: string;
  payload: AnyHookInput;
}

export class HookLogger {
  private logPath: string;

  constructor(logPath?: string) {
    // Use CLAUDE_PROJECT_DIR if available, otherwise fall back to cwd
    const projectRoot = process.env['CLAUDE_PROJECT_DIR'] || process.cwd();
    this.logPath = logPath || join(projectRoot, '.agent', 'hook-events.log');
    this.ensureLogDirectory();
  }

  /**
   * Ensure the log directory exists
   */
  private ensureLogDirectory(): void {
    const dir = dirname(this.logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Log a hook event with enriched format
   */
  logEnriched(
    input: AnyHookInput,
    result: { exitCode: number; output?: any; stdout?: any; stderr?: any },
    conversation: any | null = null,
    context: any | null = null
  ): void {
    // Extract context from enriched event if available
    const { context: inputContext, ...hookWithoutContext } = input as any;
    const finalContext = inputContext || context;

    const entry: EnrichedLogEntry = {
      input: {
        hook: hookWithoutContext,
        conversation,
        context: finalContext,
        timestamp: new Date().toISOString(),
      },
      output: {
        exitCode: result.exitCode,
        success: result.exitCode === 0,
        hasOutput: result.output !== undefined,
        hasStdout: result.stdout !== undefined,
        hasStderr: result.stderr !== undefined,
      },
    };

    const line = JSON.stringify(entry) + '\n';

    try {
      appendFileSync(this.logPath, line, 'utf-8');
    } catch (error) {
      // If logging fails, write to stderr but don't crash
      console.error(`Failed to log hook event: ${error}`);
    }
  }

  /**
   * Log a hook event (legacy simple format)
   * @deprecated Use logEnriched for enriched format
   */
  log(input: AnyHookInput): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      event: input.hook_event_name,
      session_id: input.session_id,
      tool_name: 'tool_name' in input ? input.tool_name : undefined,
      payload: input,
    };

    // Append as JSON Lines format (one JSON object per line)
    const line = JSON.stringify(entry) + '\n';

    try {
      appendFileSync(this.logPath, line, 'utf-8');
    } catch (error) {
      // If logging fails, write to stderr but don't crash
      console.error(`Failed to log hook event: ${error}`);
    }
  }

  /**
   * Get the current log file path
   */
  getLogPath(): string {
    return this.logPath;
  }
}

/**
 * Default logger instance
 */
export const defaultLogger = new HookLogger();

/**
 * Log a hook event using the default logger (legacy)
 * @deprecated Use logEnriched
 */
export function logHookEvent(input: AnyHookInput): void {
  defaultLogger.log(input);
}
