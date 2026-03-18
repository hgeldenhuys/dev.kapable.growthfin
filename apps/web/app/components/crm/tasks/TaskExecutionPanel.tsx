/**
 * TaskExecutionPanel Component
 * Inline task execution monitoring with SSE progress updates
 */

import { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Terminal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { useRetryTask } from '~/hooks/useTasks';
import { toast } from 'sonner';

// Tool call format from ElectricSQL streaming
interface ToolCall {
  id: string;
  enrichment_result_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  result: Record<string, any>;
  cost: number;
  duration_ms: number;
  status: 'success' | 'failed';
  provider?: string;
  created_at: string;
}

// ElectricSQL enrichment_results format (enriched by API with entity details)
interface EnrichmentResult {
  id: string;
  workspaceId: string;
  jobId: string;
  entityId: string;
  entityType: 'contact' | 'lead';
  entityName: string; // Added by API from contact/lead table
  entityEmail: string; // Added by API from contact/lead table
  status: 'success' | 'failed' | 'skipped';
  score: number | null;
  enrichmentData: Record<string, any>;
  reasoning: string | null;
  errorMessage: string | null;
  tokensUsed: number | null;
  cost: number | null;
  durationMs: number | null;
  createdAt: string;
}

// Contact being processed with its tool calls
interface ProcessingContact {
  enrichmentResultId: string;
  entityId: string;
  entityName: string;
  entityEmail: string;
  status: 'processing' | 'success' | 'failed' | 'skipped';
  toolCalls: ToolCall[];
  finalCost: number | null;
  completedAt: string | null;
}

// Job log entry from API
interface JobLog {
  id: string;
  workspaceId: string;
  jobId: string;
  jobType: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Legacy progress update format (kept for backwards compatibility if needed)
interface ProgressUpdate {
  type: 'contact_processed' | 'task_completed' | 'task_failed';
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  status?: 'success' | 'error' | 'skipped';
  cost?: number;
  error?: string;
  timestamp?: string;
}

interface ExecutionSummary {
  processed: number;
  failed: number;
  skipped: number;
  totalCost: number;
}

interface TaskExecutionPanelProps {
  taskId: string;
  workspaceId: string;
  taskStatus: string;
  taskConfiguration?: Record<string, any>;
  task?: {
    totalEntities: number | null;
    processedEntities: number | null;
    successfulEntities: number | null;
    failedEntities: number | null;
    skippedEntities: number | null;
    actualCost: string | null;
  };
}

export function TaskExecutionPanel({
  taskId,
  workspaceId,
  taskStatus,
  taskConfiguration,
  task,
}: TaskExecutionPanelProps) {
  const retryMutation = useRetryTask();

  const [progressEvents, setProgressEvents] = useState<ProgressUpdate[]>([]);
  const [contacts, setContacts] = useState<Map<string, ProcessingContact>>(new Map());
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());

  // Job logs state
  const [logs, setLogs] = useState<JobLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const MAX_LOG_LINES = 20;

  // Initialize summary from persisted task data
  const [summary, setSummary] = useState<ExecutionSummary>({
    processed: task?.successfulEntities ?? 0,
    failed: task?.failedEntities ?? 0,
    skipped: task?.skippedEntities ?? 0,
    totalCost: task?.actualCost ? parseFloat(task.actualCost) : 0,
  });

  // Update summary when task data changes (e.g., after React Query refetch)
  useEffect(() => {
    if (task) {
      setSummary({
        processed: task.successfulEntities ?? 0,
        failed: task.failedEntities ?? 0,
        skipped: task.skippedEntities ?? 0,
        totalCost: task.actualCost ? parseFloat(task.actualCost) : 0,
      });
    }
  }, [task]);

  // Auto-scroll to latest log
  useEffect(() => {
    if (logsEndRef.current && logs.length > 0) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // SSE Job Logs Subscription
  useEffect(() => {
    const enrichmentJobId = taskConfiguration?.enrichmentJobId as string | undefined;

    if (!enrichmentJobId || !workspaceId) return;
    if (taskStatus !== 'running') return;

    console.log('[TaskExecutionPanel] Subscribing to job logs SSE for:', enrichmentJobId);

    const eventSource = new EventSource(
      `/api/v1/jobs/${enrichmentJobId}/sse?workspaceId=${workspaceId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle connected message
        if (data.type === 'connected') {
          console.log('[TaskExecutionPanel] Job logs SSE connected for job:', enrichmentJobId);
          return;
        }

        // Handle log entry (ElectricSQL format with value wrapper)
        const logEntry = data.value || data;
        if (logEntry.message) {
          // Convert snake_case to camelCase
          const log: JobLog = {
            id: logEntry.id,
            workspaceId: logEntry.workspace_id || logEntry.workspaceId,
            jobId: logEntry.job_id || logEntry.jobId,
            jobType: logEntry.job_type || logEntry.jobType,
            level: logEntry.level,
            message: logEntry.message,
            metadata: typeof logEntry.metadata === 'string'
              ? JSON.parse(logEntry.metadata)
              : (logEntry.metadata || {}),
            createdAt: logEntry.created_at || logEntry.createdAt,
          };

          setLogs(prev => {
            // Add new log and keep only the last MAX_LOG_LINES
            const updated = [...prev, log].slice(-MAX_LOG_LINES);
            return updated;
          });
        }
      } catch (error) {
        console.error('[TaskExecutionPanel] Error parsing job log SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.log('[TaskExecutionPanel] Job logs SSE connection closed:', error);
      eventSource.close();
    };

    return () => {
      console.log('[TaskExecutionPanel] Closing job logs SSE connection');
      eventSource.close();
    };
  }, [taskStatus, taskConfiguration, workspaceId]);

  // SSE Progress Tracking (ElectricSQL enrichment_results + tool_calls stream)
  useEffect(() => {
    if (!taskId || !workspaceId) return;
    if (taskStatus !== 'running') return;

    // Connect to task progress SSE endpoint via BFF proxy
    // NOTE: Uses /api/tasks/ (not /api/v1/crm/tasks/) to hit the BFF SSE-aware proxy
    const eventSource = new EventSource(
      `/api/tasks/${taskId}/progress?workspaceId=${workspaceId}`
    );

    console.log('[TaskExecutionPanel] Connected to task progress stream for taskId:', taskId, 'workspaceId:', workspaceId);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle tool_call events
        if (data.type === 'tool_call') {
          console.log('[TaskExecutionPanel] Received tool call:', data);

          const enrichmentResultId = data.enrichmentResultId || data.enrichment_result_id;
          const toolCall = data as ToolCall;

          setContacts((prev) => {
            const contact = prev.get(enrichmentResultId);
            if (!contact) {
              return prev;
            }

            return new Map(prev).set(enrichmentResultId, {
              ...contact,
              toolCalls: [...contact.toolCalls, toolCall],
            });
          });
        }

        // Handle enrichment_result events
        if (data.type === 'enrichment_result') {
          const result: EnrichmentResult = data;
          console.log('[TaskExecutionPanel] Received enrichment result:', result);

          // Add/update contact in the map
          setContacts((prev) => {
            const newMap = new Map(prev);
            newMap.set(result.id, {
              enrichmentResultId: result.id,
              entityId: result.entityId,
              entityName: result.entityName,
              entityEmail: result.entityEmail,
              status: result.status === 'failed' ? 'failed' : result.status,
              toolCalls: prev.get(result.id)?.toolCalls || [],
              finalCost: result.cost || 0,
              completedAt: result.createdAt,
            });
            return newMap;
          });

          // Convert enrichment_result to ProgressUpdate format for backwards compatibility
          const progressUpdate: ProgressUpdate = {
            type: 'contact_processed',
            contactId: result.entityId,
            contactName: result.entityName,
            contactEmail: result.entityEmail,
            status: result.status === 'failed' ? 'error' : result.status,
            cost: result.cost || 0,
            error: result.errorMessage || undefined,
            timestamp: result.createdAt,
          };

          setProgressEvents((prev) => [...prev, progressUpdate]);

          // Update summary counters
          setSummary((prev) => ({
            processed: prev.processed + (result.status === 'success' ? 1 : 0),
            failed: prev.failed + (result.status === 'failed' ? 1 : 0),
            skipped: prev.skipped + (result.status === 'skipped' ? 1 : 0),
            totalCost: prev.totalCost + (result.cost || 0),
          }));
        }
      } catch (error) {
        console.error('[TaskExecutionPanel] Error parsing SSE event:', error, event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.log('[TaskExecutionPanel] SSE connection closed:', error);
      // Don't show error toast - this fires when task completes normally
      // The stream closes when execution finishes, which is expected behavior
      eventSource.close();
    };

    return () => {
      console.log('[TaskExecutionPanel] Closing SSE connection');
      eventSource.close();
    };
  }, [taskStatus, taskId, workspaceId]);

  const handleRetry = async () => {
    if (!taskId) return;

    try {
      const result = await retryMutation.mutateAsync({ taskId, workspaceId });

      toast.success('Retry Task Created', { description: `Retry task has been created successfully.` });

      // Reload the page to show the new task
      window.location.reload();
    } catch (error) {
      toast.error('Retry Failed', { description: error instanceof Error ? error.message : 'Failed to create retry task' });
    }
  };

  // Helper functions for log display
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-destructive';
      case 'warn': return 'text-amber-600 dark:text-amber-400';
      case 'debug': return 'text-muted-foreground';
      default: return 'text-foreground';
    }
  };

  const getLogLevelBadge = (level: string) => {
    switch (level) {
      case 'error': return <Badge variant="destructive" className="text-[10px] px-1 py-0">ERROR</Badge>;
      case 'warn': return <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-600">WARN</Badge>;
      case 'debug': return <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">DEBUG</Badge>;
      default: return <Badge variant="outline" className="text-[10px] px-1 py-0">INFO</Badge>;
    }
  };

  const budgetLimit = taskConfiguration?.budgetLimit || 0;
  const budgetUsedPercent = budgetLimit > 0 ? (summary.totalCost / budgetLimit) * 100 : 0;
  const totalContacts = summary.processed + summary.failed + summary.skipped;
  const failedContacts = progressEvents.filter((e) => e.status === 'error');

  return (
    <div className="space-y-6">
      {/* Budget Indicator */}
      {budgetLimit > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={Math.min(budgetUsedPercent, 100)} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="font-medium">
                ${summary.totalCost.toFixed(4)} / ${budgetLimit.toFixed(2)}
              </span>
            </div>
            {budgetUsedPercent > 90 && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span>Budget nearly exhausted</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Execution Summary */}
      {(taskStatus === 'running' || taskStatus === 'completed' || taskStatus === 'failed') && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalContacts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.processed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary.failed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${summary.totalCost.toFixed(4)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Live Activity - Job Logs */}
      {taskStatus === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Live Activity
            </CardTitle>
            <CardDescription>
              Real-time job logs from task execution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            {task?.totalEntities && task.totalEntities > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {task.processedEntities ?? 0} / {task.totalEntities} entities
                    {' '}({Math.round(((task.processedEntities ?? 0) / task.totalEntities) * 100)}%)
                  </span>
                </div>
                <Progress
                  value={((task.processedEntities ?? 0) / task.totalEntities) * 100}
                  className="h-2"
                />
              </div>
            )}
            <div className="bg-slate-950 dark:bg-slate-900 rounded-lg p-4 font-mono text-sm max-h-80 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Waiting for activity logs...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <span className="text-slate-500 shrink-0 min-w-[70px]">
                        [{formatTime(log.createdAt)}]
                      </span>
                      <span className="shrink-0 min-w-[50px]">
                        {getLogLevelBadge(log.level)}
                      </span>
                      <span className={`break-words ${getLogLevelColor(log.level)}`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Progress Feed */}
      {taskStatus === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Contacts
            </CardTitle>
            <CardDescription>
              {contacts.size > 0 ? `${contacts.size} contact${contacts.size !== 1 ? 's' : ''} being processed` : 'Live updates as contacts are being processed'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {contacts.size === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Waiting for progress updates...
                </p>
              ) : (
                Array.from(contacts.values()).map((contact) => {
                  const isExpanded = expandedContacts.has(contact.enrichmentResultId);
                  const toggleExpand = () => {
                    setExpandedContacts((prev) => {
                      const newSet = new Set(prev);
                      if (newSet.has(contact.enrichmentResultId)) {
                        newSet.delete(contact.enrichmentResultId);
                      } else {
                        newSet.add(contact.enrichmentResultId);
                      }
                      return newSet;
                    });
                  };

                  return (
                    <div key={contact.enrichmentResultId} className="border rounded-lg p-3">
                      {/* Contact header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{contact.entityName}</p>
                          {contact.entityEmail && (
                            <p className="text-xs text-muted-foreground">{contact.entityEmail}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {contact.status === 'processing' && (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              <span className="text-xs text-muted-foreground">Processing...</span>
                            </>
                          )}
                          {contact.status === 'success' && (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Success
                            </Badge>
                          )}
                          {contact.status === 'failed' && (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Failed
                            </Badge>
                          )}
                          {contact.status === 'skipped' && (
                            <Badge variant="secondary" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Skipped
                            </Badge>
                          )}
                          {contact.finalCost !== null && (
                            <span className="text-sm text-muted-foreground font-medium">
                              ${contact.finalCost.toFixed(4)}
                            </span>
                          )}
                          {contact.toolCalls.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={toggleExpand}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              <span className="text-xs ml-1">{contact.toolCalls.length}</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expandable tool calls */}
                      {isExpanded && contact.toolCalls.length > 0 && (
                        <div className="mt-2 pt-2 border-t space-y-1.5">
                          {contact.toolCalls.map((toolCall, idx) => (
                            <div key={idx} className="text-xs bg-muted rounded p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{toolCall.tool_name}</span>
                                <div className="flex items-center gap-2">
                                  {toolCall.status === 'success' ? (
                                    <Badge variant="default" className="h-4 px-1 text-xs">
                                      OK
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="h-4 px-1 text-xs">
                                      ERROR
                                    </Badge>
                                  )}
                                  <span className="text-muted-foreground">
                                    {toolCall.duration_ms}ms
                                  </span>
                                </div>
                              </div>
                              {toolCall.result && typeof toolCall.result === 'object' && (
                                <div className="text-muted-foreground">
                                  {toolCall.tool_name === 'web_search' &&
                                    toolCall.result.results && (
                                      <p>Found {toolCall.result.results.length} results</p>
                                    )}
                                  {toolCall.tool_name === 'verify_email' && (
                                    <p>
                                      {toolCall.result.deliverable ? 'Valid' : 'Invalid'} email
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion Summary */}
      {taskStatus === 'completed' && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Execution Complete
            </CardTitle>
            <CardDescription>Task finished successfully</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Processed</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{summary.processed}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-destructive">{summary.failed}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Skipped</p>
                <p className="text-2xl font-bold">{summary.skipped}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">${summary.totalCost.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Contacts Table */}
      {(taskStatus === 'completed' || taskStatus === 'failed') &&
        failedContacts.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Failed Contacts ({failedContacts.length})</CardTitle>
                <CardDescription>
                  Contacts that could not be processed successfully
                </CardDescription>
              </div>
              <Button onClick={handleRetry} disabled={retryMutation.isPending}>
                {retryMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Retry Failed
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedContacts.map((contact, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {contact.contactName || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contact.contactEmail || 'N/A'}
                      </TableCell>
                      <TableCell className="text-destructive text-sm">
                        {contact.error || 'Unknown error'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
