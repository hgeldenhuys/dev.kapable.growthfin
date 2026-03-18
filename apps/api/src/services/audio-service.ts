/**
 * Audio Service
 * Handles audio generation, caching, and voice selection
 */

import { db } from '@agios/db/client';

/**
 * Forbidden phrases that indicate LLM produced invalid audio text
 */
const FORBIDDEN_PHRASES = [
  "I'm ready to help",
  'Please provide',
  'I need more context',
  'Could you clarify',
  'I appreciate',
  "I don't have access",
  'I need to clarify my role',
  "I'm the audio summarization",
  'What would you like',
];

/**
 * Validate that audio text doesn't contain meta-commentary or complaints
 */
function validateAudioText(text: string): boolean {
  const lowerText = text.toLowerCase();
  return !FORBIDDEN_PHRASES.some((phrase) => lowerText.includes(phrase.toLowerCase()));
}
import {
  audioCache,
  globalVoiceSettings,
  projectVoiceSettings,
  type HookEventName,
} from '@agios/db/schema';
import { eq } from 'drizzle-orm';
import { jobQueue } from '../lib/queue';
import { llmService } from '../lib/llm';

export interface AudioStatus {
  status: 'ready' | 'generating';
  url?: string;
  jobId?: string | null;
}

/**
 * Audio cache version
 * Increment this when changing text preparation logic to invalidate old cache
 * v1: No LLM preparation (raw markdown)
 * v2: LLM preparation with markdown stripping
 */
const AUDIO_CACHE_VERSION = 'v2';

/**
 * Context usage constants
 */
const CONTEXT_LIMIT = 200000;
const CONTEXT_PHRASES = {
  JUST_STARTED: "Just getting started with context",
  SMALL_PORTION: "Using a small portion of context",
  THIRD: "Using about a third of my context",
  HALF: "Using about half of my context",
  MOST: "Using most of my context",
  CLOSE_TO_LIMIT: "Getting close to the context limit",
  NEARLY_AT_LIMIT: "Nearly at the context limit",
  AT_LIMIT: "At the context limit - time to start fresh"
};

class AudioService {
  /**
   * Get audio for hook event
   * Returns cached MP3 if available, otherwise queues generation job
   */
  async getAudio(hookEventId: string, voiceId?: string): Promise<AudioStatus> {
    // 1. Determine voice (voiceId param > project settings > global settings)
    const finalVoiceId = voiceId || (await this.getVoiceForEvent(hookEventId));

    // 2. Check cache by (hook_event_id, voice_id) composite key
    const cached = await db.query.audioCache.findFirst({
      where: (audioCache, { and, eq }) =>
        and(
          eq(audioCache.hookEventId, hookEventId),
          eq(audioCache.voiceId, finalVoiceId)
        ),
    });

    if (cached) {
      return { status: 'ready', url: cached.url };
    }

    // 3. Prepare text and determine role
    const { text, role } = await this.prepareTextForSpeech(hookEventId);

    // 4. Queue generation job (singletonKey prevents duplicate jobs)
    const jobId = await jobQueue.send(
      'generate-audio',
      {
        hookEventId,
        voiceId: finalVoiceId,
        text,
        role,
      },
      {
        singletonKey: `audio-${hookEventId}`, // One job per hook event
      }
    );

    return { status: 'generating', jobId };
  }

  /**
   * Get voice ID for event based on role and project settings
   * Priority: project settings > global settings
   */
  private async getVoiceForEvent(hookEventId: string): Promise<string> {
    // 1. Get event to determine project and role
    const event = await db.query.hookEvents.findFirst({
      where: (hookEvents, { eq }) => eq(hookEvents.id, hookEventId),
    });

    if (!event) {
      throw new Error(`Hook event not found: ${hookEventId}`);
    }

    const role = this.getRoleForEventName(event.eventName as HookEventName);

    // 2. Try project voice settings first
    if (event.projectId) {
      const projectSettings = await db.query.projectVoiceSettings.findFirst({
        where: (projectVoiceSettings, { eq }) => eq(projectVoiceSettings.projectId, event.projectId),
      });

      if (projectSettings) {
        const voiceId = role === 'user' ? projectSettings.userVoiceId : projectSettings.assistantVoiceId;
        if (voiceId) {
          return voiceId;
        }
      }
    }

    // 3. Fall back to global settings
    const globalSettings = await db.query.globalVoiceSettings.findFirst();

    if (!globalSettings) {
      throw new Error('No voice settings configured (global or project)');
    }

    return role === 'user' ? globalSettings.userVoiceId : globalSettings.assistantVoiceId;
  }

  /**
   * Determine role based on event name
   */
  private getRoleForEventName(eventName: HookEventName): 'user' | 'assistant' {
    switch (eventName) {
      case 'UserPromptSubmit':
        return 'user';
      case 'Stop':
      case 'SubagentStop':
        return 'assistant';
      default:
        return 'assistant';
    }
  }

  /**
   * Prepare text for speech
   * - User prompts: Return verbatim (preserve natural human speech)
   * - Assistant responses: Use LLM summarization to remove stacktraces/URLs
   */
  async prepareTextForSpeech(hookEventId: string): Promise<{ text: string; role: 'user' | 'assistant' }> {
    const event = await db.query.hookEvents.findFirst({
      where: (hookEvents, { eq }) => eq(hookEvents.id, hookEventId),
    });

    if (!event) {
      throw new Error(`Hook event not found: ${hookEventId}`);
    }

    // Extract raw text based on event type
    let rawText = '';
    const role = this.getRoleForEventName(event.eventName as HookEventName);
    const payload = event.payload as any;

    switch (event.eventName as HookEventName) {
      case 'UserPromptSubmit':
        rawText = payload?.event?.prompt || '';
        break;

      case 'Stop':
      case 'SubagentStop':
        // Include user prompt for context
        const userPrompt = await this.getUserPromptForContext(event.sessionId);
        const aiResponse =
          payload?.conversation?.message?.content
            ?.filter((c: any) => c.type === 'text')
            ?.map((c: any) => c.text)
            ?.join('\n') || '';

        // If no text content, this may be a thinking-only response (user interrupted mid-thought)
        // In this case, skip audio generation gracefully
        if (!aiResponse && !userPrompt) {
          const hasThinking = payload?.conversation?.message?.content?.some((c: any) => c.type === 'thinking');
          if (hasThinking) {
            console.log(`⏭️ Skipping audio for event ${hookEventId}: thinking-only response (no text output)`);
            throw new Error(`SKIP_AUDIO: Event ${hookEventId} has thinking but no text content`);
          }
        }

        rawText = userPrompt ? `User asked: ${userPrompt}\n\nAssistant replied: ${aiResponse}` : aiResponse;
        break;

      default:
        throw new Error(`Unsupported event type for audio: ${event.eventName}`);
    }

    if (!rawText || rawText.trim().length === 0) {
      throw new Error(`No text content found for event ${hookEventId}`);
    }

    // Use LLM to intelligently prepare text for audio
    // - User prompts: Use 'audio-summarizer-user' (preserve natural speech, clean technical noise)
    // - Assistant responses: Use 'audio-summarizer-assistant' (summarize aggressively)
    const llmConfigName = role === 'user' ? 'audio-summarizer-user' : 'audio-summarizer-assistant';

    console.log(`🎙️ Preparing text for audio (${role}):`);
    console.log(`   Event: ${hookEventId}`);
    console.log(`   LLM Config: ${llmConfigName}`);
    console.log(`   Raw text length: ${rawText.length} chars`);
    console.log(`   Raw text preview: "${rawText.substring(0, 150)}..."`);

    try {
      console.log(`   🤖 Calling LLM service...`);
      const response = await llmService.complete(
        llmConfigName,
        [
          {
            role: 'user',
            content: rawText,
          },
        ],
        event.projectId
      );

      console.log(`   ✅ LLM response length: ${response.content.length} chars`);
      console.log(`   ✅ LLM response: "${response.content.substring(0, 150)}..."`);

      // Validate response doesn't contain forbidden phrases
      if (!validateAudioText(response.content)) {
        console.warn(`   ⚠️  LLM produced invalid audio text (contains forbidden phrases), using fallback`);
        const truncated = rawText.substring(0, 500);

        // Append context usage even when using forbidden phrase fallback
        const textWithContext = await this.appendContextUsage(truncated, event);

        return { text: textWithContext, role };
      }

      // Append context usage for Stop events
      const textWithContext = await this.appendContextUsage(response.content.trim(), event);

      return {
        text: textWithContext,
        role,
      };
    } catch (error) {
      console.error(`❌ Failed to summarize for audio generation (${llmConfigName}):`, error);
      console.error(`   Using fallback: truncated raw text`);
      // Fallback: use raw text truncated to reasonable length
      const truncated = rawText.substring(0, 1000);
      console.log(`   Fallback text length: ${truncated.length} chars`);

      // Append context usage even on fallback path
      const textWithContext = await this.appendContextUsage(truncated, event);

      return { text: textWithContext, role };
    }
  }

  /**
   * Get user prompt from the same session for context
   */
  private async getUserPromptForContext(sessionId: string): Promise<string | null> {
    const userPromptEvent = await db.query.hookEvents.findFirst({
      where: (hookEvents, { eq }) => eq(hookEvents.sessionId, sessionId),
      orderBy: (events, { desc }) => [desc(events.createdAt)],
    });

    if (!userPromptEvent) {
      return null;
    }

    const payload = userPromptEvent.payload as any;
    return payload?.event?.prompt || null;
  }

  /**
   * Get context usage phrase based on percentage
   * Maps percentage ranges to natural language phrases
   */
  private getContextPhrase(percentage: number): string | null {
    if (percentage < 0) {
      return null;
    }
    if (percentage < 10) {
      return CONTEXT_PHRASES.JUST_STARTED;
    }
    if (percentage < 25) {
      return CONTEXT_PHRASES.SMALL_PORTION;
    }
    if (percentage < 40) {
      return CONTEXT_PHRASES.THIRD;
    }
    if (percentage < 60) {
      return CONTEXT_PHRASES.HALF;
    }
    if (percentage < 75) {
      return CONTEXT_PHRASES.MOST;
    }
    if (percentage < 85) {
      return CONTEXT_PHRASES.CLOSE_TO_LIMIT;
    }
    if (percentage < 95) {
      return CONTEXT_PHRASES.NEARLY_AT_LIMIT;
    }
    return CONTEXT_PHRASES.AT_LIMIT;
  }

  /**
   * Get project name for event
   * Returns project name or fallback to workspace name
   */
  private async getProjectName(projectId: string | null): Promise<string | null> {
    if (!projectId) {
      return null;
    }

    try {
      const project = await db.query.projects.findFirst({
        where: (projects, { eq }) => eq(projects.id, projectId),
      });

      return project?.name || null;
    } catch (error) {
      console.warn(`Failed to fetch project name for ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Append context usage information to text
   * Only for Stop events with valid usage data
   * Includes project name for context
   */
  private async appendContextUsage(text: string, event: any): Promise<string> {
    // Only process Stop events
    if (event.eventName !== 'Stop') {
      return text;
    }

    // Extract usage data
    const usage = event.payload?.conversation?.message?.usage;
    if (!usage) {
      return text;
    }

    // Calculate total tokens
    const totalTokens =
      (usage.input_tokens || 0) +
      (usage.cache_read_input_tokens || 0) +
      (usage.cache_creation_input_tokens || 0) +
      (usage.output_tokens || 0);

    // Handle invalid data
    if (totalTokens <= 0 || isNaN(totalTokens)) {
      return text;
    }

    // Calculate percentage
    const percentage = (totalTokens / CONTEXT_LIMIT) * 100;

    // Get phrase
    const phrase = this.getContextPhrase(percentage);
    if (!phrase) {
      return text;
    }

    // Get project name - try both camelCase and snake_case for safety
    const projectId = event.projectId || (event as any).project_id;
    const projectName = await this.getProjectName(projectId);

    // Remove trailing period from text to avoid double periods
    const cleanText = text.trim().replace(/\.$/, '');

    // Append to text with project name if available
    if (projectName) {
      return `${cleanText}. ${projectName} - ${phrase}.`;
    }

    // Fallback to just context phrase if no project name
    return `${cleanText}. ${phrase}.`;
  }
}

export const audioService = new AudioService();
