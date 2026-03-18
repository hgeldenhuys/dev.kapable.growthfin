/**
 * LLM Service Abstraction
 * Multi-provider support for OpenAI, Anthropic, and Together
 *
 * NOTE: API keys are fetched from llm_credentials table (encrypted)
 * and decrypted at runtime. No API keys in environment variables!
 */

import { db } from '@agios/db/client';
import { llmConfigs, llmCredentials, type LLMProvider } from '@agios/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { decryptApiKey } from './crypto';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class LLMService {
  /**
   * Get an active LLM config by name with decrypted credentials
   * Prioritizes project-specific configs, falls back to global configs
   */
  async getConfig(name: string, projectId?: string) {
    // Use manual SELECT with JOIN to avoid Drizzle relations issues
    // First try project-specific config if projectId provided
    let result;
    if (projectId) {
      result = await db
        .select({
          config: llmConfigs,
          credential: llmCredentials,
        })
        .from(llmConfigs)
        .innerJoin(llmCredentials, eq(llmConfigs.credentialId, llmCredentials.id))
        .where(
          and(
            eq(llmConfigs.name, name),
            eq(llmConfigs.isActive, true),
            eq(llmConfigs.projectId, projectId)
          )
        )
        .limit(1);
    }

    // If no project-specific config found, try global config
    if ((!result || result.length === 0)) {
      result = await db
        .select({
          config: llmConfigs,
          credential: llmCredentials,
        })
        .from(llmConfigs)
        .innerJoin(llmCredentials, eq(llmConfigs.credentialId, llmCredentials.id))
        .where(
          and(
            eq(llmConfigs.name, name),
            eq(llmConfigs.isActive, true),
            isNull(llmConfigs.projectId)  // Use isNull() instead of eq(..., null)
          )
        )
        .limit(1);
    }

    if (!result || result.length === 0) {
      throw new Error(`No active LLM config found for: ${name}`);
    }

    const { config, credential } = result[0];

    if (!credential) {
      throw new Error(`No credential found for LLM config: ${name}`);
    }

    if (!credential.isActive) {
      throw new Error(`Credential for LLM config '${name}' is inactive`);
    }

    // Decrypt API key
    const apiKey = decryptApiKey(credential.apiKeyEncrypted);

    return {
      ...config,
      credential,
      apiKey, // Add decrypted API key to config
    };
  }

  /**
   * Generate a completion using the specified config
   */
  async complete(configName: string, messages: LLMMessage[], projectId?: string): Promise<LLMResponse> {
    const config = await this.getConfig(configName, projectId);

    // Add system prompt as first message
    const allMessages: LLMMessage[] = [
      { role: 'system', content: config.systemPrompt },
      ...messages,
    ];

    switch (config.provider) {
      case 'openai':
        return this.completeOpenAI(config, allMessages);
      case 'anthropic':
        return this.completeAnthropic(config, allMessages);
      case 'together':
        return this.completeTogether(config, allMessages);
      case 'openapi':
        return this.completeGenericOpenAPI(config, allMessages);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * OpenAI completion
   */
  private async completeOpenAI(config: any, messages: LLMMessage[]): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error('API key not found in config');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature / 100, // Convert from 0-100 to 0-1
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      model: config.model,
      provider: 'openai',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  /**
   * Anthropic completion
   */
  private async completeAnthropic(config: any, messages: LLMMessage[]): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error('API key not found in config');
    }

    // Separate system message from conversation
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        system: systemMessage?.content,
        messages: conversationMessages,
        temperature: config.temperature / 100,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      model: config.model,
      provider: 'anthropic',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  /**
   * Together AI completion
   */
  private async completeTogether(config: any, messages: LLMMessage[]): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error('API key not found in config');
    }

    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature / 100,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Together API error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      model: config.model,
      provider: 'together',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  /**
   * Generic OpenAPI-compatible completion
   * Supports any provider with OpenAI-compatible chat completions API
   * (e.g., Groq, Mistral, local models, etc.)
   */
  private async completeGenericOpenAPI(config: any, messages: LLMMessage[]): Promise<LLMResponse> {
    if (!config.apiKey) {
      throw new Error('API key not found in config');
    }

    if (!config.apiUrl) {
      throw new Error('API URL required for generic OpenAPI provider');
    }

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature / 100,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAPI provider error: ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      model: config.model,
      provider: 'openapi',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Generate a streaming completion using the specified config
   * Returns an async generator that yields content chunks
   */
  async *completeStream(
    configName: string,
    messages: LLMMessage[],
    projectId?: string,
    options?: {
      extendedThinking?: boolean;
    }
  ): AsyncGenerator<string, void, unknown> {
    const config = await this.getConfig(configName, projectId);

    // Add system prompt as first message
    const allMessages: LLMMessage[] = [
      { role: 'system', content: config.systemPrompt },
      ...messages,
    ];

    switch (config.provider) {
      case 'openai':
        yield* this.streamOpenAI(config, allMessages, options);
        break;
      case 'anthropic':
        yield* this.streamAnthropic(config, allMessages, options);
        break;
      case 'together':
        yield* this.streamTogether(config, allMessages, options);
        break;
      case 'openapi':
        yield* this.streamGenericOpenAPI(config, allMessages, options);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * OpenAI streaming (OpenAI-compatible API format)
   */
  private async *streamOpenAI(config: any, messages: LLMMessage[], options?: { extendedThinking?: boolean }): AsyncGenerator<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature / 100,
        max_tokens: config.maxTokens,
        stream: true,
        ...(options?.extendedThinking && { extended_thinking: true }),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Anthropic streaming
   */
  private async *streamAnthropic(config: any, messages: LLMMessage[], options?: { extendedThinking?: boolean }): AsyncGenerator<string> {
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        system: systemMessage?.content,
        messages: conversationMessages,
        temperature: config.temperature / 100,
        max_tokens: config.maxTokens,
        stream: true,
        ...(options?.extendedThinking && { extended_thinking: true }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          try {
            const json = JSON.parse(data);
            if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
              yield json.delta.text;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Together AI streaming (OpenAI-compatible)
   */
  private async *streamTogether(config: any, messages: LLMMessage[], options?: { extendedThinking?: boolean }): AsyncGenerator<string> {
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature / 100,
        max_tokens: config.maxTokens,
        stream: true,
        ...(options?.extendedThinking && { extended_thinking: true }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Together API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Generic OpenAPI streaming (OpenRouter, etc.)
   */
  private async *streamGenericOpenAPI(config: any, messages: LLMMessage[], options?: { extendedThinking?: boolean }): AsyncGenerator<string> {
    const apiUrl = config.apiUrl || 'https://api.openai.com/v1/chat/completions';

    const requestBody = {
      model: config.model,
      messages,
      temperature: config.temperature / 100,
      max_tokens: config.maxTokens,
      stream: true,
      ...(options?.extendedThinking && { extended_thinking: true }),
    };

    // Log when extended thinking is enabled
    if (options?.extendedThinking) {
      console.log('[LLM] Extended thinking mode enabled for request:', {
        model: config.model,
        extended_thinking: true,
      });
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'https://agios.ai', // Required by OpenRouter
        'X-Title': 'NewLeads Chat', // Required by OpenRouter
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${apiUrl}): ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;

          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

export const llmService = new LLMService();
