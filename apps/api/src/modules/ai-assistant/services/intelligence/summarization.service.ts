/**
 * Summarization Service
 * Generates summaries and extracts keywords using workspace LLM configuration
 *
 * REFACTOR NOTE:
 * - Now uses workspace LLM config instead of hardcoded OPENAI_API_KEY
 * - Falls back to OpenRouter-compatible models (OpenAI, Anthropic, etc.)
 * - Uses chat completions API which OpenRouter supports
 */

import { ConfigService } from '../config.service';
import { OpenRouterService } from '../openrouter.service';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface ConversationSummaryResult {
  summary: string;
  topics: string[];
  keywords: string[];
  decisions: string[];
}

interface SummarizationConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export class SummarizationService {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_BASE = 1000; // ms

  /**
   * Get summarization config for workspace
   * Uses workspace LLM configuration
   */
  private static async getConfig(workspaceId: string): Promise<SummarizationConfig> {
    try {
      const config = await ConfigService.getOpenRouterConfig(workspaceId);
      return {
        apiKey: config.apiKey,
        model: config.model, // Use workspace model
        maxTokens: Math.min(config.maxTokens, 4096), // Reasonable max for summaries
        temperature: 0.3, // Low temperature for consistent summaries
      };
    } catch (error) {
      // Fallback to environment variable if workspace config fails
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
        console.log('[Summarization] Using OPENAI_API_KEY from environment');
        return {
          apiKey: process.env.OPENAI_API_KEY,
          model: 'gpt-4o-mini',
          maxTokens: 4096,
          temperature: 0.3,
        };
      }

      throw new Error(
        'Summarization not configured. Please configure an LLM in workspace settings or set OPENAI_API_KEY environment variable.'
      );
    }
  }

  /**
   * Summarize code snippet
   * Returns a concise summary of what the code does (not how)
   */
  static async summarizeCode(workspaceId: string, code: string, maxChars: number = 500): Promise<string> {
    if (!code || code.trim().length === 0) {
      throw new Error('Code cannot be empty');
    }

    const config = await this.getConfig(workspaceId);

    const systemPrompt = `You are a code summarization expert. Summarize code concisely focusing on WHAT it does, not HOW it does it. Be clear and specific. Maximum ${maxChars} characters.`;

    const userPrompt = `Summarize this code:\n\n${code.slice(0, 5000)}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await OpenRouterService.sendMessage({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          config: {
            apiKey: config.apiKey,
            model: config.model,
            maxTokens: Math.ceil(maxChars / 3), // rough token estimate (1 token ≈ 3 chars)
            temperature: config.temperature,
          },
          tools: [], // No tools for summarization
        });

        const summary = response.content?.trim() || '';

        // Log token usage
        console.log(`[Summarization] Code summary: ${response.tokenUsage.total} tokens (workspace: ${workspaceId})`);

        // Truncate to max chars if needed
        return summary.slice(0, maxChars);
      } catch (error: any) {
        lastError = error;

        console.error(`[Summarization] Code summary attempt ${attempt}/${this.MAX_RETRIES} failed:`, error.message);

        // Don't retry on certain errors
        if (error.message.includes('authentication') || error.message.includes('401') || error.message.includes('403')) {
          throw new Error(`Summarization API error: ${error.message}`);
        }

        // Exponential backoff for retries
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Failed to summarize code after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  /**
   * Summarize conversation
   * Returns summary with topics, decisions, and keywords extracted
   */
  static async summarizeConversation(
    workspaceId: string,
    messages: Message[],
    maxChars: number = 1000
  ): Promise<ConversationSummaryResult> {
    if (!messages || messages.length === 0) {
      throw new Error('Messages cannot be empty');
    }

    const config = await this.getConfig(workspaceId);

    // Format messages for summarization
    const conversationText = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n')
      .slice(0, 20000); // Limit to ~5k tokens

    const systemPrompt = `You are a conversation summarization expert. Analyze the conversation and provide:
1. A concise summary (${maxChars} chars max)
2. Main topics discussed (3-5 topics)
3. Key decisions made
4. Important keywords for search (5-10 keywords)

Respond in JSON format:
{
  "summary": "...",
  "topics": ["topic1", "topic2", ...],
  "decisions": ["decision1", "decision2", ...],
  "keywords": ["keyword1", "keyword2", ...]
}`;

    const userPrompt = `Summarize this conversation:\n\n${conversationText}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await OpenRouterService.sendMessage({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          config: {
            apiKey: config.apiKey,
            model: config.model,
            maxTokens: Math.ceil(maxChars / 2), // More generous for structured output
            temperature: config.temperature,
          },
          tools: [], // No tools for summarization
        });

        const content = response.content?.trim() || '{}';

        // Log token usage
        console.log(`[Summarization] Conversation summary: ${response.tokenUsage.total} tokens (workspace: ${workspaceId})`);

        // Parse JSON response
        const result = JSON.parse(content);

        // Validate and normalize result
        return {
          summary: (result.summary || '').slice(0, maxChars),
          topics: Array.isArray(result.topics) ? result.topics.slice(0, 5) : [],
          keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 10) : [],
          decisions: Array.isArray(result.decisions) ? result.decisions : [],
        };
      } catch (error: any) {
        lastError = error;

        console.error(`[Summarization] Conversation summary attempt ${attempt}/${this.MAX_RETRIES} failed:`, error.message);

        // Don't retry on certain errors
        if (error.message.includes('authentication') || error.message.includes('401') || error.message.includes('403')) {
          throw new Error(`Summarization API error: ${error.message}`);
        }

        // Exponential backoff for retries
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Failed to summarize conversation after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  /**
   * Extract keywords from text
   * Returns 5-10 most relevant keywords for search
   */
  static async extractKeywords(workspaceId: string, text: string, maxKeywords: number = 10): Promise<string[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const config = await this.getConfig(workspaceId);

    const systemPrompt = `You are a keyword extraction expert. Extract the ${maxKeywords} most important keywords from the text for search purposes. Return only the keywords as a JSON array of strings.`;

    const userPrompt = `Extract keywords from:\n\n${text.slice(0, 10000)}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await OpenRouterService.sendMessage({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          config: {
            apiKey: config.apiKey,
            model: config.model,
            maxTokens: 200,
            temperature: config.temperature,
          },
          tools: [], // No tools for keyword extraction
        });

        const content = response.content?.trim() || '{}';

        // Log token usage
        console.log(`[Summarization] Keyword extraction: ${response.tokenUsage.total} tokens (workspace: ${workspaceId})`);

        // Parse JSON response
        const result = JSON.parse(content);

        // Extract keywords array (handle different possible formats)
        let keywords: string[] = [];
        if (Array.isArray(result.keywords)) {
          keywords = result.keywords;
        } else if (Array.isArray(result)) {
          keywords = result;
        } else {
          // Fallback: extract any array from the object
          const values = Object.values(result);
          const firstArray = values.find(v => Array.isArray(v));
          if (firstArray) {
            keywords = firstArray as string[];
          }
        }

        return keywords.slice(0, maxKeywords);
      } catch (error: any) {
        lastError = error;

        console.error(`[Summarization] Keyword extraction attempt ${attempt}/${this.MAX_RETRIES} failed:`, error.message);

        // Don't retry on certain errors
        if (error.message.includes('authentication') || error.message.includes('401') || error.message.includes('403')) {
          throw new Error(`Summarization API error: ${error.message}`);
        }

        // Exponential backoff for retries
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Failed to extract keywords after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if summarization is configured for a workspace
   * Non-throwing version for feature availability checks
   */
  static async isConfigured(workspaceId: string): Promise<boolean> {
    try {
      await this.getConfig(workspaceId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get model configuration for a workspace
   */
  static async getModelConfig(workspaceId: string) {
    const config = await this.getConfig(workspaceId);
    return {
      model: config.model,
      // Cost will vary by model - these are estimates
      inputCostPer1MTokens: 0.15,
      outputCostPer1MTokens: 0.60,
    };
  }
}
