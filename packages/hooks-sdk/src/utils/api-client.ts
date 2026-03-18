/**
 * API Client Utility
 * Sends hook events to the Agios API
 */

import type { AnyHookInput } from '../types';
import type { ConversationLine } from '@agios/transcript-types';
import { getCurrentTags } from './tags';

export interface HookEventPayload {
  projectId: string;
  sessionId: string;
  eventName: string;
  toolName?: string;
  tags?: string[]; // AC-006: Tags automatically included in all events
  payload: {
    event: AnyHookInput;
    conversation: ConversationLine | null;
    timestamp: string;
  };
}

export interface ApiClientOptions {
  apiUrl: string;
  accessToken: string;
  timeout?: number; // Default: 2000ms (2 seconds)
}

export interface ApiResponse {
  success: boolean;
  error?: string;
}

/**
 * Send a hook event to the API
 * Non-blocking with short timeout to avoid impeding Claude
 */
export async function sendHookEvent(
  payload: HookEventPayload,
  options: ApiClientOptions
): Promise<ApiResponse> {
  const timeout = options.timeout || 2000; // Default 2s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${options.apiUrl}/api/v1/hook-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.accessToken}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    return { success: true };
  } catch (error) {
    clearTimeout(timeoutId);

    // Timeout or network error
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `Request timeout after ${timeout}ms`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: 'Unknown error',
    };
  }
}

/**
 * Build a hook event payload
 * AC-001, AC-006, AC-007: Automatically reads tags from .claude/current-tags.json
 * and includes them in the payload without requiring caller code changes
 */
export function buildHookEventPayload(
  projectId: string,
  event: AnyHookInput,
  conversation: ConversationLine | null
): HookEventPayload {
  // AC-001: Read tags on each event creation
  const tags = getCurrentTags();

  return {
    projectId,
    sessionId: event.session_id,
    eventName: event.hook_event_name,
    toolName: 'tool_name' in event ? event.tool_name : undefined,
    tags, // AC-006: All events automatically include current tags
    payload: {
      event,
      conversation,
      timestamp: new Date().toISOString(),
    },
  };
}
