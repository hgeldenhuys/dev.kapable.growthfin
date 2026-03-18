/**
 * AI Configuration Service
 * Manage workspace AI configuration (model, API keys, etc.)
 */

import { db } from '@agios/db/client';
import { aiConfig, type AiConfig, llmConfigs } from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { encryptApiKey, decryptApiKey } from '../../../lib/crypto';

export interface ConfigUpdate {
  llmConfigId?: string | null; // Reference to existing LLM config
  model?: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
}

export interface ConfigResponse {
  llmConfigId: string | null;
  llmConfigName?: string; // Name of the LLM config if using one
  model: string;
  maxTokens: number;
  temperature: number;
  hasApiKey: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ConfigService {
  /**
   * Get AI configuration for workspace
   * Creates default config if none exists
   */
  static async getConfig(workspaceId: string): Promise<ConfigResponse> {
    const config = await db.query.aiConfig.findFirst({
      where: eq(aiConfig.workspaceId, workspaceId),
      with: {
        llmConfig: {
          with: {
            credential: true,
          },
        },
      },
    });

    // Create default config if none exists
    if (!config) {
      const newConfig = await this.createDefaultConfig(workspaceId);
      return {
        llmConfigId: null,
        model: newConfig.model,
        maxTokens: newConfig.maxTokens || 4096,
        temperature: parseFloat(newConfig.temperature || '0.7'),
        hasApiKey: !!newConfig.apiKeyEncrypted,
        createdAt: newConfig.createdAt,
        updatedAt: newConfig.updatedAt,
      };
    }

    // If using LLM config, return its settings
    if (config.llmConfig) {
      return {
        llmConfigId: config.llmConfig.id,
        llmConfigName: config.llmConfig.name,
        model: config.llmConfig.model,
        maxTokens: config.llmConfig.maxTokens,
        temperature: config.llmConfig.temperature / 100, // Convert from int (0-100) to decimal
        hasApiKey: !!config.llmConfig.credential?.apiKeyEncrypted,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    }

    // Fall back to direct config (legacy mode)
    return {
      llmConfigId: null,
      model: config.model,
      maxTokens: config.maxTokens || 4096,
      temperature: parseFloat(config.temperature || '0.7'),
      hasApiKey: !!config.apiKeyEncrypted,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Update AI configuration for workspace
   */
  static async updateConfig(
    workspaceId: string,
    updates: ConfigUpdate
  ): Promise<ConfigResponse> {
    // Get existing config or create default
    let config = await db.query.aiConfig.findFirst({
      where: eq(aiConfig.workspaceId, workspaceId),
    });

    if (!config) {
      config = await this.createDefaultConfig(workspaceId);
    }

    // Prepare update values
    const updateValues: any = {
      updatedAt: new Date(),
    };

    // If llmConfigId is provided, use LLM config mode
    if (updates.llmConfigId !== undefined) {
      updateValues.llmConfigId = updates.llmConfigId;

      // When switching to LLM config mode, clear direct config fields
      if (updates.llmConfigId) {
        // Keep legacy fields for backwards compatibility but they won't be used
      }
    } else {
      // Direct config mode (legacy)
      if (updates.model !== undefined) {
        updateValues.model = updates.model;
      }

      if (updates.maxTokens !== undefined) {
        updateValues.maxTokens = updates.maxTokens;
      }

      if (updates.temperature !== undefined) {
        updateValues.temperature = updates.temperature.toString();
      }

      if (updates.apiKey !== undefined) {
        // Encrypt the API key
        updateValues.apiKeyEncrypted = encryptApiKey(updates.apiKey);
      }
    }

    // Update config
    await db
      .update(aiConfig)
      .set(updateValues)
      .where(eq(aiConfig.id, config.id));

    // Return updated config
    return this.getConfig(workspaceId);
  }

  /**
   * Get decrypted API key for use in OpenRouter calls
   * NEVER expose this in API responses!
   */
  static async getApiKey(workspaceId: string): Promise<string | null> {
    const [config] = await db
      .select()
      .from(aiConfig)
      .where(eq(aiConfig.workspaceId, workspaceId))
      .limit(1);

    if (!config || !config.apiKeyEncrypted) {
      return null;
    }

    try {
      return decryptApiKey(config.apiKeyEncrypted);
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Get full config for OpenRouter
   * Includes decrypted API key
   */
  static async getOpenRouterConfig(workspaceId: string): Promise<{
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  }> {
    const config = await db.query.aiConfig.findFirst({
      where: eq(aiConfig.workspaceId, workspaceId),
      with: {
        llmConfig: {
          with: {
            credential: true,
          },
        },
      },
    });

    if (!config) {
      throw new Error('AI configuration not found for this workspace');
    }

    // If using LLM config (preferred)
    if (config.llmConfig) {
      if (!config.llmConfig.credential?.apiKeyEncrypted) {
        throw new Error(
          `LLM config "${config.llmConfig.name}" does not have an API key. Please configure credentials.`
        );
      }

      const apiKey = decryptApiKey(config.llmConfig.credential.apiKeyEncrypted);

      return {
        apiKey,
        model: config.llmConfig.model,
        maxTokens: config.llmConfig.maxTokens,
        temperature: config.llmConfig.temperature / 100, // Convert from int (0-100) to decimal
      };
    }

    // Fall back to direct config (legacy)
    if (!config.apiKeyEncrypted) {
      throw new Error('API key not configured. Please configure an OpenRouter API key in workspace settings.');
    }

    const apiKey = decryptApiKey(config.apiKeyEncrypted);

    return {
      apiKey,
      model: config.model,
      maxTokens: config.maxTokens || 4096,
      temperature: parseFloat(config.temperature || '0.7'),
    };
  }

  /**
   * Create default configuration for workspace
   */
  private static async createDefaultConfig(workspaceId: string): Promise<AiConfig> {
    const [config] = await db
      .insert(aiConfig)
      .values({
        workspaceId,
        model: 'anthropic/claude-3.5-haiku',
        maxTokens: 4096,
        temperature: '0.70',
        apiKeyEncrypted: null,
      })
      .returning();

    return config;
  }
}
