/**
 * Intelligence API Client
 * Functions for AI workspace intelligence features
 */

import { apiRequest } from '../api';

// ==================== Types ====================

export interface SemanticSearchResult {
  entityType: string;
  entityName: string;
  summary: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  score: number;
}

export interface SemanticSearchOptions {
  entityTypes?: string[];
  limit?: number;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
}

export interface Memory {
  id: string;
  type: 'pattern' | 'decision' | 'preference' | 'fact';
  key: string;
  value: string;
  confidence: number;
  status: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MemoryListResponse {
  memories: Memory[];
}

export interface CreateMemoryRequest {
  type: 'pattern' | 'decision' | 'preference' | 'fact';
  key: string;
  value: string;
  tags?: string[];
}

export interface UpdateMemoryRequest {
  key?: string;
  value?: string;
  tags?: string[];
}

export interface ContextBudget {
  used: number;
  limit: number;
  percentage: number;
  breakdown: {
    messages: number;
    files: number;
    tools: number;
    other: number;
  };
  shouldCompress: boolean;
}

export interface CompressContextRequest {
  keepRecentCount?: number;
}

export interface CompressContextResponse {
  summarized: number;
  tokensSaved: number;
}

export interface ConversationSearchRequest {
  query?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  files?: string[];
  topics?: string[];
  limit?: number;
}

export interface ConversationSearchResult {
  id: string;
  summary: string;
  topics: string[];
  keywords: string[];
  filesDiscussed: string[];
  createdAt: string;
}

export interface ConversationSearchResponse {
  results: ConversationSearchResult[];
}

export interface Suggestion {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actionable: boolean;
  status: 'pending' | 'applied' | 'dismissed';
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestionsResponse {
  suggestions: Suggestion[];
}

export interface DismissSuggestionRequest {
  reason?: string;
}

export interface ScanRequest {
  scanTypes: Array<'tests' | 'docs' | 'quality'>;
}

export interface IndexStatus {
  totalFiles: number;
  indexedEntities: number;
  lastIndexedAt: string | null;
  isIndexing: boolean;
}

export interface BuildIndexRequest {
  incremental?: boolean;
}

export interface BuildIndexResponse {
  jobId: string;
  status: 'queued';
}

// ==================== API Functions ====================

/**
 * Semantic search across codebase entities
 */
export async function semanticSearch(
  workspaceId: string,
  query: string,
  options?: SemanticSearchOptions
): Promise<SemanticSearchResponse> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/search`,
    {
      method: 'POST',
      body: JSON.stringify({
        query,
        options,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search: ${error}`);
  }

  return response.json();
}

/**
 * List memories with optional filters
 */
export async function listMemories(
  workspaceId: string,
  params?: {
    query?: string;
    category?: string;
    limit?: number;
  }
): Promise<MemoryListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.query) searchParams.set('query', params.query);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const queryString = searchParams.toString();
  const url = `/api/v1/workspaces/${workspaceId}/intelligence/memory${
    queryString ? `?${queryString}` : ''
  }`;

  const response = await apiRequest(url);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch memories: ${error}`);
  }

  return response.json();
}

/**
 * Create a new memory
 */
export async function createMemory(
  workspaceId: string,
  memory: CreateMemoryRequest
): Promise<Memory> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/memory`,
    {
      method: 'POST',
      body: JSON.stringify(memory),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create memory: ${error}`);
  }

  return response.json();
}

/**
 * Update an existing memory
 */
export async function updateMemory(
  workspaceId: string,
  memoryId: string,
  updates: UpdateMemoryRequest
): Promise<Memory> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/memory/${memoryId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update memory: ${error}`);
  }

  return response.json();
}

/**
 * Delete a memory
 */
export async function deleteMemory(
  workspaceId: string,
  memoryId: string
): Promise<void> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/memory/${memoryId}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete memory: ${error}`);
  }
}

/**
 * Get context budget for a conversation
 */
export async function getContextBudget(
  workspaceId: string,
  conversationId: string
): Promise<ContextBudget> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/conversations/${conversationId}/context`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch context budget: ${error}`);
  }

  return response.json();
}

/**
 * Compress conversation context
 */
export async function compressContext(
  workspaceId: string,
  conversationId: string,
  request?: CompressContextRequest
): Promise<CompressContextResponse> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/conversations/${conversationId}/compress`,
    {
      method: 'POST',
      body: JSON.stringify(request || {}),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to compress context: ${error}`);
  }

  return response.json();
}

/**
 * Search conversations
 */
export async function searchConversations(
  workspaceId: string,
  request: ConversationSearchRequest
): Promise<ConversationSearchResponse> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/conversations/search`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search conversations: ${error}`);
  }

  return response.json();
}

/**
 * List suggestions with optional filters
 */
export async function listSuggestions(
  workspaceId: string,
  params?: {
    type?: string;
    severity?: string;
    status?: string;
    limit?: number;
  }
): Promise<SuggestionsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.severity) searchParams.set('severity', params.severity);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const queryString = searchParams.toString();
  const url = `/api/v1/workspaces/${workspaceId}/intelligence/suggestions${
    queryString ? `?${queryString}` : ''
  }`;

  const response = await apiRequest(url);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch suggestions: ${error}`);
  }

  return response.json();
}

/**
 * Apply a suggestion
 */
export async function applySuggestion(
  workspaceId: string,
  suggestionId: string
): Promise<Suggestion> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/suggestions/${suggestionId}/apply`,
    {
      method: 'PUT',
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to apply suggestion: ${error}`);
  }

  return response.json();
}

/**
 * Dismiss a suggestion
 */
export async function dismissSuggestion(
  workspaceId: string,
  suggestionId: string,
  request?: DismissSuggestionRequest
): Promise<Suggestion> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/suggestions/${suggestionId}/dismiss`,
    {
      method: 'PUT',
      body: JSON.stringify(request || {}),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to dismiss suggestion: ${error}`);
  }

  return response.json();
}

/**
 * Trigger a manual scan for suggestions
 */
export async function scanForSuggestions(
  workspaceId: string,
  request: ScanRequest
): Promise<void> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/suggestions/scan`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to scan for suggestions: ${error}`);
  }
}

/**
 * Get index status
 */
export async function getIndexStatus(workspaceId: string): Promise<IndexStatus> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/index/status`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch index status: ${error}`);
  }

  return response.json();
}

/**
 * Build or rebuild the index
 */
export async function buildIndex(
  workspaceId: string,
  request?: BuildIndexRequest
): Promise<BuildIndexResponse> {
  const response = await apiRequest(
    `/api/v1/workspaces/${workspaceId}/intelligence/index/build`,
    {
      method: 'POST',
      body: JSON.stringify(request || {}),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to build index: ${error}`);
  }

  return response.json();
}
