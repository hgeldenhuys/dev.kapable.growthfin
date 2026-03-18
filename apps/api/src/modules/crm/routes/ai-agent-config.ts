/**
 * AI Agent Configuration Routes
 * Phase J: Configure ElevenLabs agents with tools and data collection
 *
 * Endpoints for:
 * - Viewing current agent configuration
 * - Applying tools and data collection schema
 * - Verifying tool configuration
 */

import Elysia, { t } from 'elysia';
import {
  aiAgentConfigService,
  DEFAULT_DATA_COLLECTION_SCHEMA,
} from '../services/ai-agent-config';

export const aiAgentConfigRoutes = new Elysia({ prefix: '/ai-agents' })
  /**
   * GET /config - Get current ElevenLabs agent configuration
   */
  .get('/config', async ({ query, set }) => {
    try {
      const agentId = process.env['ELEVENLABS_AGENT_ID'];
      if (!agentId) {
        set.status = 400;
        return { error: 'ELEVENLABS_AGENT_ID not configured' };
      }

      const config = await aiAgentConfigService.getAgentConfig(agentId);
      if (!config) {
        set.status = 404;
        return { error: 'Agent not found or API error' };
      }

      // Extract relevant configuration parts
      const tools = config.conversation_config?.agent?.tools || [];
      const dataCollection = config.conversation_config?.data_collection || { enabled: false };

      return {
        agentId,
        name: config.name,
        tools: tools.map((t: any) => ({
          type: t.type,
          name: t.name,
          description: t.description,
        })),
        dataCollection: {
          enabled: dataCollection.enabled,
          fieldCount: dataCollection.schema?.properties
            ? Object.keys(dataCollection.schema.properties).length
            : 0,
        },
      };
    } catch (error) {
      console.error('[AI Agent Config] Error getting config:', error);
      set.status = 500;
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
    detail: {
      tags: ['AI Agents'],
      summary: 'Get agent configuration',
      description: 'Get the current ElevenLabs agent configuration including tools and data collection',
    },
  })

  /**
   * POST /config/apply - Apply full tool and data collection configuration
   */
  .post('/config/apply', async ({ body, set }) => {
    try {
      const agentId = process.env['ELEVENLABS_AGENT_ID'];
      if (!agentId) {
        set.status = 400;
        return { error: 'ELEVENLABS_AGENT_ID not configured' };
      }

      const result = await aiAgentConfigService.configureAgent({
        agentId,
        workspaceId: body.workspaceId,
        enableBuiltInTools: body.enableBuiltInTools ?? true,
        enableWebhookTools: body.enableWebhookTools ?? true,
        enableDataCollection: body.enableDataCollection ?? true,
      });

      if (!result.success) {
        set.status = 500;
        return { error: result.error };
      }

      return {
        success: true,
        message: 'Agent configuration applied successfully',
        configuration: {
          builtInToolsEnabled: body.enableBuiltInTools ?? true,
          webhookToolsEnabled: body.enableWebhookTools ?? true,
          dataCollectionEnabled: body.enableDataCollection ?? true,
        },
      };
    } catch (error) {
      console.error('[AI Agent Config] Error applying config:', error);
      set.status = 500;
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      enableBuiltInTools: t.Optional(t.Boolean()),
      enableWebhookTools: t.Optional(t.Boolean()),
      enableDataCollection: t.Optional(t.Boolean()),
    }),
    detail: {
      tags: ['AI Agents'],
      summary: 'Apply agent configuration',
      description: 'Configure the ElevenLabs agent with tools and data collection schema',
    },
  })

  /**
   * GET /config/verify - Verify current tool configuration
   */
  .get('/config/verify', async ({ query, set }) => {
    try {
      const agentId = process.env['ELEVENLABS_AGENT_ID'];
      if (!agentId) {
        set.status = 400;
        return { error: 'ELEVENLABS_AGENT_ID not configured' };
      }

      const verification = await aiAgentConfigService.verifyToolConfiguration(agentId);

      return {
        agentId,
        verified: verification.configured,
        tools: verification.tools,
        dataCollectionEnabled: verification.dataCollectionEnabled,
        expectedTools: [
          'end_call',
          'voicemail_detection',
          'schedule_callback',
          'send_sms',
          'lookup_account',
          'create_task',
          'log_issue',
        ],
        missingTools: [
          'end_call',
          'voicemail_detection',
          'schedule_callback',
          'send_sms',
          'lookup_account',
          'create_task',
          'log_issue',
        ].filter(name => !verification.tools.includes(name)),
      };
    } catch (error) {
      console.error('[AI Agent Config] Error verifying config:', error);
      set.status = 500;
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
    detail: {
      tags: ['AI Agents'],
      summary: 'Verify tool configuration',
      description: 'Verify that the ElevenLabs agent has all expected tools configured',
    },
  })

  /**
   * GET /data-collection/schema - Get the data collection schema definition
   */
  .get('/data-collection/schema', async () => {
    return {
      schema: DEFAULT_DATA_COLLECTION_SCHEMA,
      description: 'Fields extracted by the AI during conversations',
      fieldCount: DEFAULT_DATA_COLLECTION_SCHEMA.length,
    };
  }, {
    detail: {
      tags: ['AI Agents'],
      summary: 'Get data collection schema',
      description: 'Get the default data collection schema that defines what information the AI extracts',
    },
  })

  /**
   * GET /tools/available - List all available webhook tools
   */
  .get('/tools/available', async ({ query }) => {
    const webhookTools = aiAgentConfigService.getWebhookTools(query.workspaceId);
    const builtInTools = aiAgentConfigService.getBuiltInTools();

    return {
      builtInTools: builtInTools.map(t => ({
        name: t.name,
        type: t.type,
        description: t.name === 'end_call'
          ? 'Ends the call when the conversation is complete'
          : 'Detects voicemail and handles accordingly',
      })),
      webhookTools: webhookTools.map(t => ({
        name: t.name,
        description: t.description,
        endpoint: t.webhook.url,
        parameters: Object.keys(t.parameters.properties || {}),
      })),
    };
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
    detail: {
      tags: ['AI Agents'],
      summary: 'List available tools',
      description: 'List all available built-in and webhook tools that can be configured',
    },
  });
