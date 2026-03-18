/**
 * TaskExecutionReport Component
 * US-011: Task Execution Transparency
 * T-004: Create TaskExecutionReport component
 *
 * Displays comprehensive execution report after task completion:
 * - Summary statistics
 * - Collapsible job logs timeline
 * - Entity-by-entity results with expandable tool calls
 * - Cost and timing information
 */

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  Terminal,
  Search,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '~/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  result: Record<string, any>;
  status: 'success' | 'failed';
  cost: number;
  durationMs: number;
  provider?: string;
  createdAt: string;
}

interface EntityResult {
  id: string;
  entityId: string;
  entityName: string;
  entityEmail: string;
  entityType: 'contact' | 'lead';
  status: 'success' | 'failed' | 'skipped';
  score: number | null;
  enrichmentData: Record<string, any>;
  reasoning: string | null;
  errorMessage: string | null;
  tokensUsed: number | null;
  cost: number | null;
  durationMs: number | null;
  toolCalls: ToolCall[];
  createdAt: string;
}

interface JobLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface JobExecutionReport {
  jobId: string;
  jobType: string;
  status: 'completed' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  // Summary
  totalEntities: number;
  successfulEntities: number;
  failedEntities: number;
  skippedEntities: number;
  totalCost: number;
  // Details
  entityResults: EntityResult[];
  logs: JobLog[];
}

interface TaskExecutionReportProps {
  jobId: string;
  workspaceId: string;
  report?: JobExecutionReport; // Will be fetched via hook (T-006) if not provided
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TaskExecutionReport({
  jobId,
  workspaceId,
  report,
}: TaskExecutionReportProps) {
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState<string[]>([]);

  // TODO (T-006): Replace with useJobReport hook when available
  if (!report) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Loading execution report...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter logs
  const filteredLogs = report.logs.filter((log) => {
    const matchesSearch = log.message
      .toLowerCase()
      .includes(logSearchTerm.toLowerCase());
    const matchesLevel =
      logLevelFilter.length === 0 || logLevelFilter.includes(log.level);
    return matchesSearch && matchesLevel;
  });

  const toggleLogLevel = (level: string) => {
    setLogLevelFilter((prev) =>
      prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level]
    );
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const successRate =
    report.totalEntities > 0
      ? ((report.successfulEntities / report.totalEntities) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      {/* ========== SUMMARY SECTION ========== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {report.status === 'completed' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            Execution Summary
          </CardTitle>
          <CardDescription>
            Job {report.jobId.slice(0, 8)} - {report.jobType}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Total Entities */}
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                Total Entities
              </div>
              <div className="text-2xl font-bold">{report.totalEntities}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {successRate}% success rate
              </div>
            </div>

            {/* Successful */}
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Successful
              </div>
              <div className="text-2xl font-bold text-green-600">
                {report.successfulEntities}
              </div>
            </div>

            {/* Failed */}
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <XCircle className="h-4 w-4 text-destructive" />
                Failed
              </div>
              <div className="text-2xl font-bold text-destructive">
                {report.failedEntities}
              </div>
            </div>

            {/* Total Cost */}
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                Total Cost
              </div>
              <div className="text-2xl font-bold">
                ${report.totalCost.toFixed(4)}
              </div>
            </div>

            {/* Duration */}
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                Duration
              </div>
              <div className="text-2xl font-bold">
                {formatDuration(report.durationMs)}
              </div>
            </div>

            {/* Started At */}
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                Started
              </div>
              <div className="text-sm font-medium">
                {report.startedAt ? formatTimestamp(report.startedAt) : 'N/A'}
              </div>
            </div>

            {/* Completed At */}
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                Completed
              </div>
              <div className="text-sm font-medium">
                {report.completedAt
                  ? formatTimestamp(report.completedAt)
                  : 'N/A'}
              </div>
            </div>

            {/* Skipped */}
            {report.skippedEntities > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Skipped
                </div>
                <div className="text-2xl font-bold text-amber-600">
                  {report.skippedEntities}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ========== LOGS TIMELINE (COLLAPSIBLE) ========== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Job Logs
                <Badge variant="secondary">{report.logs.length}</Badge>
              </CardTitle>
              <CardDescription>
                Chronological execution logs
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogsExpanded(!logsExpanded)}
            >
              {logsExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Expand
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {logsExpanded && (
          <CardContent className="space-y-4">
            {/* Log Filters */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2">
                {['info', 'warn', 'error', 'debug'].map((level) => (
                  <Button
                    key={level}
                    variant={
                      logLevelFilter.includes(level) ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => toggleLogLevel(level)}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>

            {/* Logs Display */}
            <div className="bg-slate-950 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-xs">
              {filteredLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-4">
                  No logs match your filters
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="flex gap-2">
                      <span className="text-slate-500 shrink-0">
                        {formatTimestamp(log.createdAt)}
                      </span>
                      <span
                        className={`shrink-0 font-bold ${
                          log.level === 'error'
                            ? 'text-red-400'
                            : log.level === 'warn'
                            ? 'text-amber-400'
                            : log.level === 'debug'
                            ? 'text-blue-400'
                            : 'text-green-400'
                        }`}
                      >
                        {log.level.toUpperCase()}
                      </span>
                      <span className="text-slate-200">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ========== ENTITY RESULTS ========== */}
      <Card>
        <CardHeader>
          <CardTitle>Entity Results</CardTitle>
          <CardDescription>
            Detailed results for each processed entity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.entityResults.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No entity results available
            </p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {report.entityResults.map((entity) => (
                <AccordionItem key={entity.id} value={entity.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        {/* Status Icon */}
                        {entity.status === 'success' && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        )}
                        {entity.status === 'failed' && (
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        {entity.status === 'skipped' && (
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        )}

                        {/* Entity Info */}
                        <div className="text-left">
                          <div className="font-medium">{entity.entityName}</div>
                          <div className="text-xs text-muted-foreground">
                            {entity.entityEmail}
                          </div>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center gap-4 text-sm">
                        {entity.score !== null && (
                          <Badge variant="secondary">
                            Score: {entity.score}
                          </Badge>
                        )}
                        {entity.cost !== null && (
                          <span className="text-muted-foreground">
                            ${entity.cost.toFixed(4)}
                          </span>
                        )}
                        {entity.durationMs !== null && (
                          <span className="text-muted-foreground">
                            {formatDuration(entity.durationMs)}
                          </span>
                        )}
                        {entity.toolCalls.length > 0 && (
                          <Badge variant="outline">
                            {entity.toolCalls.length} tool
                            {entity.toolCalls.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {/* Error Message */}
                      {entity.errorMessage && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <div className="font-medium text-destructive text-sm">
                                Error
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {entity.errorMessage}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Reasoning */}
                      {entity.reasoning && (
                        <div>
                          <div className="font-medium text-sm mb-2">
                            Reasoning
                          </div>
                          <div className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                            {entity.reasoning}
                          </div>
                        </div>
                      )}

                      {/* Enrichment Data */}
                      {Object.keys(entity.enrichmentData).length > 0 && (
                        <div>
                          <div className="font-medium text-sm mb-2">
                            Enrichment Data
                          </div>
                          <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                            <pre className="text-slate-200">
                              {JSON.stringify(entity.enrichmentData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Tool Calls */}
                      {entity.toolCalls.length > 0 && (
                        <div>
                          <div className="font-medium text-sm mb-2">
                            Tool Calls ({entity.toolCalls.length})
                          </div>
                          <div className="space-y-2">
                            {entity.toolCalls.map((toolCall, idx) => (
                              <div
                                key={toolCall.id}
                                className="border rounded-lg p-3 bg-muted/50"
                              >
                                {/* Tool Call Header */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">
                                      {idx + 1}. {toolCall.toolName}
                                    </span>
                                    {toolCall.provider && (
                                      <Badge variant="outline" className="text-xs">
                                        {toolCall.provider}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>
                                      {formatDuration(toolCall.durationMs)}
                                    </span>
                                    <span>${toolCall.cost.toFixed(4)}</span>
                                    {toolCall.status === 'success' ? (
                                      <Badge
                                        variant="default"
                                        className="h-5 text-xs"
                                      >
                                        OK
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="destructive"
                                        className="h-5 text-xs"
                                      >
                                        ERROR
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Input */}
                                <div className="mb-2">
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Input:
                                  </div>
                                  <div className="bg-slate-950 rounded p-2 font-mono text-xs overflow-x-auto">
                                    <pre className="text-slate-200">
                                      {JSON.stringify(toolCall.arguments, null, 2)}
                                    </pre>
                                  </div>
                                </div>

                                {/* Output */}
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Output:
                                  </div>
                                  <div className="bg-slate-950 rounded p-2 font-mono text-xs overflow-x-auto">
                                    <pre className="text-slate-200">
                                      {JSON.stringify(toolCall.result, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      {entity.tokensUsed !== null && (
                        <div className="text-xs text-muted-foreground">
                          Tokens used: {entity.tokensUsed.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
