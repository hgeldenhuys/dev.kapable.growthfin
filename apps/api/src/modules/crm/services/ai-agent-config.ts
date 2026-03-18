/**
 * AI Agent Configuration Service
 * Phase J: Configure ElevenLabs agents with tools and data collection
 *
 * Handles:
 * - Built-in tools (end_call, voicemail_detection)
 * - Custom webhook tools (schedule_callback, send_sms, etc.)
 * - Data collection schema configuration
 */

import { db } from '@agios/db';
import { crmAiAgents } from '@agios/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * ElevenLabs API base URL
 */
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

/**
 * Data collection field definitions for ElevenLabs
 */
export interface DataCollectionField {
  name: string;
  description: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  enum?: string[];
  required?: boolean;
}

/**
 * Default data collection schema for AI calls
 * These fields are extracted by the AI during conversation
 */
export const DEFAULT_DATA_COLLECTION_SCHEMA: DataCollectionField[] = [
  {
    name: 'interest_level',
    description: 'The prospect\'s level of interest in the product/service',
    type: 'string',
    enum: ['high', 'medium', 'low', 'none'],
    required: true,
  },
  {
    name: 'callback_requested',
    description: 'Whether the prospect requested a callback',
    type: 'boolean',
    required: true,
  },
  {
    name: 'preferred_callback_time',
    description: 'The preferred time for a callback in ISO format (if requested)',
    type: 'string',
  },
  {
    name: 'meeting_scheduled',
    description: 'Whether a meeting/demo was scheduled during the call',
    type: 'boolean',
    required: true,
  },
  {
    name: 'meeting_datetime',
    description: 'The scheduled meeting date and time in ISO format (if scheduled)',
    type: 'string',
  },
  {
    name: 'sentiment',
    description: 'Overall sentiment of the conversation',
    type: 'string',
    enum: ['positive', 'neutral', 'negative'],
    required: true,
  },
  {
    name: 'key_pain_points',
    description: 'Pain points or challenges mentioned by the prospect',
    type: 'array',
  },
  {
    name: 'next_steps',
    description: 'Agreed upon next steps at the end of the call',
    type: 'string',
  },
  {
    name: 'objections_raised',
    description: 'Objections raised by the prospect during the call',
    type: 'array',
  },
  {
    name: 'budget_mentioned',
    description: 'Whether the prospect mentioned having a budget',
    type: 'boolean',
  },
  {
    name: 'decision_maker',
    description: 'Whether the prospect is a decision maker',
    type: 'boolean',
  },
  {
    name: 'timeline',
    description: 'The prospect\'s decision timeline',
    type: 'string',
    enum: ['immediate', '1_3_months', '3_6_months', '6_plus_months', 'no_timeline'],
  },
];

/**
 * Built-in tool definitions
 */
export interface BuiltInTool {
  type: 'system';
  name: 'end_call' | 'voicemail_detection';
  config?: {
    // For voicemail_detection
    machine_detection_timeout?: number;
    machine_detection_speech_threshold?: number;
    machine_detection_speech_end_threshold?: number;
    machine_detection_silence_timeout?: number;
  };
}

/**
 * Webhook tool definition
 */
export interface WebhookTool {
  type: 'webhook';
  name: string;
  description: string;
  webhook: {
    url: string;
    method: 'POST' | 'GET';
    headers?: Record<string, string>;
  };
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      required?: boolean;
    }>;
    required?: string[];
  };
}

/**
 * AI Agent Configuration Service
 */
export const aiAgentConfigService = {
  /**
   * Get the ElevenLabs API key
   */
  getApiKey(): string {
    const apiKey = process.env['ELEVENLABS_API_KEY'];
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }
    return apiKey;
  },

  /**
   * Get the base webhook URL for AI tools
   */
  getWebhookBaseUrl(): string {
    return process.env['API_BASE_URL'] || 'https://api.newleads.co.za';
  },

  /**
   * Configure built-in tools for an agent
   */
  getBuiltInTools(): BuiltInTool[] {
    return [
      {
        type: 'system',
        name: 'end_call',
      },
      {
        type: 'system',
        name: 'voicemail_detection',
        config: {
          machine_detection_timeout: 30000,
          machine_detection_speech_threshold: 2400,
          machine_detection_speech_end_threshold: 1200,
          machine_detection_silence_timeout: 5000,
        },
      },
    ];
  },

  /**
   * Get webhook tool definitions
   */
  getWebhookTools(workspaceId: string): WebhookTool[] {
    const baseUrl = this.getWebhookBaseUrl();

    return [
      {
        type: 'webhook',
        name: 'schedule_callback',
        description: 'Schedule a callback with the prospect at a specific time. Use when the prospect requests to be called back later.',
        webhook: {
          url: `${baseUrl}/api/v1/crm/ai-tools/schedule-callback`,
          method: 'POST',
        },
        parameters: {
          type: 'object',
          properties: {
            callback_time: {
              type: 'string',
              description: 'The requested callback time in natural language (e.g., "tomorrow at 2pm", "next Monday morning")',
              required: true,
            },
            callback_reason: {
              type: 'string',
              description: 'Brief reason for the callback',
            },
            timezone: {
              type: 'string',
              description: 'The prospect\'s timezone if mentioned',
            },
          },
          required: ['callback_time'],
        },
      },
      {
        type: 'webhook',
        name: 'send_sms',
        description: 'Send an SMS message to the prospect. Use for confirmations, follow-up info, or requested details.',
        webhook: {
          url: `${baseUrl}/api/v1/crm/ai-tools/send-sms`,
          method: 'POST',
        },
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The SMS message to send',
              required: true,
            },
            purpose: {
              type: 'string',
              description: 'Purpose of the SMS',
              enum: ['meeting_confirmation', 'callback_confirmation', 'info_request', 'follow_up'],
            },
          },
          required: ['message'],
        },
      },
      {
        type: 'webhook',
        name: 'lookup_account',
        description: 'Look up additional information about the prospect or their company. Use when you need context about their history or account details.',
        webhook: {
          url: `${baseUrl}/api/v1/crm/ai-tools/lookup-account`,
          method: 'POST',
        },
        parameters: {
          type: 'object',
          properties: {
            lookup_type: {
              type: 'string',
              description: 'What information to look up',
              enum: ['contact_history', 'company_info', 'previous_purchases', 'open_opportunities'],
              required: true,
            },
          },
          required: ['lookup_type'],
        },
      },
      {
        type: 'webhook',
        name: 'create_task',
        description: 'Create a follow-up task for the sales team. Use when there\'s a specific action needed after the call.',
        webhook: {
          url: `${baseUrl}/api/v1/crm/ai-tools/create-task`,
          method: 'POST',
        },
        parameters: {
          type: 'object',
          properties: {
            task_title: {
              type: 'string',
              description: 'Title of the task',
              required: true,
            },
            task_description: {
              type: 'string',
              description: 'Detailed description of what needs to be done',
              required: true,
            },
            priority: {
              type: 'string',
              description: 'Task priority',
              enum: ['high', 'medium', 'low'],
            },
            due_date: {
              type: 'string',
              description: 'When the task should be completed (e.g., "tomorrow", "in 3 days")',
            },
          },
          required: ['task_title', 'task_description'],
        },
      },
      {
        type: 'webhook',
        name: 'log_issue',
        description: 'Log an issue or problem encountered during the call. Use this when you cannot complete an action, encounter an error, or need to report something unusual. This helps the team improve the system.',
        webhook: {
          url: `${baseUrl}/api/v1/crm/ai-tools/log-issue`,
          method: 'POST',
        },
        parameters: {
          type: 'object',
          properties: {
            issue_type: {
              type: 'string',
              description: 'Type of issue encountered',
              enum: ['tool_failure', 'unclear_request', 'system_error', 'customer_complaint', 'other'],
              required: true,
            },
            description: {
              type: 'string',
              description: 'Brief description of what happened',
              required: true,
            },
            severity: {
              type: 'string',
              description: 'How serious is the issue',
              enum: ['low', 'medium', 'high'],
            },
            context: {
              type: 'string',
              description: 'Additional context about when and why this happened',
            },
          },
          required: ['issue_type', 'description'],
        },
      },
    ];
  },

  /**
   * Build the data collection configuration for ElevenLabs
   */
  buildDataCollectionConfig(fields: DataCollectionField[] = DEFAULT_DATA_COLLECTION_SCHEMA): {
    enabled: boolean;
    schema: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const field of fields) {
      const prop: any = {
        type: field.type === 'array' ? 'array' : field.type,
        description: field.description,
      };

      if (field.type === 'array') {
        prop.items = { type: 'string' };
      }

      if (field.enum) {
        prop.enum = field.enum;
      }

      properties[field.name] = prop;

      if (field.required) {
        required.push(field.name);
      }
    }

    return {
      enabled: true,
      schema: {
        type: 'object',
        properties,
        required,
      },
    };
  },

  /**
   * Configure an ElevenLabs agent with tools and data collection
   * This updates the agent configuration via the ElevenLabs API
   *
   * Process:
   * 1. Create webhook tools in workspace (if they don't exist)
   * 2. Add system tools to agent prompt.tools
   * 3. Add webhook tool IDs to agent prompt.tool_ids
   * 4. Configure data collection in platform_settings
   */
  async configureAgent(params: {
    agentId: string;
    workspaceId: string;
    enableBuiltInTools?: boolean;
    enableWebhookTools?: boolean;
    enableDataCollection?: boolean;
    customDataCollectionFields?: DataCollectionField[];
  }): Promise<{ success: boolean; error?: string }> {
    const {
      agentId,
      workspaceId,
      enableBuiltInTools = true,
      enableWebhookTools = true,
      enableDataCollection = true,
      customDataCollectionFields,
    } = params;

    try {
      const apiKey = this.getApiKey();
      const toolIds: string[] = [];

      // Step 1: Create webhook tools in workspace (if enabled)
      if (enableWebhookTools) {
        const webhookTools = this.getWebhookTools(workspaceId);

        for (const tool of webhookTools) {
          // Check if tool exists
          const existingTools = await this.listWorkspaceTools();
          const existing = existingTools.find(t => t.name === tool.name);

          if (existing) {
            toolIds.push(existing.id);
          } else {
            // Create the tool
            const result = await this.createWebhookTool(tool);
            if (result.toolId) {
              toolIds.push(result.toolId);
            }
          }
        }
      }

      // Step 2: Build agent update with system tools and tool_ids
      const systemTools: Array<{ type: 'system'; name: string; description?: string }> = [];

      if (enableBuiltInTools) {
        systemTools.push(
          { type: 'system', name: 'end_call', description: 'End the call when the conversation is naturally complete' },
          { type: 'system', name: 'voicemail_detection', description: 'Detect voicemail and leave a message' }
        );
      }

      const config: any = {
        conversation_config: {
          agent: {
            prompt: {
              tool_ids: toolIds,
              tools: systemTools,
            },
          },
        },
      };

      // Step 3: Add data collection to platform_settings (if enabled)
      if (enableDataCollection) {
        const fields = customDataCollectionFields || DEFAULT_DATA_COLLECTION_SCHEMA;
        config.platform_settings = {
          data_collection: {
            enabled: true,
            messages: {
              agent: "I've noted that down.",
              user: "Please provide the following information:",
            },
            fields: fields.map(f => ({
              identifier: f.name,
              label: f.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              data_type: f.type === 'array' ? 'string_array' : f.type,
              is_required: f.required || false,
              enum_values: f.enum,
              description: f.description,
            })),
          },
        };
      }

      // Step 4: Update the agent via ElevenLabs API
      const response = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Agent Config] Failed to configure agent:', errorText);
        return { success: false, error: errorText };
      }

      const result = await response.json();
      console.log('[AI Agent Config] Agent configured successfully');

      // Update local agent record with client tools
      if (enableWebhookTools) {
        const webhookTools = this.getWebhookTools(workspaceId);
        await db.update(crmAiAgents)
          .set({
            clientTools: webhookTools.map(t => ({
              name: t.name,
              description: t.description,
              url: t.webhook.url,
              method: t.webhook.method,
              parameters: t.parameters,
            })),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(crmAiAgents.agentId, agentId),
              eq(crmAiAgents.workspaceId, workspaceId)
            )
          );
      }

      return { success: true };
    } catch (error) {
      console.error('[AI Agent Config] Error configuring agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * List all tools in the workspace
   */
  async listWorkspaceTools(): Promise<Array<{ id: string; name: string }>> {
    try {
      const apiKey = this.getApiKey();
      const response = await fetch(`${ELEVENLABS_API_BASE}/convai/tools`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.tools || []).map((t: any) => ({
        id: t.id,
        name: t.tool_config?.name || t.name,
      }));
    } catch (error) {
      console.error('[AI Agent Config] Error listing tools:', error);
      return [];
    }
  },

  /**
   * Create a webhook tool in the workspace
   */
  async createWebhookTool(tool: WebhookTool): Promise<{ success: boolean; toolId?: string; error?: string }> {
    try {
      const apiKey = this.getApiKey();

      // Convert our tool format to ElevenLabs API format
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, prop] of Object.entries(tool.parameters.properties)) {
        properties[key] = {
          type: prop.type,
          description: prop.description,
          enum: prop.enum || null,
        };
        if (prop.required) {
          required.push(key);
        }
      }

      const toolConfig = {
        tool_config: {
          type: 'webhook',
          name: tool.name,
          description: tool.description,
          api_schema: {
            url: tool.webhook.url,
            method: tool.webhook.method,
            request_body_schema: {
              type: 'object',
              properties,
              required: tool.parameters.required || required,
            },
          },
        },
      };

      const response = await fetch(`${ELEVENLABS_API_BASE}/convai/tools`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toolConfig),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Agent Config] Failed to create tool:', errorText);
        return { success: false, error: errorText };
      }

      const result = await response.json();
      return { success: true, toolId: result.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Register a single webhook tool with ElevenLabs
   */
  async registerWebhookTool(agentId: string, tool: WebhookTool): Promise<{ success: boolean; toolId?: string; error?: string }> {
    try {
      const apiKey = this.getApiKey();

      const response = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${agentId}/tools`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tool),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: errorText };
      }

      const result = await response.json();
      return { success: true, toolId: result.tool_id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Get current agent configuration from ElevenLabs
   */
  async getAgentConfig(agentId: string): Promise<any | null> {
    try {
      const apiKey = this.getApiKey();

      const response = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${agentId}`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      });

      if (!response.ok) {
        console.error('[AI Agent Config] Failed to get agent config');
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[AI Agent Config] Error getting agent config:', error);
      return null;
    }
  },

  /**
   * Verify webhook tools are properly configured
   */
  async verifyToolConfiguration(agentId: string): Promise<{
    configured: boolean;
    tools: string[];
    dataCollectionEnabled: boolean;
  }> {
    const config = await this.getAgentConfig(agentId);

    if (!config) {
      return {
        configured: false,
        tools: [],
        dataCollectionEnabled: false,
      };
    }

    // Tools are in conversation_config.agent.prompt.tools (ElevenLabs API structure)
    const tools = config.conversation_config?.agent?.prompt?.tools || [];
    const toolNames = tools.map((t: any) => t.name);

    // Data collection is in platform_settings.data_collection
    const dataCollectionEnabled = config.platform_settings?.data_collection?.enabled || false;

    return {
      configured: tools.length > 0,
      tools: toolNames,
      dataCollectionEnabled,
    };
  },
};

export type { BuiltInTool, WebhookTool };
