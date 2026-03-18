/**
 * Hook Manager
 * Manages registration and execution of hook handlers
 */

import { createReadStream, existsSync, readFileSync } from 'fs';
import { createInterface } from 'readline';
import { readConfig, isAuthenticated, getAccessToken, getConfigPath, configExists } from './utils/config';
import { sendHookEvent, buildHookEventPayload } from './utils/api-client';
import {
  getQueuedEvents,
  enqueueEvent,
  dequeueEvent,
  updateQueuedEvent,
} from './utils/error-queue';
import { notifyApiError, logInfo } from './utils/notifications';
import { HookLogger } from './utils/logger';
import { getLastTranscriptLine, type ConversationLine } from '@agios/transcript-types';
import type {
  AnyHookInput,
  AnyHookOutput,
  HookContext,
  HookEventName,
  HookHandler,
  HookResult,
  NotificationInput,
  NotificationOutput,
  PostToolUseInput,
  PostToolUseOutput,
  PreCompactInput,
  PreCompactOutput,
  PreToolUseInput,
  PreToolUseOutput,
  SessionEndInput,
  SessionEndOutput,
  SessionStartInput,
  SessionStartOutput,
  StopInput,
  StopOutput,
  SubagentStopInput,
  SubagentStopOutput,
  TranscriptLine,
  UserPromptSubmitInput,
  UserPromptSubmitOutput,
} from './types';

export interface HookManagerOptions {
  /**
   * Project ID - defaults to reading from .agent/config.json
   */
  projectId?: string;

  /**
   * API URL - defaults to reading from .agent/config.json
   */
  apiUrl?: string;

  /**
   * Access token - defaults to reading from .agent/config.json
   */
  accessToken?: string;

  /**
   * API request timeout in milliseconds - defaults to reading from .agent/config.json or 2000ms
   */
  apiTimeout?: number;

  /**
   * Enable debug logging to .agent/hook-events.log - defaults to reading from .agent/config.json or true
   */
  debugHooks?: boolean;

  /**
   * Path to log file - defaults to .agent/hook-events.log
   */
  logPath?: string;

  /**
   * Enable API integration - defaults to true if authenticated
   */
  enableApi?: boolean;
}

/**
 * Hook Manager Class
 * Provides a fluent API for registering and executing hook handlers
 */
export class HookManager {
  private handlers: Map<HookEventName, HookHandler<any, any>[]> = new Map();
  private options: HookManagerOptions;
  private logger: HookLogger;
  private currentInput?: AnyHookInput; // Track current input for cwd access

  constructor(options: HookManagerOptions = {}) {
    this.options = options;
    this.logger = new HookLogger(options.logPath);
  }

  /**
   * Register a handler for PreToolUse events
   */
  onPreToolUse(handler: HookHandler<PreToolUseInput, PreToolUseOutput>): this {
    return this.on('PreToolUse', handler);
  }

  /**
   * Register a handler for PostToolUse events
   */
  onPostToolUse(handler: HookHandler<PostToolUseInput, PostToolUseOutput>): this {
    return this.on('PostToolUse', handler);
  }

  /**
   * Register a handler for Notification events
   */
  onNotification(handler: HookHandler<NotificationInput, NotificationOutput>): this {
    return this.on('Notification', handler);
  }

  /**
   * Register a handler for UserPromptSubmit events
   */
  onUserPromptSubmit(
    handler: HookHandler<UserPromptSubmitInput, UserPromptSubmitOutput>
  ): this {
    return this.on('UserPromptSubmit', handler);
  }

  /**
   * Register a handler for Stop events
   */
  onStop(handler: HookHandler<StopInput, StopOutput>): this {
    return this.on('Stop', handler);
  }

  /**
   * Register a handler for SubagentStop events
   */
  onSubagentStop(handler: HookHandler<SubagentStopInput, SubagentStopOutput>): this {
    return this.on('SubagentStop', handler);
  }

  /**
   * Register a handler for PreCompact events
   */
  onPreCompact(handler: HookHandler<PreCompactInput, PreCompactOutput>): this {
    return this.on('PreCompact', handler);
  }

  /**
   * Register a handler for SessionStart events
   */
  onSessionStart(handler: HookHandler<SessionStartInput, SessionStartOutput>): this {
    return this.on('SessionStart', handler);
  }

  /**
   * Register a handler for SessionEnd events
   */
  onSessionEnd(handler: HookHandler<SessionEndInput, SessionEndOutput>): this {
    return this.on('SessionEnd', handler);
  }

  /**
   * Register a generic hook handler
   */
  private on<TInput extends AnyHookInput, TOutput extends AnyHookOutput>(
    eventName: HookEventName,
    handler: HookHandler<TInput, TOutput>
  ): this {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
    return this;
  }

  /**
   * Execute all handlers for the given input
   * Returns the result from the last handler that produces output
   */
  async execute(input: AnyHookInput): Promise<HookResult<AnyHookOutput>> {
    const handlers = this.handlers.get(input.hook_event_name) || [];

    if (handlers.length === 0) {
      return { exitCode: 0 };
    }

    const context = createHookContext(input.transcript_path);
    let finalResult: HookResult<AnyHookOutput> = { exitCode: 0 };

    // Execute handlers in sequence (function chain)
    for (const handler of handlers) {
      const result = await handler(input, context);

      // Merge results, with later handlers taking precedence
      finalResult = {
        exitCode: result.exitCode !== 0 ? result.exitCode : finalResult.exitCode,
        stdout: result.stdout || finalResult.stdout,
        stderr: result.stderr || finalResult.stderr,
        output: result.output || finalResult.output,
      };

      // If a handler returns exit code 2 or sets continue: false, stop the chain
      if (result.exitCode === 2 || result.output?.continue === false) {
        break;
      }
    }

    return finalResult;
  }

  /**
   * Execute handlers and output results in Claude Code format
   * Includes smart queue processing:
   * 1. Try to drain queue first (opportunistic, non-blocking)
   * 2. Log event to file (if debugHooks enabled)
   * 3. Execute user handlers
   * 4. Send current event to API (or queue on failure)
   */
  async run(): Promise<void> {
    const input = await this.readStdin();

    // Store current input for access to cwd
    this.currentInput = input;

    // Step 1: Try to drain the queue first (opportunistic)
    await this.drainQueue().catch(() => {
      // Silently fail - queue draining is best effort
    });

    // Step 2: Execute user handlers
    const result = await this.execute(input);

    // Step 3: Get conversation context
    const conversation = this.getConversationContext(input.transcript_path);

    // Step 4: Log event with enriched format (if debugHooks enabled)
    const debugHooks = this.options.debugHooks ?? readConfig()?.debugHooks ?? true;
    if (debugHooks) {
      // Use enriched logging format matching claude-hooks-sdk
      const context = (input as any).context || null;
      this.logger.logEnriched(input, result, conversation, context);
    }

    // Step 5: Send current event to API (or queue on failure)
    await this.sendOrQueueEvent(input, conversation).catch(() => {
      // Silently fail - already logged and queued
    });

    // Output results
    if (result.output) {
      console.log(JSON.stringify(result.output));
    } else if (result.stdout) {
      console.log(result.stdout);
    }

    if (result.stderr) {
      console.error(result.stderr);
    }

    process.exit(result.exitCode);
  }

  /**
   * Read and parse JSON input from stdin
   */
  private async readStdin(): Promise<AnyHookInput> {
    return new Promise((resolve, reject) => {
      let data = '';

      process.stdin.on('data', (chunk) => {
        data += chunk;
      });

      process.stdin.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Invalid JSON input: ${error}`));
        }
      });

      process.stdin.on('error', reject);
    });
  }

  /**
   * Try to drain the error queue by sending queued events to the API
   * Non-blocking and opportunistic - continues immediately on failure
   */
  private async drainQueue(): Promise<void> {
    const MAX_ATTEMPTS = 10;
    const queuedEvents = getQueuedEvents();

    if (queuedEvents.length === 0) {
      return;
    }

    const apiOptions = this.getApiOptions();
    if (!apiOptions) {
      return; // API not configured, skip
    }

    // Try to send each queued event (non-blocking)
    for (const queuedEvent of queuedEvents) {
      // Check if max attempts reached
      if (queuedEvent.attempts >= MAX_ATTEMPTS) {
        // Max attempts reached - remove from queue (dead-letter)
        dequeueEvent(queuedEvent.id);
        logInfo(`Queue item ${queuedEvent.id} exceeded max attempts (${MAX_ATTEMPTS}), removed`);
        continue;
      }

      const response = await sendHookEvent(queuedEvent.payload, apiOptions);

      if (response.success) {
        // Success - remove from queue
        dequeueEvent(queuedEvent.id);
        logInfo(`Queue drained: sent event ${queuedEvent.id}`);
      } else {
        // Failed - update attempts and move on
        queuedEvent.attempts++;
        queuedEvent.lastError = response.error;
        updateQueuedEvent(queuedEvent);
        // Don't notify user - already notified when originally queued
      }
    }
  }

  /**
   * Send current event to API, or queue if it fails
   */
  private async sendOrQueueEvent(
    input: AnyHookInput,
    conversation: ConversationLine | null
  ): Promise<void> {
    const apiOptions = this.getApiOptions();
    if (!apiOptions) {
      return; // API not configured, skip silently
    }

    const payload = buildHookEventPayload(apiOptions.projectId!, input, conversation);

    const response = await sendHookEvent(payload, apiOptions);

    if (!response.success) {
      // Failed - enqueue and notify user
      enqueueEvent(payload, response.error);
      notifyApiError(`Failed to send hook event: ${input.hook_event_name}`, response.error);
    }
  }

  /**
   * Get API options from constructor or config file
   * Uses input.cwd to find config file (not process.cwd())
   */
  private getApiOptions() {
    // Check if API integration is explicitly disabled
    if (this.options.enableApi === false) {
      return null;
    }

    // Use cwd from hook input (project root), not process.cwd() (may be subdirectory)
    const basePath = this.currentInput?.cwd;

    // Get projectId
    const projectId = this.options.projectId || readConfig(basePath)?.projectId;
    if (!projectId) {
      this.logConfigWarning('No projectId available', basePath);
      return null;
    }

    // Get apiUrl
    const apiUrl = this.options.apiUrl || readConfig(basePath)?.apiUrl;
    if (!apiUrl) {
      this.logConfigWarning('No apiUrl configured', basePath);
      return null;
    }

    // Get accessToken
    const accessToken = this.options.accessToken || getAccessToken(basePath);
    if (!accessToken) {
      this.logConfigWarning('No access token available', basePath);
      return null;
    }

    // Get timeout (default: 2000ms)
    const timeout = this.options.apiTimeout || readConfig(basePath)?.apiTimeout || 2000;

    return { projectId, apiUrl, accessToken, timeout };
  }

  /**
   * Log configuration warning with diagnostic details
   */
  private logConfigWarning(message: string, basePath?: string): void {
    const debugHooks = this.options.debugHooks ?? readConfig()?.debugHooks ?? true;
    if (!debugHooks) {
      return; // Silent if debugging disabled
    }

    const warning = {
      level: 'WARN',
      message: `${message} - check .agent/config.json`,
      details: {
        processCwd: process.cwd(),
        inputCwd: this.currentInput?.cwd,
        basePath,
        configPath: getConfigPath(basePath),
        configExists: configExists(basePath),
      },
    };

    // Log to stderr for visibility
    console.error(`[hooks-sdk] ${warning.message}`);
    console.error('[hooks-sdk] Details:', JSON.stringify(warning.details, null, 2));
  }

  /**
   * Get conversation context (last transcript line)
   */
  private getConversationContext(transcriptPath: string): ConversationLine | null {
    try {
      if (!existsSync(transcriptPath)) {
        return null;
      }

      const content = readFileSync(transcriptPath, 'utf-8');
      return getLastTranscriptLine(content);
    } catch (error) {
      return null;
    }
  }
}

// ============================================================================
// Transcript Utilities
// ============================================================================

/**
 * Create a hook context with transcript access utilities
 */
export function createHookContext(transcriptPath: string): HookContext {
  return {
    transcriptPath,
    getTranscriptLine: (lineNumber: number) => getTranscriptLine(transcriptPath, lineNumber),
    getFullTranscript: () => getFullTranscript(transcriptPath),
    searchTranscript: (predicate) => searchTranscript(transcriptPath, predicate),
  };
}

/**
 * Read a specific line from the transcript file
 */
export async function getTranscriptLine(
  transcriptPath: string,
  lineNumber: number
): Promise<TranscriptLine | null> {
  return new Promise((resolve, reject) => {
    const fileStream = createReadStream(transcriptPath);
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    let currentLine = 0;

    rl.on('line', (line) => {
      currentLine++;
      if (currentLine === lineNumber) {
        try {
          resolve({
            lineNumber,
            content: JSON.parse(line),
            raw: line,
          });
        } catch (error) {
          resolve({
            lineNumber,
            content: null,
            raw: line,
          });
        }
        rl.close();
      }
    });

    rl.on('close', () => {
      resolve(null);
    });

    rl.on('error', reject);
  });
}

/**
 * Read the entire transcript file
 */
export async function getFullTranscript(transcriptPath: string): Promise<TranscriptLine[]> {
  return new Promise((resolve, reject) => {
    const fileStream = createReadStream(transcriptPath);
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    const lines: TranscriptLine[] = [];
    let lineNumber = 0;

    rl.on('line', (line) => {
      lineNumber++;
      try {
        lines.push({
          lineNumber,
          content: JSON.parse(line),
          raw: line,
        });
      } catch (error) {
        lines.push({
          lineNumber,
          content: null,
          raw: line,
        });
      }
    });

    rl.on('close', () => {
      resolve(lines);
    });

    rl.on('error', reject);
  });
}

/**
 * Search transcript lines matching a predicate
 */
export async function searchTranscript(
  transcriptPath: string,
  predicate: (line: TranscriptLine) => boolean
): Promise<TranscriptLine[]> {
  const allLines = await getFullTranscript(transcriptPath);
  return allLines.filter(predicate);
}
