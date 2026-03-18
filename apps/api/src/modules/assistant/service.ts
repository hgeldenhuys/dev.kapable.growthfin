/**
 * Assistant Chat Service
 * Handles conversational AI chat using LLM config system
 */

import { db } from '@agios/db/client';
import { conversations, messages, llmConfigs, llmModelCatalog, llmCredentials } from '@agios/db/schema';
import { eq, desc, sql, and, or, isNull } from 'drizzle-orm';
import { llmService } from '../../lib/llm';
import type { LLMMessage } from '../../lib/llm';
import type { ConversationListItem } from './types';

export class AssistantService {
  /**
   * Resolve a model identifier to an LLM config name
   * Handles both:
   * - LLM config names (e.g., "chat-message-generator")
   * - Model catalog model names (e.g., "anthropic/claude-3.5-sonnet")
   */
  private static async resolveModelToConfigName(modelIdentifier: string): Promise<string> {
    // If it doesn't contain a slash, assume it's already an LLM config name
    if (!modelIdentifier.includes('/')) {
      return modelIdentifier;
    }

    // It's a model catalog entry (e.g., "anthropic/claude-3.5-sonnet")
    // Check if we already have an LLM config for this model
    const existingConfig = await db
      .select()
      .from(llmConfigs)
      .where(
        and(
          eq(llmConfigs.model, modelIdentifier),
          eq(llmConfigs.isActive, true)
        )
      )
      .limit(1);

    if (existingConfig.length > 0) {
      return existingConfig[0].name;
    }

    // No existing config, need to create one dynamically
    // Get the model from catalog for metadata
    const catalogModel = await db
      .select()
      .from(llmModelCatalog)
      .where(eq(llmModelCatalog.modelName, modelIdentifier))
      .limit(1);

    if (catalogModel.length === 0) {
      throw new Error(`Model not found in catalog: ${modelIdentifier}`);
    }

    // Get any active OpenRouter credential (openapi provider)
    const openrouterCredential = await db
      .select()
      .from(llmCredentials)
      .where(
        and(
          eq(llmCredentials.provider, 'openapi'),
          eq(llmCredentials.isActive, true)
        )
      )
      .limit(1);

    if (openrouterCredential.length === 0) {
      throw new Error('No active OpenRouter credential found. Please configure an OpenRouter (openapi) credential first.');
    }

    // Create a new LLM config for this model
    const configName = `catalog-${modelIdentifier.replace('/', '-')}`;

    // Try to create the config
    try {
      const [newConfig] = await db
        .insert(llmConfigs)
        .values({
          name: configName,
          provider: 'openapi', // OpenRouter uses OpenAPI format
          model: modelIdentifier,
          systemPrompt: 'You are a helpful AI assistant.',
          apiUrl: 'https://openrouter.ai/api/v1/chat/completions', // OpenRouter endpoint
          credentialId: openrouterCredential[0].id,
          isActive: true,
        })
        .returning();

      return newConfig.name;
    } catch (error) {
      // If insert fails due to duplicate, that's OK - just return the config name
      // (Another request might have created it concurrently)
      const errorMsg = error instanceof Error ? error.message : '';
      if (errorMsg.includes('duplicate') || errorMsg.includes('unique')) {
        return configName;
      }
      throw error;
    }
  }

  /**
   * Stream chat response using LLM config system
   */
  static async *streamChatResponse(
    conversationId: string,
    userMessage: string,
    modelName: string = 'chat-message-generator',
    extendedThinking: boolean = false
  ): AsyncGenerator<string, void, unknown> {
    // Get conversation to check workspace context
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation || conversation.length === 0) {
      throw new Error('Conversation not found');
    }

    // Get conversation history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    // Save user message first
    await db.insert(messages).values({
      conversationId,
      role: 'user',
      content: userMessage,
    });

    // Build messages array for LLM
    const llmMessages: LLMMessage[] = history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Add new user message
    llmMessages.push({
      role: 'user',
      content: userMessage,
    });

    // Stream response using LLM config system
    // Resolve model identifier to LLM config name (handles both config names and model catalog entries)
    const resolvedConfigName = await this.resolveModelToConfigName(modelName);
    let fullResponse = '';

    try {
      for await (const chunk of llmService.completeStream(
        resolvedConfigName,
        llmMessages,
        conversation[0].projectId || undefined,
        { extendedThinking }
      )) {
        fullResponse += chunk;
        yield chunk;
      }

      // Save complete assistant message
      await db.insert(messages).values({
        conversationId,
        role: 'assistant',
        content: fullResponse,
      });

      // Update conversation timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`LLM API error: ${errorMsg}`);
    }
  }

  /**
   * Get a conversation with all messages
   */
  static async getConversation(conversationId: string) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return null;
    }

    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return {
      ...conversation,
      messages: conversationMessages,
    };
  }

  /**
   * List conversations for a workspace
   */
  static async listConversations(
    workspaceId: string,
    limit = 50
  ): Promise<ConversationListItem[]> {
    const result = await db
      .select({
        id: conversations.id,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        messageCount: sql<number>`count(${messages.id})::int`,
        lastMessagePreview: sql<string>`
          coalesce(
            (
              select content
              from ${messages}
              where ${messages.conversationId} = ${conversations.id}
              order by ${messages.createdAt} desc
              limit 1
            ),
            ''
          )
        `,
      })
      .from(conversations)
      .leftJoin(messages, eq(conversations.id, messages.conversationId))
      .where(eq(conversations.workspaceId, workspaceId))
      .groupBy(conversations.id)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);

    return result.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messageCount: row.messageCount,
      lastMessagePreview: row.lastMessagePreview.substring(0, 100),
    }));
  }

  /**
   * Create a new conversation
   */
  static async createConversation(workspaceId: string, projectId?: string) {
    const [conversation] = await db
      .insert(conversations)
      .values({
        workspaceId,
        projectId: projectId || null,
      })
      .returning();

    return conversation;
  }

  /**
   * Delete a conversation
   */
  static async deleteConversation(conversationId: string) {
    await db.delete(conversations).where(eq(conversations.id, conversationId));
  }

  /**
   * Get available LLM configs for a workspace
   * Returns both global configs and workspace-specific configs
   */
  static async getAvailableModels(workspaceId: string) {
    const configs = await db
      .select({
        id: llmConfigs.id,
        name: llmConfigs.name,
        provider: llmConfigs.provider,
        model: llmConfigs.model,
        systemPrompt: llmConfigs.systemPrompt,
      })
      .from(llmConfigs)
      .where(
        and(
          eq(llmConfigs.isActive, true),
          or(
            isNull(llmConfigs.projectId),
            // Could add workspace-specific filtering here if needed
          )
        )
      )
      .orderBy(llmConfigs.name);

    return configs;
  }

  /**
   * Get available credentials with model counts
   * Returns all active credentials that have models in the catalog
   */
  static async getAvailableCredentials() {
    const credentials = await db
      .select({
        id: llmCredentials.id,
        name: llmCredentials.name,
        provider: llmCredentials.provider,
        isActive: llmCredentials.isActive,
        modelCount: sql<number>`COUNT(DISTINCT ${llmModelCatalog.modelName})::int`,
      })
      .from(llmCredentials)
      .leftJoin(llmConfigs, eq(llmCredentials.id, llmConfigs.credentialId))
      .leftJoin(llmModelCatalog, eq(llmConfigs.model, llmModelCatalog.modelName))
      .where(eq(llmCredentials.isActive, true))
      .groupBy(
        llmCredentials.id,
        llmCredentials.name,
        llmCredentials.provider,
        llmCredentials.isActive
      )
      .orderBy(llmCredentials.name);

    return credentials;
  }

  /**
   * Get providers accessible via a specific credential
   * Extracts provider from model names (e.g., "openai/gpt-4" -> "openai")
   * Note: Queries catalog directly, showing all available providers
   */
  static async getProvidersByCredential(credentialId: string) {
    // First verify the credential exists and is active
    const [credential] = await db
      .select({
        id: llmCredentials.id,
        provider: llmCredentials.provider
      })
      .from(llmCredentials)
      .where(and(eq(llmCredentials.id, credentialId), eq(llmCredentials.isActive, true)))
      .limit(1);

    if (!credential) {
      throw new Error('Credential not found');
    }

    // Query catalog directly - show ALL providers
    // OpenRouter (openapi) can access all providers, direct credentials access their own only
    const providers = await db
      .select({
        provider: sql<string>`SPLIT_PART(${llmModelCatalog.modelName}, '/', 1)`,
        modelCount: sql<number>`COUNT(DISTINCT ${llmModelCatalog.modelName})::int`,
      })
      .from(llmModelCatalog)
      .where(
        and(
          eq(llmModelCatalog.isActive, true),
          // Filter out test models (provider names starting with "test-", "debug-", "dup-", "unique-")
          sql`SPLIT_PART(${llmModelCatalog.modelName}, '/', 1) NOT LIKE 'test-%'`,
          sql`SPLIT_PART(${llmModelCatalog.modelName}, '/', 1) NOT LIKE 'debug-%'`,
          sql`SPLIT_PART(${llmModelCatalog.modelName}, '/', 1) NOT LIKE 'dup-%'`,
          sql`SPLIT_PART(${llmModelCatalog.modelName}, '/', 1) NOT LIKE 'unique-%'`
        )
      )
      .groupBy(sql`SPLIT_PART(${llmModelCatalog.modelName}, '/', 1)`)
      .orderBy(sql`SPLIT_PART(${llmModelCatalog.modelName}, '/', 1)`);

    return providers;
  }

  /**
   * Get models accessible via a specific credential and provider
   * Returns full model details from catalog
   * Note: Queries catalog directly, configs are created on-demand when user sends message
   */
  static async getModelsByCredentialAndProvider(credentialId: string, provider: string) {
    // First verify the credential exists and is active
    const [credential] = await db
      .select({
        id: llmCredentials.id,
        provider: llmCredentials.provider
      })
      .from(llmCredentials)
      .where(and(eq(llmCredentials.id, credentialId), eq(llmCredentials.isActive, true)))
      .limit(1);

    if (!credential) {
      throw new Error('Credential not found');
    }

    // Query catalog directly - show ALL models for this provider
    // OpenRouter (openapi) can access all models, direct credentials access their own provider only
    const models = await db
      .select({
        id: llmModelCatalog.id,
        provider: llmModelCatalog.provider,
        modelName: llmModelCatalog.modelName,
        displayName: llmModelCatalog.displayName,
        inputCostPer1MTokens: llmModelCatalog.inputCostPer1MTokens,
        outputCostPer1MTokens: llmModelCatalog.outputCostPer1MTokens,
        contextWindow: llmModelCatalog.contextWindow,
        isActive: llmModelCatalog.isActive,
        metadata: llmModelCatalog.metadata,
      })
      .from(llmModelCatalog)
      .where(
        and(
          eq(llmModelCatalog.isActive, true),
          sql`SPLIT_PART(${llmModelCatalog.modelName}, '/', 1) = ${provider}`
        )
      )
      .orderBy(llmModelCatalog.displayName);

    return models;
  }
}
