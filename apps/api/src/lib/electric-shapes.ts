/**
 * SignalDB Shape Helpers
 *
 * Convenient functions for streaming each table via SignalDB real-time streams.
 * SignalDB automatically creates NOTIFY triggers on all tables, replacing
 * the need for ElectricSQL and manual pg_notify calls.
 *
 * All functions stream only NEW events from the subscription timestamp forward.
 */

import { createSignalDBStream, SignalDBStream } from './signaldb-stream';

/**
 * Stream claude_sessions changes.
 *
 * @param projectId - Filter by project ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamSessions(
  projectId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'claude_sessions',
    where: `project_id='${projectId}'`, // Optimized where clause
    subscriptionTimestamp,
  });
}

/**
 * Stream claude_sessions changes for todos (LEGACY).
 * Same as streamSessions but semantically different endpoint.
 *
 * @param projectId - Filter by project ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamTodos(
  projectId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'claude_sessions',
    where: `project_id='${projectId}'`,
    // Return all columns to ensure project_id is always included.
    subscriptionTimestamp,
  });
}

/**
 * Stream persistent todos table changes (NEW).
 * Streams from the todos table which persists across sessions.
 *
 * @param projectId - Filter by project ID
 * @param agentId - Optional: filter by agent type
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamPersistentTodos(
  projectId: string,
  agentId?: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  let where = `project_id='${projectId}'`;

  if (agentId) {
    where += ` AND agent_id='${agentId}'`;
  }

  return createSignalDBStream({
    table: 'todos',
    where,
    subscriptionTimestamp,
  });
}

/**
 * Stream event_summaries changes.
 *
 * @param projectId - Filter by project ID
 * @param sessionId - Optional: filter by session ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamSummaries(
  projectId: string,
  sessionId?: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  let where = `project_id='${projectId}'`;

  if (sessionId) {
    where += ` AND session_id='${sessionId}'`;
  }

  return createSignalDBStream({
    table: 'event_summaries',
    where,
    subscriptionTimestamp,
  });
}

/**
 * Stream chat_messages changes.
 *
 * @param projectId - Filter by project ID
 * @param sessionId - Optional: filter by session ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamChatMessages(
  projectId: string,
  sessionId?: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  let where = `project_id='${projectId}'`;

  if (sessionId) {
    where += ` AND session_id='${sessionId}'`;
  }

  return createSignalDBStream({
    table: 'chat_messages',
    where,
    subscriptionTimestamp,
  });
}

/**
 * Stream hook_events changes.
 * Used internally by the API to process hook events.
 *
 * @param projectId - Filter by project ID
 * @param sessionId - Optional: filter by session ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamHookEvents(
  projectId: string,
  sessionId?: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  let where = `project_id='${projectId}'`;

  if (sessionId) {
    where += ` AND session_id='${sessionId}'`;
  }

  return createSignalDBStream({
    table: 'hook_events',
    where,
    subscriptionTimestamp,
  });
}

/**
 * Stream projects changes.
 *
 * @param workspaceId - Optional: filter by workspace ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamProjects(
  workspaceId?: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'projects',
    where: workspaceId ? `workspace_id='${workspaceId}'` : undefined,
    subscriptionTimestamp,
  });
}

/**
 * Stream workspaces changes.
 *
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamWorkspaces(
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'workspaces',
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM contacts changes.
 *
 * @param workspaceId - Filter by workspace ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamContacts(
  workspaceId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'crm_contacts',
    where: `workspace_id='${workspaceId}'`,
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM timeline events changes.
 *
 * @param workspaceId - Filter by workspace ID
 * @param entityType - Optional: filter by entity type
 * @param entityId - Optional: filter by entity ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamCRMTimelineEvents(
  workspaceId: string,
  entityType?: string,
  entityId?: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  let where = `workspace_id='${workspaceId}'`;

  if (entityType) {
    where += ` AND entity_type='${entityType}'`;
  }

  if (entityId) {
    where += ` AND entity_id='${entityId}'`;
  }

  return createSignalDBStream({
    table: 'crm_timeline_events',
    where,
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM leads changes.
 *
 * @param workspaceId - Filter by workspace ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamLeads(
  workspaceId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'crm_leads',
    where: `workspace_id='${workspaceId}'`,
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM activities changes.
 *
 * @param workspaceId - Filter by workspace ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamActivities(
  workspaceId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'crm_activities',
    where: `workspace_id='${workspaceId}'`,
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM accounts changes.
 *
 * @param workspaceId - Filter by workspace ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamCRMAccounts(
  workspaceId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'crm_accounts',
    where: `workspace_id='${workspaceId}'`,
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM opportunities changes.
 *
 * @param workspaceId - Filter by workspace ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamOpportunities(
  workspaceId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'crm_opportunities',
    where: `workspace_id='${workspaceId}'`,
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM contact lists changes.
 *
 * @param workspaceId - Filter by workspace ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamContactLists(
  workspaceId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'crm_contact_lists',
    where: `workspace_id='${workspaceId}'`,
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM enrichment jobs changes.
 *
 * @param workspaceId - Filter by workspace ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamEnrichmentJobs(
  workspaceId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'crm_enrichment_jobs',
    where: `workspace_id='${workspaceId}'`,
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM enrichment results changes.
 *
 * @param jobId - Filter by job ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamEnrichmentResults(
  jobId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'crm_enrichment_results',
    where: `job_id='${jobId}'`,
    subscriptionTimestamp,
  });
}

/**
 * Stream tool calls for an enrichment result in real-time.
 * Used to provide detailed feedback on what tools are being executed during enrichment.
 *
 * @param enrichmentResultId - The enrichment result to stream tool calls for
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamToolCalls(
  enrichmentResultId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'crm_tool_calls',
    where: `enrichment_result_id='${enrichmentResultId}'`,
    subscriptionTimestamp,
  });
}

/**
 * Stream SDLC files changes.
 * Used by the web dashboard to receive real-time SDLC file updates.
 *
 * @param sessionId - Optional: filter by session ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamSDLCFiles(
  sessionId?: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'sdlc_files',
    where: sessionId ? `session_id='${sessionId}'` : undefined,
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM enrichment history changes.
 *
 * @param workspaceId - Filter by workspace ID
 * @param entityId - Optional: filter by entity ID
 * @param entityType - Optional: filter by entity type
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamEnrichmentHistory(
  workspaceId: string,
  entityId?: string,
  entityType?: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  let where = `workspace_id='${workspaceId}'`;

  if (entityId) {
    where += ` AND entity_id='${entityId}'`;
  }

  if (entityType) {
    where += ` AND entity_type='${entityType}'`;
  }

  return createSignalDBStream({
    table: 'crm_enrichment_history',
    where,
    subscriptionTimestamp,
  });
}

/**
 * Stream CRM batches changes.
 *
 * @param workspaceId - Filter by workspace ID
 * @param batchId - Optional: filter by batch ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamBatches(
  workspaceId: string,
  batchId?: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  let where = `workspace_id='${workspaceId}'`;

  if (batchId) {
    where += ` AND id='${batchId}'`;
  }

  return createSignalDBStream({
    table: 'crm_batches',
    where,
    subscriptionTimestamp,
  });
}

/**
 * Stream job_logs changes for a specific job (US-008).
 * Used by the job observability system for real-time log streaming.
 *
 * @param jobId - Filter by job ID
 * @param subscriptionTimestamp - Only events after this time
 */
export function streamJobLogs(
  jobId: string,
  subscriptionTimestamp: Date = new Date()
): SignalDBStream {
  return createSignalDBStream({
    table: 'job_logs',
    where: `job_id='${jobId}'`,
    subscriptionTimestamp,
  });
}
