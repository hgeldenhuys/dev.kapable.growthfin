/**
 * TaskInlineProgress Component
 * Shows task progress inline with progress bar, stats, cost, and recent activity
 * Designed to be embedded in task list items without requiring navigation
 *
 * US-007: Integrates with job_logs infrastructure for real-time activity display
 */

import { useState, useEffect } from 'react';
import { DollarSign, CheckCircle2, XCircle, AlertCircle, Clock, Terminal, Loader2 } from 'lucide-react';
import { Progress } from '~/components/ui/progress';
import { Badge } from '~/components/ui/badge';
import type { Task } from '~/hooks/useTasks';

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

interface TaskInlineProgressProps {
  task: Task;
  workspaceId: string;
  compact?: boolean;
  /** Maximum number of log lines to show (default: 5) */
  maxLogLines?: number;
}

export function TaskInlineProgress({
  task,
  workspaceId,
  compact = false,
  maxLogLines = 5,
}: TaskInlineProgressProps) {
  const {
    totalEntities,
    processedEntities,
    successfulEntities,
    failedEntities,
    skippedEntities,
    actualCost,
    status,
    configuration,
  } = task;

  // Get enrichmentJobId from task configuration
  const enrichmentJobId = configuration?.['enrichmentJobId'] as string | undefined;

  // State for job logs
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  // Fetch initial logs when component mounts or jobId changes
  useEffect(() => {
    if (!enrichmentJobId || !workspaceId) return;

    const fetchLogs = async () => {
      setLogsLoading(true);
      setLogsError(null);

      try {
        const response = await fetch(
          `/api/v1/jobs/${enrichmentJobId}/logs?workspaceId=${workspaceId}&limit=${maxLogLines}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch logs: ${response.status}`);
        }

        const data = await response.json();
        // Logs come in descending order (newest first), reverse for display
        setLogs((data.logs || []).reverse());
      } catch (error) {
        console.error('[TaskInlineProgress] Error fetching logs:', error);
        setLogsError(error instanceof Error ? error.message : 'Failed to load logs');
      } finally {
        setLogsLoading(false);
      }
    };

    fetchLogs();
  }, [enrichmentJobId, workspaceId, maxLogLines]);

  // Subscribe to SSE for real-time log updates when task is running
  useEffect(() => {
    if (!enrichmentJobId || !workspaceId) return;
    if (status !== 'running') return;

    console.log('[TaskInlineProgress] Subscribing to job logs SSE for:', enrichmentJobId);

    const eventSource = new EventSource(
      `/api/v1/jobs/${enrichmentJobId}/sse?workspaceId=${workspaceId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle connected message
        if (data.type === 'connected') {
          console.log('[TaskInlineProgress] SSE connected for job:', enrichmentJobId);
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
            // Add new log and keep only the last maxLogLines
            const updated = [...prev, log].slice(-maxLogLines);
            return updated;
          });
        }
      } catch (error) {
        console.error('[TaskInlineProgress] Error parsing SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[TaskInlineProgress] SSE error:', error);
      // Don't close on error - let browser handle reconnection
    };

    return () => {
      console.log('[TaskInlineProgress] Closing job logs SSE');
      eventSource.close();
    };
  }, [enrichmentJobId, workspaceId, status, maxLogLines]);

  // Don't render if no progress data
  if (!totalEntities || totalEntities === 0) {
    return null;
  }

  const processed = processedEntities || 0;
  const successful = successfulEntities || 0;
  const failed = failedEntities || 0;
  const skipped = skippedEntities || 0;
  const total = totalEntities;

  // Calculate progress percentage
  const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

  // Format cost
  const formatCost = (cost: string | null) => {
    if (!cost) return '$0.00';
    const numCost = parseFloat(cost);
    if (isNaN(numCost)) return '$0.00';
    return `$${numCost.toFixed(4)}`;
  };

  // Format log timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Get log level color
  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-destructive';
      case 'warn': return 'text-amber-600 dark:text-amber-400';
      case 'debug': return 'text-muted-foreground';
      default: return 'text-foreground';
    }
  };

  // Get log level icon
  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle className="h-3 w-3 text-destructive" />;
      case 'warn': return <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />;
      default: return null;
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Progress bar with percentage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{processed} / {total}</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>

        {/* Compact stats row */}
        <div className="flex items-center gap-3 text-xs">
          {successful > 0 && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>{successful}</span>
            </div>
          )}
          {failed > 0 && (
            <div className="flex items-center gap-1 text-destructive">
              <XCircle className="h-3 w-3" />
              <span>{failed}</span>
            </div>
          )}
          {skipped > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>{skipped}</span>
            </div>
          )}
          {actualCost && (
            <div className="flex items-center gap-1 text-muted-foreground ml-auto">
              <DollarSign className="h-3 w-3" />
              <span className="font-medium">{formatCost(actualCost)}</span>
            </div>
          )}
        </div>

        {/* Compact recent activity (last 3 lines) */}
        {logs.length > 0 && (
          <div className="space-y-0.5 pt-1 border-t">
            {logs.slice(-3).map((log) => (
              <div key={log.id} className={`text-xs truncate ${getLogLevelColor(log.level)}`}>
                {getLogLevelIcon(log.level)}
                <span className="opacity-50 mr-1">{formatTime(log.createdAt)}</span>
                {log.message}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      {/* Progress bar with percentage */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground">{processed} / {total} ({progressPercent}%)</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col items-center p-2 rounded bg-card border">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <Clock className="h-3 w-3" />
            <span className="text-xs">Processed</span>
          </div>
          <span className="text-lg font-bold">{processed}</span>
        </div>

        <div className="flex flex-col items-center p-2 rounded bg-card border">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-xs">Success</span>
          </div>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">{successful}</span>
        </div>

        <div className="flex flex-col items-center p-2 rounded bg-card border">
          <div className="flex items-center gap-1 text-destructive mb-1">
            <XCircle className="h-3 w-3" />
            <span className="text-xs">Failed</span>
          </div>
          <span className="text-lg font-bold text-destructive">{failed}</span>
        </div>

        <div className="flex flex-col items-center p-2 rounded bg-card border">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <AlertCircle className="h-3 w-3" />
            <span className="text-xs">Skipped</span>
          </div>
          <span className="text-lg font-bold">{skipped}</span>
        </div>
      </div>

      {/* Cost display */}
      {actualCost && (
        <div className="flex items-center justify-between p-2 rounded bg-card border">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Total Cost</span>
          </div>
          <span className="text-sm font-bold">{formatCost(actualCost)}</span>
        </div>
      )}

      {/* Recent activity - job logs */}
      <div className="pt-2 border-t">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Recent Activity</span>
          </div>
          {status === 'running' && (
            <Badge variant="outline" className="text-xs gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Live
            </Badge>
          )}
          {logsLoading && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>

        {logsError ? (
          <p className="text-xs text-destructive">{logsError}</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {enrichmentJobId ? 'No activity logged yet' : 'No job ID available'}
          </p>
        ) : (
          <div className="space-y-1 font-mono text-xs bg-card rounded border p-2 max-h-32 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className={`flex items-start gap-2 ${getLogLevelColor(log.level)}`}>
                <span className="text-muted-foreground shrink-0">{formatTime(log.createdAt)}</span>
                <span className="shrink-0">{getLogLevelIcon(log.level)}</span>
                <span className="break-words">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
