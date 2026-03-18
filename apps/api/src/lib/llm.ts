/**
 * LLM Service — Kapable Gateway Client
 *
 * Routes all LLM calls through the Kapable LLM Gateway (/v1/llm/completions).
 * Presets (named configs) are managed in the Kapable Console, not locally.
 *
 * Replaces the previous multi-provider LLMService that managed its own
 * credentials, configs, and provider dispatch.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const GATEWAY_URL = process.env["KAPABLE_CHANNEL_URL"] || 'https://api.kapable.dev';
const GATEWAY_KEY = process.env["KAPABLE_CHANNEL_KEY"] || '';

class LLMService {
  /**
   * Generate a completion using a named preset.
   *
   * The preset name maps to an llm_presets record in the Kapable platform.
   * System prompt, model, temperature, etc. are all configured there.
   */
  async complete(configName: string, messages: LLMMessage[], projectId?: string): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      preset: configName,
      messages,
    };
    if (projectId) {
      body.project_id = projectId;
    }

    const response = await fetch(`${GATEWAY_URL}/v1/llm/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': GATEWAY_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM Gateway error (${response.status}): ${error}`);
    }

    const data = await response.json() as {
      content: string;
      model: string;
      provider: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content,
      model: data.model,
      provider: data.provider,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  /**
   * Generate a streaming completion using a named preset.
   * Returns an async generator that yields content chunks.
   */
  async *completeStream(
    configName: string,
    messages: LLMMessage[],
    projectId?: string,
    _options?: {
      extendedThinking?: boolean;
    }
  ): AsyncGenerator<string, void, unknown> {
    const body: Record<string, unknown> = {
      preset: configName,
      messages,
      stream: true,
    };
    if (projectId) {
      body.project_id = projectId;
    }

    const response = await fetch(`${GATEWAY_URL}/v1/llm/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': GATEWAY_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM Gateway streaming error (${response.status}): ${error}`);
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
            const content = json.delta;
            if (content) yield content;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Get config metadata (for tracking purposes).
   * Returns a minimal config object — the actual config lives in the platform.
   */
  async getConfig(name: string, _projectId?: string) {
    return { id: name, name, model: 'platform-managed', provider: 'kapable-gateway' };
  }
}

export const llmService = new LLMService();
