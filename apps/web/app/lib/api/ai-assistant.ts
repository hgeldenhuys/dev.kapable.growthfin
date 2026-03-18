/**
 * AI Assistant API Client
 * Functions for managing AI chat conversations
 */

// Client-side: use relative URLs to go through the web server proxy
// Server-side: use the API_URL env var for direct backend access
const API_BASE = typeof window !== 'undefined'
  ? ''  // Client-side: relative URL, proxied via /api/v1/*
  : (process.env.API_URL || 'http://localhost:3000');

export interface AIMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  context: any;
  createdAt: string;
  updatedAt: string;
}

export interface AIConversation {
  id: string;
  workspaceId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messages: AIMessage[];
}

export interface SendMessageRequest {
  message: string;
  context?: any;
}

export interface DriverAction {
  type: 'highlight' | 'tour';
  selector?: string;
  title?: string;
  body?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  steps?: Array<{ selector: string; title: string; body: string; position?: string }>;
}

export interface SendMessageResponse {
  success: boolean;
  conversation: AIConversation;
  message: AIMessage;
  response: AIMessage;
  driver_actions?: DriverAction[];
}

/**
 * Fetch conversation with messages for a workspace and user
 * Returns null if no active conversation exists (404)
 */
export async function fetchConversation(
  workspaceId: string,
  userId: string
): Promise<AIConversation | null> {
  const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/chat/conversation?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    credentials: 'include',
  });

  // 404 means no active conversation - this is OK, return null
  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch conversation: ${error}`);
  }

  const data = await res.json();
  // API returns conversation object directly, not wrapped
  return data || null;
}

/**
 * Send a message to the AI Assistant
 */
export async function sendAIMessage(
  workspaceId: string,
  userId: string,
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/chat/message`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      message: request.message,
      context: {
        userId,
        ...request.context,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send message: ${error}`);
  }

  return res.json();
}

/**
 * Clear conversation for a workspace and user
 */
export async function clearAIConversation(
  workspaceId: string,
  userId: string
): Promise<{ success: boolean }> {
  const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/chat/clear?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to clear conversation: ${error}`);
  }

  return res.json();
}

/**
 * Get AI config for a workspace
 */
export async function fetchAIConfig(workspaceId: string): Promise<any> {
  const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/config`;
  const res = await fetch(url, {
    credentials: 'include',
  });

  // 404 means no active conversation - this is OK, return null
  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch AI config: ${error}`);
  }

  return res.json();
}

/**
 * Update AI config for a workspace
 */
export async function updateAIConfig(
  workspaceId: string,
  config: any
): Promise<any> {
  const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/config`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update AI config: ${error}`);
  }

  return res.json();
}

/**
 * Voice Message Types
 */

export interface VoiceMessageResponse {
  success: boolean;
  transcription: string;
  id?: string;
  conversationId?: string;
  role?: string;
  content?: string;
  createdAt?: string;
  driver_actions?: DriverAction[];
}

/**
 * Send a voice message (audio → STT → chat → response)
 */
export async function sendVoiceMessage(
  workspaceId: string,
  userId: string,
  audioBlob: Blob,
  context?: any
): Promise<VoiceMessageResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('userId', userId);
  if (context) {
    formData.append('context', JSON.stringify(context));
  }

  const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/chat/voice`;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Voice message failed: ${error}`);
  }

  return res.json();
}

/**
 * Fetch TTS audio for a text message
 */
export async function fetchTTSAudio(
  workspaceId: string,
  text: string,
  voiceId?: string
): Promise<Blob> {
  const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/chat/tts`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text, voiceId }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`TTS failed: ${error}`);
  }

  return res.blob();
}

/**
 * Code Search Types
 */
export interface CodeSearchRequest {
  query: string;
  caseSensitive?: boolean;
  filePattern?: string;
  contextLines?: number;
  maxResults?: number;
}

export interface CodeSearchResponse {
  searchId: string;
  sseUrl: string;
}

/**
 * Initiate a code search
 * Returns searchId and SSE URL for streaming results
 */
export async function initiateCodeSearch(
  workspaceId: string,
  request: CodeSearchRequest
): Promise<CodeSearchResponse> {
  const url = `${API_BASE}/api/v1/ai-assistant/workspaces/${workspaceId}/code-search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Code search failed: ${res.statusText}`);
  }

  return res.json();
}
