/**
 * Tool Executor Service
 * Executes AI tool calls and logs to database
 */

import { db } from '@agios/db/client';
import { aiToolInvocations, workspaces } from '@agios/db';
import { eq } from 'drizzle-orm';
import { SecurityError } from './security.service';
import { RateLimitService, RateLimitError } from './rate-limit.service';
import { ReadFileService, ReadFileError } from './read-file.service';
import { SearchCodeError } from './search-code.service';
import { ListDirectoryService, ListDirectoryError } from './list-directory.service';
import { ClaudeCodeService, ClaudeCodeError } from './claude-code.service';
import { ClaudeSessionService } from './claude-session.service';
import { QueryMemoryService, QueryMemoryError } from './query-memory.service';
import { AddMemoryService, AddMemoryError } from './add-memory.service';
import { QueryCrmService, QueryCrmError } from './query-crm.service';
import { SearchCrmService, SearchCrmError } from './search-crm.service';
import { CreateTicketService, CreateTicketError } from './create-ticket.service';
import { QueryTicketsService, QueryTicketsError } from './query-tickets.service';

export interface ToolCall {
  id: string;
  name: string;
  parameters: any;
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

export interface ToolExecutionContext {
  workspaceId: string;
  conversationId: string;
  messageId?: string;
  userId?: string;
}

export interface DriverAction {
  type: 'highlight' | 'tour';
  selector?: string;
  title?: string;
  body?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  steps?: Array<{ selector: string; title: string; body: string; position?: string }>;
}

export interface ToolExecutionResult {
  results: ToolResult[];
  driverActions: DriverAction[];
}

export class ToolExecutor {
  /**
   * Execute multiple tool calls
   *
   * @param toolCalls - Array of tool calls from OpenRouter
   * @param context - Execution context (workspace, conversation, message)
   * @returns Array of tool results
   */
  /** Tools that query CRM data and don't need workspaceRoot */
  private static readonly CRM_TOOLS = new Set(['query_crm', 'search_crm', 'create_ticket', 'query_tickets']);

  /** Tools that are client-side UI actions (passed through to frontend) */
  private static readonly CLIENT_TOOLS = new Set(['highlight_element', 'run_tour']);

  static async executeTools(
    toolCalls: ToolCall[],
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const results: ToolResult[] = [];
    const driverActions: DriverAction[] = [];

    // Get workspace root path (may be undefined for workspaces without code)
    const workspace = await this.getWorkspace(context.workspaceId);
    const workspaceRoot = workspace.settings?.workspaceRoot as string | undefined;

    // Execute each tool call sequentially
    for (const toolCall of toolCalls) {
      // Client-side UI tools — just collect the action and acknowledge
      if (this.CLIENT_TOOLS.has(toolCall.name)) {
        const params = toolCall.parameters;
        if (toolCall.name === 'highlight_element') {
          driverActions.push({ type: 'highlight', selector: params.selector, title: params.title, body: params.body, position: params.position });
          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify({ success: true, message: `Highlighting "${params.title}" for the user` }),
          });
        } else if (toolCall.name === 'run_tour') {
          driverActions.push({ type: 'tour', steps: params.steps });
          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify({ success: true, message: `Starting ${params.steps?.length ?? 0}-step tour for the user` }),
          });
        }
        continue;
      }

      // CRM tools don't require workspaceRoot
      if (this.CRM_TOOLS.has(toolCall.name)) {
        const result = await this.executeTool(toolCall, context, workspaceRoot || '');
        results.push(result);
        continue;
      }

      // Code tools require workspaceRoot
      if (!workspaceRoot) {
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify({
            error: true,
            code: 'WORKSPACE_ROOT_NOT_CONFIGURED',
            message: 'Workspace root path is not configured. Please configure it in workspace settings.',
          }),
        });
        continue;
      }

      const result = await this.executeTool(toolCall, context, workspaceRoot);
      results.push(result);
    }

    return { results, driverActions };
  }

  /**
   * Execute a single tool call
   */
  private static async executeTool(
    toolCall: ToolCall,
    context: ToolExecutionContext,
    workspaceRoot: string
  ): Promise<ToolResult> {
    const startTime = Date.now();
    let status: 'success' | 'error' | 'rate_limited' = 'success';
    let result: any = null;
    let errorMessage: string | undefined;

    try {
      // Check rate limit
      await RateLimitService.checkRateLimit(context.workspaceId);

      // Execute tool based on name
      switch (toolCall.name) {
        case 'read_file':
          result = await this.executeReadFile(toolCall.parameters, workspaceRoot);
          break;

        case 'search_code':
          result = await this.executeSearchCode(toolCall.parameters, context);
          break;

        case 'list_directory':
          result = await this.executeListDirectory(toolCall.parameters, workspaceRoot);
          break;

        case 'askClaudeTo':
          result = await this.executeAskClaudeTo(toolCall.parameters, workspaceRoot, context);
          break;

        case 'query_memory':
          result = await this.executeQueryMemory(toolCall.parameters, context.workspaceId);
          break;

        case 'add_memory':
          result = await this.executeAddMemory(toolCall.parameters, context.workspaceId, context.conversationId);
          break;

        case 'query_crm':
          result = await this.executeQueryCrm(toolCall.parameters, context.workspaceId);
          break;

        case 'search_crm':
          result = await this.executeSearchCrm(toolCall.parameters, context.workspaceId);
          break;

        case 'create_ticket':
          result = await this.executeCreateTicket(toolCall.parameters, context);
          break;

        case 'query_tickets':
          result = await this.executeQueryTickets(toolCall.parameters, context.workspaceId);
          break;

        default:
          throw new Error(`Unknown tool: ${toolCall.name}`);
      }

      // Increment rate limit counter on success
      await RateLimitService.incrementToolCalls(context.workspaceId);
    } catch (error) {
      status = error instanceof RateLimitError ? 'rate_limited' : 'error';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      result = {
        error: true,
        code: this.getErrorCode(error),
        message: errorMessage,
        suggestion: this.getErrorSuggestion(error),
      };
    }

    const durationMs = Date.now() - startTime;

    // Log tool invocation to database
    await this.logToolInvocation({
      workspaceId: context.workspaceId,
      conversationId: context.conversationId,
      messageId: context.messageId,
      toolName: toolCall.name,
      parameters: toolCall.parameters,
      result,
      status,
      errorMessage,
      durationMs,
    });

    // Return tool result for OpenRouter
    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      content: JSON.stringify(result),
    };
  }

  /**
   * Execute read_file tool
   */
  private static async executeReadFile(params: any, workspaceRoot: string): Promise<any> {
    const validatedParams = ReadFileService.validateParams(params);
    const result = await ReadFileService.readFile(validatedParams, workspaceRoot);

    return {
      success: true,
      file: result.relativePath,
      content: result.content,
      size: result.size,
      lines: result.lines,
      modified: result.mtime,
    };
  }

  /**
   * Execute search_code tool
   * Uses native ripgrep directly (simple and fast)
   */
  private static async executeSearchCode(
    params: any,
    context: ToolExecutionContext
  ): Promise<any> {
    const { SearchCodeService } = await import('./search-code.service');

    // Get workspace to find workspace root
    const workspace = await this.getWorkspace(context.workspaceId);
    const workspaceRoot = workspace.settings?.workspaceRoot as string | undefined;

    if (!workspaceRoot) {
      throw new SearchCodeError(
        'Workspace root path is not configured. Please configure it in workspace settings.',
        'WORKSPACE_ROOT_NOT_CONFIGURED'
      );
    }

    // Execute search directly with ripgrep
    const result = await SearchCodeService.searchCode(params, workspaceRoot);

    // Format for AI consumption
    return this.formatSearchResultsForAI(result, params.pattern);
  }

  /**
   * Format search results for AI consumption
   * Limits results to prevent context overflow
   */
  private static formatSearchResultsForAI(
    result: {
      matches: Array<{ file: string; line: number; content: string }>;
      totalMatches: number;
      truncated: boolean;
      pattern: string;
      durationMs: number;
    },
    pattern: string
  ): any {
    // Limit results sent to AI to prevent context overflow
    const MAX_RESULTS_FOR_AI = 50;
    const limitedMatches = result.matches.slice(0, MAX_RESULTS_FOR_AI);

    // Group by file for better AI comprehension
    const fileGroups = new Map<string, number>();
    for (const match of limitedMatches) {
      fileGroups.set(match.file, (fileGroups.get(match.file) || 0) + 1);
    }

    // Build summary
    const filesWithMatches = fileGroups.size;
    let summary = `Found ${result.totalMatches} matches in ${filesWithMatches} files (${result.durationMs}ms)`;

    if (result.matches.length > MAX_RESULTS_FOR_AI) {
      summary += `\n\nShowing first ${MAX_RESULTS_FOR_AI} matches. Use more specific search terms to narrow results.`;
    }

    // Build detailed file list for remaining matches
    const remainingFiles: string[] = [];
    if (result.matches.length > MAX_RESULTS_FOR_AI) {
      const remainingMatches = result.matches.slice(MAX_RESULTS_FOR_AI);
      const remainingFileGroups = new Map<string, number>();

      for (const match of remainingMatches) {
        remainingFileGroups.set(match.file, (remainingFileGroups.get(match.file) || 0) + 1);
      }

      for (const [file, count] of remainingFileGroups) {
        remainingFiles.push(`${file} (${count} matches)`);
      }
    }

    return {
      success: true,
      pattern,
      matches: limitedMatches,
      totalMatches: result.totalMatches,
      truncated: result.truncated || result.matches.length > MAX_RESULTS_FOR_AI,
      durationMs: result.durationMs,
      summary,
      remainingFiles: remainingFiles.length > 0 ? remainingFiles : undefined,
    };
  }

  /**
   * Execute list_directory tool
   */
  private static async executeListDirectory(params: any, workspaceRoot: string): Promise<any> {
    const validatedParams = ListDirectoryService.validateParams(params);
    const result = await ListDirectoryService.listDirectory(validatedParams, workspaceRoot);

    return {
      success: true,
      directory: result.relativePath,
      items: result.items,
      totalItems: result.totalItems,
    };
  }

  /**
   * Execute askClaudeTo tool
   */
  private static async executeAskClaudeTo(
    params: any,
    workspaceRoot: string,
    context: ToolExecutionContext
  ): Promise<any> {
    // Validate params
    if (!params.prompt || typeof params.prompt !== 'string') {
      throw new Error('prompt parameter is required and must be a string');
    }

    // Execute Claude Code
    const result = await ClaudeCodeService.executeSecure(
      {
        prompt: params.prompt,
        sessionId: params.sessionId,
        maxTokens: params.maxTokens || 4000,
      },
      workspaceRoot
    );

    // Save session
    await ClaudeSessionService.createSession({
      workspaceId: context.workspaceId,
      sessionId: result.sessionId,
      conversationId: context.conversationId,
      prompt: params.prompt,
      result,
      filesModified: result.filesModified,
    });

    return {
      success: true,
      session_id: result.sessionId,
      files_modified: result.filesModified,
      summary: result.summary,
      errors: result.errors,
      suggestions: result.suggestions,
      execution_time_ms: result.executionTime,
    };
  }

  /**
   * Execute query_memory tool
   */
  private static async executeQueryMemory(params: any, workspaceId: string): Promise<any> {
    const validatedParams = QueryMemoryService.validateParams(params);
    const result = await QueryMemoryService.queryMemory(validatedParams, workspaceId);

    return {
      success: true,
      found: result.found,
      memories: result.memories,
    };
  }

  /**
   * Execute add_memory tool
   */
  private static async executeAddMemory(
    params: any,
    workspaceId: string,
    conversationId: string
  ): Promise<any> {
    const validatedParams = AddMemoryService.validateParams(params);
    const result = await AddMemoryService.addMemory(validatedParams, workspaceId, conversationId);

    return {
      success: true,
      stored: result.stored,
      memory_id: result.memoryId,
      message: result.message,
    };
  }

  /**
   * Execute query_crm tool
   */
  private static async executeQueryCrm(params: any, workspaceId: string): Promise<any> {
    const validatedParams = QueryCrmService.validateParams(params);
    const result = await QueryCrmService.execute(validatedParams, workspaceId);

    return {
      success: true,
      entity: validatedParams.entity,
      action: validatedParams.action,
      ...result,
    };
  }

  /**
   * Execute search_crm tool
   */
  private static async executeSearchCrm(params: any, workspaceId: string): Promise<any> {
    const validatedParams = SearchCrmService.validateParams(params);
    const result = await SearchCrmService.execute(validatedParams, workspaceId);

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Execute create_ticket tool
   */
  private static async executeCreateTicket(
    params: any,
    context: ToolExecutionContext
  ): Promise<any> {
    const validatedParams = CreateTicketService.validateParams(params);
    const result = await CreateTicketService.execute(validatedParams, context.workspaceId, {
      conversationId: context.conversationId,
      userId: context.userId,
    });

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Execute query_tickets tool
   */
  private static async executeQueryTickets(params: any, workspaceId: string): Promise<any> {
    const validatedParams = QueryTicketsService.validateParams(params);
    const result = await QueryTicketsService.execute(validatedParams, workspaceId);

    return {
      success: true,
      action: validatedParams.action,
      ...result,
    };
  }

  /**
   * Get workspace from database
   */
  private static async getWorkspace(workspaceId: string): Promise<any> {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    return workspace;
  }

  /**
   * Log tool invocation to database
   */
  private static async logToolInvocation(data: {
    workspaceId: string;
    conversationId: string;
    messageId?: string;
    toolName: string;
    parameters: any;
    result: any;
    status: 'success' | 'error' | 'rate_limited';
    errorMessage?: string;
    durationMs: number;
  }): Promise<void> {
    try {
      await db.insert(aiToolInvocations).values({
        workspaceId: data.workspaceId,
        conversationId: data.conversationId,
        messageId: data.messageId,
        toolName: data.toolName,
        parameters: data.parameters,
        result: data.result,
        status: data.status,
        errorMessage: data.errorMessage,
        durationMs: data.durationMs,
      });
    } catch (error) {
      // Log error but don't throw (logging failure shouldn't break tool execution)
      console.error('[tool-executor] Failed to log tool invocation:', error);
    }
  }

  /**
   * Get error code from error object
   */
  private static getErrorCode(error: unknown): string {
    if (error instanceof SecurityError) return error.code;
    if (error instanceof RateLimitError) return 'RATE_LIMIT_EXCEEDED';
    if (error instanceof ReadFileError) return error.code;
    if (error instanceof SearchCodeError) return error.code;
    if (error instanceof ListDirectoryError) return error.code;
    if (error instanceof ClaudeCodeError) return error.code;
    if (error instanceof QueryMemoryError) return error.code;
    if (error instanceof AddMemoryError) return error.code;
    if (error instanceof QueryCrmError) return error.code;
    if (error instanceof SearchCrmError) return error.code;
    if (error instanceof CreateTicketError) return error.code;
    if (error instanceof QueryTicketsError) return error.code;
    return 'UNKNOWN_ERROR';
  }

  /**
   * Get helpful suggestion for error
   */
  private static getErrorSuggestion(error: unknown): string {
    if (error instanceof SecurityError) {
      if (error.code === 'PATH_OUTSIDE_WORKSPACE') {
        return 'Ensure the file path is relative to the workspace root or within workspace boundaries.';
      }
      if (error.code === 'SENSITIVE_FILE_BLOCKED') {
        return 'Cannot access sensitive files like .env, credentials, or private keys for security reasons.';
      }
    }

    if (error instanceof RateLimitError) {
      return `Rate limit exceeded. You can make more tool calls after ${error.nextWindow.toLocaleTimeString()}.`;
    }

    if (error instanceof ReadFileError) {
      if (error.code === 'FILE_NOT_FOUND') {
        return 'Try using the list_directory tool to see available files, or search_code to find the file.';
      }
      if (error.code === 'BINARY_FILE') {
        return 'This appears to be a binary file. Only text files can be read.';
      }
    }

    if (error instanceof SearchCodeError) {
      if (error.code === 'SEARCH_TIMEOUT') {
        return 'Try narrowing your search with more specific patterns or file type filters.';
      }
    }

    if (error instanceof ClaudeCodeError) {
      return this.getClaudeCodeSuggestion(error);
    }

    if (error instanceof QueryMemoryError) {
      if (error.code === 'EMPTY_QUERY') {
        return 'Query cannot be empty. Provide a search term like "auth pattern" or "testing approach".';
      }
    }

    if (error instanceof AddMemoryError) {
      if (error.code === 'INVALID_TYPE_VALUE') {
        return 'Memory type must be one of: pattern, decision, preference, fact.';
      }
      if (error.code === 'EMPTY_KEY' || error.code === 'EMPTY_VALUE') {
        return 'Memory key and value are required and cannot be empty.';
      }
    }

    if (error instanceof QueryCrmError) {
      if (error.code === 'INVALID_ENTITY') {
        return 'Entity must be one of: leads, contacts, accounts, opportunities, campaigns.';
      }
      if (error.code === 'INVALID_ACTION') {
        return 'Action must be one of: list, count, get_by_id, summary.';
      }
      if (error.code === 'MISSING_ID') {
        return 'The get_by_id action requires an id parameter.';
      }
      if (error.code === 'NOT_FOUND') {
        return 'Record not found. Verify the ID is correct and belongs to the current workspace.';
      }
    }

    if (error instanceof SearchCrmError) {
      if (error.code === 'EMPTY_QUERY') {
        return 'Search query cannot be empty. Provide a name, email, or company to search for.';
      }
      if (error.code === 'QUERY_TOO_SHORT') {
        return 'Search query must be at least 2 characters long.';
      }
    }

    if (error instanceof CreateTicketError) {
      if (error.code === 'MISSING_TITLE') {
        return 'A ticket title is required. Provide a brief description of the issue.';
      }
      if (error.code === 'INVALID_CATEGORY') {
        return 'Category must be one of: support, product_feedback, feature_request, bug_report.';
      }
      if (error.code === 'INVALID_PRIORITY') {
        return 'Priority must be one of: low, medium, high, urgent.';
      }
    }

    if (error instanceof QueryTicketsError) {
      if (error.code === 'INVALID_ACTION') {
        return 'Action must be one of: list, count, get_by_id, summary, search.';
      }
      if (error.code === 'MISSING_ID') {
        return 'The get_by_id action requires an id parameter.';
      }
      if (error.code === 'NOT_FOUND') {
        return 'Ticket not found. Verify the ID is correct and belongs to the current workspace.';
      }
      if (error.code === 'INVALID_QUERY') {
        return 'Search query must be at least 2 characters. Provide a more specific search term.';
      }
    }

    return 'Please check the error message and try again with corrected parameters.';
  }

  /**
   * Get suggestion for Claude Code errors
   */
  private static getClaudeCodeSuggestion(error: ClaudeCodeError): string {
    switch (error.code) {
      case 'CLAUDE_CODE_NOT_AVAILABLE':
        return 'Install Claude Code with: npm install -g @anthropic-ai/claude-code';
      case 'DANGEROUS_OPERATION':
        return 'This operation requires manual execution for safety. Please run the command yourself or break it into safer steps.';
      case 'EXECUTION_FAILED':
        return 'Try breaking the task into smaller steps or check if the workspace has uncommitted changes.';
      default:
        return 'Please try again or rephrase your request.';
    }
  }
}
