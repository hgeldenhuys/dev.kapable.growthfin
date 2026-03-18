/**
 * Code Search Job Definition
 * Defines the job schema for code search requests processed by CLI
 */

export interface CodeSearchJob {
  searchId: string;
  workspaceId: string;
  query: string;
  caseSensitive: boolean;
  filePattern: string;
  contextLines: number;
  maxResults: number;
  requestedBy: string; // userId
}

export interface CodeSearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface CodeSearchProgressEvent {
  type: 'progress';
  filesScanned: number;
  timestamp: string;
}

export interface CodeSearchResultEvent {
  type: 'result';
  data: CodeSearchResult;
  timestamp: string;
}

export interface CodeSearchResultsBatchEvent {
  type: 'results_batch';
  data: CodeSearchResult[];
  timestamp: string;
}

export interface CodeSearchCompleteEvent {
  type: 'complete';
  totalMatches: number;
  executionTimeMs: number;
  truncated: boolean;
  timestamp: string;
}

export interface CodeSearchErrorEvent {
  type: 'error';
  error: string;
  message: string;
  timestamp: string;
}

export type CodeSearchEvent =
  | CodeSearchProgressEvent
  | CodeSearchResultEvent
  | CodeSearchResultsBatchEvent
  | CodeSearchCompleteEvent
  | CodeSearchErrorEvent;

/**
 * Queue name for pg-boss
 */
export const CODE_SEARCH_QUEUE = 'code-search-requested';

/**
 * PostgreSQL channel pattern for publishing results
 * Channel name format: code_search_{searchId}
 */
export const getCodeSearchChannel = (searchId: string) => `code_search_${searchId}`;
