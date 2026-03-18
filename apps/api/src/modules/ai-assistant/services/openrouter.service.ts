/**
 * OpenRouter Service
 * Integration with OpenRouter API using OpenAI SDK with tool calling support
 */

import OpenAI from 'openai';

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenRouterResponse {
  content: string | null;
  model: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  tool_calls?: ToolCall[];
}

export class OpenRouterService {
  /**
   * OpenRouter tool definitions
   */
  static readonly TOOLS = [
    {
      type: 'function' as const,
      function: {
        name: 'read_file',
        description: 'Read contents of a file in the workspace repository',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: "File path relative to workspace root (e.g., 'src/routes/dashboard.tsx')",
            },
            lineStart: {
              type: 'number',
              description: 'Optional: Start line number (1-indexed)',
            },
            lineEnd: {
              type: 'number',
              description: 'Optional: End line number (1-indexed)',
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'search_code',
        description: 'Search for patterns in codebase using ripgrep',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Search pattern (supports regex)',
            },
            fileTypes: {
              type: 'array',
              items: { type: 'string' },
              description: "Optional: File extensions (e.g., ['ts', 'tsx'])",
            },
            maxResults: {
              type: 'number',
              description: 'Optional: Max results (default 50, max 100)',
            },
          },
          required: ['pattern'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'list_directory',
        description: 'List contents of a directory in the workspace',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: "Directory path relative to workspace root (default: '.')",
            },
            depth: {
              type: 'number',
              description: 'Optional: Max depth (default 2, max 3)',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'askClaudeTo',
        description:
          'Execute a Claude Code command to perform complex code operations like refactoring, debugging, or multi-file changes. Use this when you need to modify code, run tests, or perform operations that require Claude Code\'s capabilities.',
        parameters: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description:
                'The task for Claude Code to perform (e.g., "Refactor authentication to use async/await", "Fix TypeScript errors in contacts module")',
            },
            sessionId: {
              type: 'string',
              description:
                'Optional: Session ID to resume previous Claude Code conversation for multi-turn operations',
            },
            maxTokens: {
              type: 'number',
              description: 'Optional: Max tokens for Claude Code response (default 4000, max 8000)',
            },
          },
          required: ['prompt'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'query_memory',
        description:
          'Query workspace memory for patterns, decisions, preferences, and facts that have been stored across conversations. Use this to recall architectural patterns, past decisions, coding conventions, or any knowledge that was previously stored.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Natural language query to search memories (e.g., "auth pattern", "testing approach", "API design decision")',
            },
            category: {
              type: 'string',
              description:
                'Optional: Filter by category (e.g., "architecture", "testing", "styling", "deployment", "decisions")',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'add_memory',
        description:
          'Store important patterns, decisions, preferences, or facts in workspace memory for future recall. Use this to remember architectural patterns, design decisions, coding conventions, or any knowledge that should persist across conversations.',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['pattern', 'decision', 'preference', 'fact'],
              description:
                'Type of memory: "pattern" for architectural/code patterns, "decision" for design decisions, "preference" for user/team preferences, "fact" for general knowledge',
            },
            key: {
              type: 'string',
              description:
                'Unique identifier for this memory (e.g., "auth_pattern", "api_framework", "test_runner")',
            },
            value: {
              type: 'string',
              description: 'The memory content to store (e.g., "We use JWT with refresh tokens")',
            },
            category: {
              type: 'string',
              description:
                'Optional: Category for organization (e.g., "architecture", "testing", "styling", "deployment")',
            },
            relatedFiles: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: File paths related to this memory',
            },
          },
          required: ['type', 'key', 'value'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'query_crm',
        description:
          'Query CRM data for the current workspace. Retrieve leads, contacts, accounts, opportunities, or campaigns. Use action="summary" for overview questions, "count" for totals, "list" for records, "get_by_id" for a specific record.',
        parameters: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              enum: ['leads', 'contacts', 'accounts', 'opportunities', 'campaigns'],
              description: 'The CRM entity type to query',
            },
            action: {
              type: 'string',
              enum: ['list', 'count', 'get_by_id', 'summary'],
              description:
                'Action to perform: list (records), count (totals with breakdown), get_by_id (single record), summary (aggregate stats)',
            },
            id: {
              type: 'string',
              description: 'Entity ID (required for get_by_id action)',
            },
            filters: {
              type: 'object',
              properties: {
                status: { type: 'string', description: 'Filter by status' },
                stage: { type: 'string', description: 'Filter by stage (opportunities) or lifecycle stage (contacts)' },
                ownerId: { type: 'string', description: 'Filter by owner user ID' },
                accountId: { type: 'string', description: 'Filter by account ID' },
                contactId: { type: 'string', description: 'Filter by contact ID' },
              },
            },
            limit: {
              type: 'number',
              description: 'Max records to return (default 20, max 50). Only for list action.',
            },
          },
          required: ['entity', 'action'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'search_crm',
        description:
          'Search CRM entities by name, email, or company. Use when looking for a specific person or company across leads, contacts, and accounts.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search text (name, email, or company name)',
            },
            entityTypes: {
              type: 'array',
              items: { type: 'string', enum: ['leads', 'contacts', 'accounts'] },
              description: 'Entity types to search (default: all three)',
            },
            limit: {
              type: 'number',
              description: 'Max results per entity type (default 10, max 25)',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'create_ticket',
        description:
          'Create a support ticket or product feedback. Use when users report issues, request features, or provide feedback. Before creating, search existing tickets for duplicates.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Short descriptive title for the ticket',
            },
            description: {
              type: 'string',
              description: 'Detailed description of the issue or request',
            },
            category: {
              type: 'string',
              enum: ['support', 'product_feedback', 'feature_request', 'bug_report'],
              description:
                'Ticket category: support (customer issues), product_feedback (suggestions), feature_request (new features), bug_report (bugs)',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Priority level (default: medium)',
            },
            entityType: {
              type: 'string',
              enum: ['lead', 'contact', 'account'],
              description: 'Optional: CRM entity type this ticket relates to',
            },
            entityId: {
              type: 'string',
              description: 'Optional: ID of the CRM entity this ticket relates to',
            },
          },
          required: ['title'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'query_tickets',
        description:
          'Search, list, count, or summarize support tickets. Use action="summary" for overview, "search" to find specific tickets, "list" for filtered results, "count" for totals, "get_by_id" for a specific ticket.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['list', 'count', 'get_by_id', 'summary', 'search'],
              description:
                'Action: list (filtered records), count (totals with breakdown), get_by_id (single ticket), summary (aggregate stats), search (text search)',
            },
            id: {
              type: 'string',
              description: 'Ticket ID (required for get_by_id action)',
            },
            filters: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'],
                  description: 'Filter by status',
                },
                category: {
                  type: 'string',
                  enum: ['support', 'product_feedback', 'feature_request', 'bug_report'],
                  description: 'Filter by category',
                },
                priority: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'urgent'],
                  description: 'Filter by priority',
                },
                assigneeId: { type: 'string', description: 'Filter by assignee user ID' },
                entityId: { type: 'string', description: 'Filter by related CRM entity ID' },
              },
            },
            query: {
              type: 'string',
              description: 'Search text for search action (searches title and description)',
            },
            limit: {
              type: 'number',
              description: 'Max records to return (default 20, max 50). For list and search actions.',
            },
          },
          required: ['action'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'highlight_element',
        description:
          'Highlight a specific UI element on the current page with a popover tooltip to guide the user. Use this when a user asks where something is or how to do something.',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description:
                "CSS selector using data-tour attribute, e.g. \"[data-tour='leads-table']\"",
            },
            title: {
              type: 'string',
              description: 'Short label for the highlighted element',
            },
            body: {
              type: 'string',
              description: 'Brief explanation of what this element does',
            },
            position: {
              type: 'string',
              enum: ['top', 'bottom', 'left', 'right'],
              description: 'Popover position relative to element',
            },
          },
          required: ['selector', 'title', 'body'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'run_tour',
        description:
          'Run a multi-step guided tour highlighting several elements in sequence. Use for "show me around" or "how do I get started" requests.',
        parameters: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  selector: { type: 'string' },
                  title: { type: 'string' },
                  body: { type: 'string' },
                  position: {
                    type: 'string',
                    enum: ['top', 'bottom', 'left', 'right'],
                  },
                },
                required: ['selector', 'title', 'body'],
              },
            },
          },
          required: ['steps'],
        },
      },
    },
  ];

  /**
   * Send a message to OpenRouter and get AI response with tool calling support
   *
   * @param messages - Array of chat messages
   * @param config - OpenRouter configuration
   * @param tools - Optional tools to enable (defaults to all tools)
   * @returns AI response with token usage and optional tool calls
   */
  static async sendMessage(params: {
    messages: ChatMessage[];
    config: OpenRouterConfig;
    tools?: any[];
  }): Promise<OpenRouterResponse> {
    const { messages, config, tools = this.TOOLS } = params;

    // Validate inputs
    if (!config.apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    if (!messages || messages.length === 0) {
      throw new Error('At least one message is required');
    }

    try {
      // Create OpenAI client configured for OpenRouter
      const client = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: config.apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://agios.dev', // Optional: for OpenRouter analytics
          'X-Title': 'NewLeads AI', // Optional: for OpenRouter analytics
        },
      });

      // Build request params
      const requestParams: any = {
        model: config.model,
        messages: messages.map((msg) => {
          const mapped: any = {
            role: msg.role,
            content: msg.content,
          };
          if (msg.tool_calls) {
            mapped.tool_calls = msg.tool_calls;
          }
          if (msg.tool_call_id) {
            mapped.tool_call_id = msg.tool_call_id;
          }
          return mapped;
        }),
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      };

      // Add tools if provided
      if (tools && tools.length > 0) {
        requestParams.tools = tools;
      }

      // Call OpenRouter API
      const response = await client.chat.completions.create(requestParams);

      // Extract response
      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from OpenRouter');
      }

      return {
        content: choice.message.content || null,
        model: response.model,
        tokenUsage: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
        tool_calls: choice.message.tool_calls as ToolCall[] | undefined,
      };
    } catch (error) {
      // Handle OpenRouter/OpenAI SDK errors
      if (error instanceof OpenAI.APIError) {
        throw new Error(
          `OpenRouter API error: ${error.message} (status: ${error.status})`
        );
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Validate OpenRouter API key
   *
   * @param apiKey - API key to validate
   * @returns true if valid, false otherwise
   */
  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Test with a minimal request
      await this.sendMessage({
        messages: [{ role: 'user', content: 'test' }],
        config: {
          apiKey,
          model: 'anthropic/claude-3.5-haiku',
          maxTokens: 10,
          temperature: 0.7,
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}
