/**
 * Platform AI Chat Service
 *
 * Provides AI text completion for Connect apps with per-org quota tracking.
 * Uses Google Gemini 3 Flash Preview for fast, cost-effective text generation.
 */

import { GoogleGenAI, createPartFromFunctionResponse, type Part, type FunctionDeclaration } from '@google/genai';
import { sql } from '../lib/db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CHAT_MODEL = 'gemini-3-flash-preview';

const genai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionParams {
  messages: ChatMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: Array<{ functionDeclarations: FunctionDeclaration[] }>;
  toolConfig?: { functionCallingConfig?: { mode?: string } };
}

export interface ChatContext {
  orgId: string;
  appId?: string;
}

export interface FunctionCallResult {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

export interface ChatCompletionResult {
  success: boolean;
  response?: string;
  functionCalls?: FunctionCallResult[];
  /** Raw model response parts — needed to preserve thought_signature for multi-turn */
  rawModelParts?: Part[];
  error?: string;
}

// ─── Chat Completion ────────────────────────────────────────────────────────

export async function chatComplete(
  params: ChatCompletionParams,
  context: ChatContext
): Promise<ChatCompletionResult> {
  if (!genai) {
    return {
      success: false,
      error: 'AI chat service not configured (GEMINI_API_KEY missing)',
    };
  }

  if (!params.messages?.length) {
    return { success: false, error: 'messages array is required' };
  }

  try {
    // Build contents array for Gemini
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of params.messages) {
      if (msg.role === 'system') continue; // handled via systemInstruction
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    const config: Record<string, unknown> = {
      systemInstruction: params.systemPrompt || undefined,
      maxOutputTokens: params.maxTokens || 2048,
      temperature: params.temperature ?? 0.8,
    };
    if (params.tools) config.tools = params.tools;
    if (params.toolConfig) config.toolConfig = params.toolConfig;

    const response = await genai.models.generateContent({
      model: CHAT_MODEL,
      contents,
      config,
    });

    // Check for function calls first
    if (response.functionCalls?.length) {
      const functionCalls: FunctionCallResult[] = [];
      for (const fc of response.functionCalls) {
        functionCalls.push({ id: fc.id, name: fc.name, args: fc.args as Record<string, unknown> });
      }
      // Preserve raw parts (includes thought_signature needed for multi-turn)
      const rawModelParts = response.candidates?.[0]?.content?.parts as Part[] | undefined;
      return { success: true, functionCalls, rawModelParts };
    }

    const responseText = response.text || '';

    if (!responseText) {
      return { success: false, error: 'Empty response from AI' };
    }

    // Log usage (fire and forget)
    logChatUsage(context, params.messages.length, responseText.length).catch(() => {});

    return {
      success: true,
      response: responseText,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

// ─── Multi-Turn (Function Call Continuation) ────────────────────────────────

export async function chatCompleteMultiTurn(
  params: ChatCompletionParams & {
    previousContents: Array<{ role: string; parts: Part[] }>;
    functionResults: Array<{ id: string; name: string; response: Record<string, unknown> }>;
  },
  context: ChatContext,
): Promise<ChatCompletionResult> {
  if (!genai) {
    return { success: false, error: 'AI chat service not configured (GEMINI_API_KEY missing)' };
  }

  try {
    // Build function response parts
    const functionResponseParts: Part[] = [];
    for (const fr of params.functionResults) {
      functionResponseParts.push(createPartFromFunctionResponse(fr.id, fr.name, fr.response));
    }

    // Append function responses to conversation
    const contents = [
      ...params.previousContents,
      { role: 'user', parts: functionResponseParts },
    ];

    const config: Record<string, unknown> = {
      systemInstruction: params.systemPrompt || undefined,
      maxOutputTokens: params.maxTokens || 2048,
      temperature: params.temperature ?? 0.8,
    };
    if (params.tools) config.tools = params.tools;
    if (params.toolConfig) config.toolConfig = params.toolConfig;

    const response = await genai.models.generateContent({
      model: CHAT_MODEL,
      contents,
      config,
    });

    // Check for more function calls
    if (response.functionCalls?.length) {
      const functionCalls: FunctionCallResult[] = [];
      for (const fc of response.functionCalls) {
        functionCalls.push({ id: fc.id, name: fc.name, args: fc.args as Record<string, unknown> });
      }
      const rawModelParts = response.candidates?.[0]?.content?.parts as Part[] | undefined;
      return { success: true, functionCalls, rawModelParts };
    }

    const responseText = response.text || '';
    if (!responseText) {
      return { success: false, error: 'Empty response from AI' };
    }

    logChatUsage(context, params.previousContents.length, responseText.length).catch(() => {});

    return { success: true, response: responseText };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

// ─── Usage Logging ──────────────────────────────────────────────────────────

async function logChatUsage(
  context: ChatContext,
  messageCount: number,
  responseLength: number
): Promise<void> {
  try {
    await sql`
      INSERT INTO ai_chat_logs (organization_id, app_id, model, message_count, response_length, created_at)
      VALUES (${context.orgId}, ${context.appId || null}, ${CHAT_MODEL}, ${messageCount}, ${responseLength}, now())
    `;
  } catch {
    // Non-fatal — table may not exist yet
  }
}
